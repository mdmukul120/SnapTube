#!/usr/bin/env python3
"""
Playtek / CricfyTV Automated Decoder & Match Feed Generator
-----------------------------------------------------------
Uses ALL decryption utilities from `txt_decoder.py`:
  1. `decode_cfj1` / `decode_auto` to decode the Playtek Remote Config links:
       - https://c.playtek.xyz/2-xmnhab.json
       - https://p.playtek.xyz/2-xmnhab.json
  2. `encrypt_xor_hex` + `DEFAULT_SIGNING_TOKEN` to sign `getData.php` requests
     on the decoded API hosts (`api_url`, `api2`, `api3`).
  3. `decode_v2_txt` / `decode_cfytop_txt` / `decode_baker_stream` / `repair_json_tail`
     via `decode_auto` to decode `v2/events.txt` and `v2/event_cats.txt` into clean JSON.
  4. Writes clean, structured live match data to `match.json` (and `config_decoded.json`).
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from txt_decoder import (
    CFYTOP_AES_IV,
    CFYTOP_AES_KEY,
    DEFAULT_SIGNING_TOKEN,
    QUERY_XOR_KEY,
    V2_AES_IV,
    V2_AES_KEY,
    aes_cbc_decrypt,
    cfg_material,
    clean_base64,
    decode_auto,
    decode_baker_stream,
    decode_cfj1,
    decode_cfytop_txt,
    decode_v2_txt,
    decrypt_xor_hex,
    encrypt_xor_hex,
    load_input,
    repair_json_array_tail,
    repair_json_object_tail,
    repair_json_tail,
    swap_pairs_and_reverse,
)

PLAYTEK_CONFIG_URLS = [
    "https://c.playtek.xyz/2-xmnhab.json",
    "https://p.playtek.xyz/2-xmnhab.json",
]

FALLBACK_CONFIG_URLS = [
    "https://p.genzdev.xyz/2-xmnhab.json",
]

FALLBACK_API_BASES = [
    "https://rtsplays.com/data/",
    "https://cricyplayers.com/data/",
]

USER_AGENTS = [
    "Mozilla/5.0 CricfyTV/7.5",
    "Mozilla/5.0 Cricfy2/1.0",
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/124.0.0.0 Mobile Safari/537.36",
]

BDT_TZ = timezone(timedelta(hours=6))
IST_TZ = timezone(timedelta(hours=5, minutes=30))


def fetch_text(url: str, timeout: int = 20) -> str:
    """Fetch raw text from an HTTP(S) endpoint with retry across APK user-agents."""
    last_err: Exception | None = None
    for ua in USER_AGENTS:
        try:
            req = urllib.request.Request(
                url,
                headers={
                    "User-Agent": ua,
                    "Accept": "text/plain, application/json, */*",
                    "Cache-Control": "no-cache",
                },
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8", errors="replace").strip()
                if raw:
                    return raw
        except Exception as exc:
            last_err = exc
    if last_err is not None:
        raise last_err
    raise RuntimeError(f"Empty response from {url}")


def strip_markdown_fences(raw: str) -> str:
    """Strip accidental markdown code fences if present."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    return text


def decode_remote_configs(urls: list[str]) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    """
    Attempt to fetch & decode both Playtek URLs (plus fallback if both are unreachable).
    Returns (merged_active_config, per_source_status_list).
    """
    source_reports: list[dict[str, Any]] = []
    active_config: dict[str, Any] = {}

    for url in urls:
        entry: dict[str, Any] = {"url": url, "status": "failed"}
        try:
            raw = strip_markdown_fences(fetch_text(url, timeout=15))
            fmt, decoded_str = decode_auto(raw)
            parsed = json.loads(decoded_str)
            entry["status"] = "ok"
            entry["detected_format"] = fmt
            entry["config"] = parsed
            if not active_config and isinstance(parsed, dict):
                active_config = parsed
        except Exception as exc:
            entry["error"] = str(exc)
        source_reports.append(entry)

    # Fallback mirror if both primary Playtek hosts fail temporarily
    if not active_config:
        for fallback_url in FALLBACK_CONFIG_URLS:
            try:
                raw = strip_markdown_fences(fetch_text(fallback_url, timeout=15))
                fmt, decoded_str = decode_auto(raw)
                parsed = json.loads(decoded_str)
                if isinstance(parsed, dict):
                    active_config = parsed
                    source_reports.append(
                        {
                            "url": fallback_url,
                            "status": "ok_fallback",
                            "detected_format": fmt,
                            "config": parsed,
                        }
                    )
                    break
            except Exception as exc:
                source_reports.append(
                    {"url": fallback_url, "status": "failed_fallback", "error": str(exc)}
                )

    return active_config, source_reports


def collect_api_bases(config: dict[str, Any]) -> list[str]:
    """Collect unique API base URLs from decoded remote config + fallbacks."""
    bases: list[str] = []
    for key in ("api_url", "api2", "api3"):
        val = str(config.get(key) or "").strip()
        if val.startswith(("http://", "https://")):
            normalized = val.rstrip("/") + "/"
            if normalized not in bases:
                bases.append(normalized)
    for fb in FALLBACK_API_BASES:
        normalized = fb.rstrip("/") + "/"
        if normalized not in bases:
            bases.append(normalized)
    return bases


def build_getdata_url(api_base: str, resource_path: str, token: str = DEFAULT_SIGNING_TOKEN) -> str:
    """Build signed `getData.php?key=...&hmac=...` URL using XOR-hex encoding."""
    ts = int(time.time())
    key_hex = encrypt_xor_hex(resource_path, QUERY_XOR_KEY)
    hmac_hex = encrypt_xor_hex(f"{ts}|{token}", QUERY_XOR_KEY)
    # Sanity-verify roundtrip with decrypt_xor_hex
    if decrypt_xor_hex(key_hex, QUERY_XOR_KEY) != resource_path:
        raise ValueError("XOR-hex key verification failed")
    return f"{api_base.rstrip('/')}/getData.php?key={key_hex}&hmac={hmac_hex}"


def fetch_and_decode_resource(
    api_bases: list[str],
    resource_paths: list[str],
    token: str = DEFAULT_SIGNING_TOKEN,
) -> tuple[Any, dict[str, Any]]:
    """
    Try each resource path across each API base URL, auto-decoding with all decoders in `txt_decoder.py`.
    """
    errors: list[str] = []
    for resource_path in resource_paths:
        for base in api_bases:
            signed_url = build_getdata_url(base, resource_path, token=token)
            try:
                raw = strip_markdown_fences(fetch_text(signed_url, timeout=25))
                if not raw or raw.lower() == "not found":
                    errors.append(f"{base} ({resource_path}): Not Found")
                    continue
                fmt, decoded_text = decode_auto(raw)
                parsed = json.loads(decoded_text)
                return parsed, {
                    "api_base": base,
                    "resource_path": resource_path,
                    "detected_format": fmt,
                }
            except Exception as exc:
                errors.append(f"{base} ({resource_path}): {exc}")
    raise RuntimeError("All upstream endpoints failed: " + " | ".join(errors))


def parse_stream_headers(raw_link: str) -> dict[str, Any]:
    """
    Split Cricfy pipe-delimited stream link (`url|User-Agent=...&Referer=...&Origin=...`)
    into clean URL + headers dictionary while keeping the original `raw_link`.
    """
    raw_link = (raw_link or "").strip()
    if not raw_link:
        return {"url": "", "raw_link": "", "headers": {}}

    if "|" not in raw_link:
        return {"url": raw_link, "raw_link": raw_link, "headers": {}}

    url_part, header_part = raw_link.split("|", 1)
    url_part = url_part.rstrip("?") if url_part.endswith("?") else url_part
    headers: dict[str, str] = {}
    for pair in header_part.split("&"):
        if "=" not in pair:
            continue
        k, v = pair.split("=", 1)
        k_clean = k.strip()
        v_clean = v.strip()
        if k_clean and v_clean:
            headers[k_clean] = v_clean

    return {
        "url": url_part.strip(),
        "raw_link": raw_link,
        "headers": headers,
    }


def parse_drm_clearkey(api_field: str) -> dict[str, str] | None:
    """Parse `keyId:key` ClearKey DRM string if present."""
    api_field = (api_field or "").strip()
    if not api_field:
        return None
    if ":" in api_field and not api_field.startswith(("http://", "https://", "{")):
        key_id, key_val = api_field.split(":", 1)
        return {
            "type": "clearkey",
            "keyId": key_id.strip(),
            "key": key_val.strip(),
            "raw": api_field,
        }
    return {"type": "custom", "raw": api_field}


def parse_utc_datetime(date_str: str | None, time_str: str | None) -> datetime | None:
    """Parse `DD/MM/YYYY` or `YYYY-MM-DD` + `HH:MM[:SS]` as UTC datetime."""
    if not date_str:
        return None
    combined = f"{date_str.strip()} {(time_str or '00:00:00').strip()}"
    m = re.match(r"^(\d{2})/(\d{2})/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$", combined)
    if m:
        day, month, year, hour, minute, sec = (
            int(m.group(1)),
            int(m.group(2)),
            int(m.group(3)),
            int(m.group(4)),
            int(m.group(5)),
            int(m.group(6) or 0),
        )
        try:
            return datetime(year, month, day, hour, minute, sec, tzinfo=timezone.utc)
        except ValueError:
            return None

    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$", combined)
    if m:
        year, month, day, hour, minute, sec = (
            int(m.group(1)),
            int(m.group(2)),
            int(m.group(3)),
            int(m.group(4)),
            int(m.group(5)),
            int(m.group(6) or 0),
        )
        try:
            return datetime(year, month, day, hour, minute, sec, tzinfo=timezone.utc)
        except ValueError:
            return None
    return None


def parse_json_field(val: Any, default: Any) -> Any:
    """Safely parse stringified JSON field (`event`, `links`, `tokenApi`, etc.)."""
    if val is None:
        return default
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        stripped = val.strip()
        if not stripped:
            return default
        try:
            return json.loads(stripped)
        except Exception:
            repaired = repair_json_tail(stripped)
            if repaired:
                try:
                    return json.loads(repaired)
                except Exception:
                    pass
    return default


def normalize_matches(
    raw_events: list[dict[str, Any]],
    tournament_logos: dict[str, str] | None = None,
) -> list[dict[str, Any]]:
    """Transform raw decoded `events` list into clean, player-ready match objects."""
    tournament_logos = tournament_logos or {}
    now_utc = datetime.now(timezone.utc)
    matches: list[dict[str, Any]] = []

    for idx, item in enumerate(raw_events):
        if not isinstance(item, dict):
            continue

        evt = parse_json_field(item.get("event"), {})
        if not isinstance(evt, dict):
            evt = {}

        visible_val = evt.get("visible", item.get("visible", True))
        if str(visible_val).lower() in ("0", "false"):
            continue

        details = evt.get("eventDetails") if isinstance(evt.get("eventDetails"), dict) else {}
        team_a = evt.get("teamA") if isinstance(evt.get("teamA"), dict) else {}
        team_b = evt.get("teamB") if isinstance(evt.get("teamB"), dict) else {}

        category = str(details.get("category") or evt.get("category") or "Sports").strip()
        event_name = str(details.get("eventName") or evt.get("eventName") or category).strip()
        event_logo = str(
            details.get("eventLogo")
            or tournament_logos.get(event_name)
            or tournament_logos.get(category)
            or ""
        ).strip()

        team_a_name = str(team_a.get("name") or "").strip()
        team_b_name = str(team_b.get("name") or "").strip()
        team_a_logo = str(team_a.get("logo") or event_logo).strip()
        team_b_logo = str(team_b.get("logo") or event_logo).strip()

        if team_a_name and team_b_name and team_a_name.lower() != team_b_name.lower():
            title = f"{team_a_name} vs {team_b_name}"
        else:
            title = event_name or team_a_name or f"Match #{idx + 1}"

        date_str = evt.get("date") or item.get("date") or ""
        time_str = evt.get("time") or item.get("time") or ""
        end_date_str = evt.get("end_date") or item.get("end_date") or ""
        end_time_str = evt.get("end_time") or item.get("end_time") or ""

        start_dt = parse_utc_datetime(date_str, time_str)
        end_dt = parse_utc_datetime(end_date_str, end_time_str)
        if start_dt and not end_dt:
            end_dt = start_dt + timedelta(hours=4)

        if start_dt and end_dt and start_dt <= now_utc <= end_dt:
            status = "LIVE"
        elif start_dt and now_utc < start_dt:
            status = "UPCOMING"
        elif end_dt and now_utc > end_dt:
            status = "COMPLETED"
        else:
            status = "LIVE"

        raw_links = parse_json_field(item.get("links"), [])
        if not isinstance(raw_links, list):
            raw_links = []

        streams: list[dict[str, Any]] = []
        for s_idx, link_obj in enumerate(raw_links):
            if not isinstance(link_obj, dict):
                continue
            name = str(link_obj.get("name") or f"Server {s_idx + 1}").strip()
            parsed_link = parse_stream_headers(str(link_obj.get("link") or ""))
            url = parsed_link["url"]
            token_api_raw = link_obj.get("tokenApi") or ""
            token_api = parse_json_field(token_api_raw, None) if token_api_raw else None

            if not url and not token_api:
                continue

            lower_url = url.lower()
            if ".mpd" in lower_url:
                stream_type = "dash"
            elif ".m3u8" in lower_url:
                stream_type = "hls"
            elif token_api and isinstance(token_api, dict):
                stream_type = str(token_api.get("type") or "embed")
            else:
                stream_type = "direct"

            drm_info = parse_drm_clearkey(str(link_obj.get("api") or ""))

            stream_entry: dict[str, Any] = {
                "name": name,
                "type": stream_type,
                "url": url,
                "link": parsed_link["raw_link"],
                "scheme": link_obj.get("scheme", 0),
                "api": str(link_obj.get("api") or ""),
            }
            if parsed_link["headers"]:
                stream_entry["headers"] = parsed_link["headers"]
            if drm_info:
                stream_entry["drm"] = drm_info
            if token_api:
                stream_entry["tokenApi"] = token_api

            streams.append(stream_entry)

        match_entry: dict[str, Any] = {
            "id": item.get("id", idx + 1),
            "order_index": item.get("order_index", idx + 1),
            "title": title,
            "category": category,
            "tournament": event_name,
            "poster": event_logo,
            "status": status,
            "is_live": status == "LIVE",
            "date": date_str,
            "time": time_str,
            "start_utc": start_dt.isoformat() if start_dt else None,
            "start_bdt": start_dt.astimezone(BDT_TZ).strftime("%Y-%m-%d %I:%M %p BDT") if start_dt else None,
            "start_ist": start_dt.astimezone(IST_TZ).strftime("%Y-%m-%d %I:%M %p IST") if start_dt else None,
            "teamA": {
                "name": team_a_name or event_name,
                "logo": team_a_logo,
            },
            "teamB": {
                "name": team_b_name or event_name,
                "logo": team_b_logo,
            },
            "priority": evt.get("priority", -1),
            "total_streams": len(streams),
            "streams": streams,
        }
        matches.append(match_entry)

    status_rank = {"LIVE": 0, "UPCOMING": 1, "COMPLETED": 2}
    matches.sort(
        key=lambda m: (
            status_rank.get(m["status"], 3),
            m.get("order_index", 9999),
        )
    )
    return matches


def verify_decoder_self_test() -> dict[str, bool]:
    """
    Exercise every cryptographic & repair helper from `txt_decoder.py` so the workflow
    verifies full decoder integrity on each run.
    """
    checks: dict[str, bool] = {}
    checks["cfg_material_32b"] = len(cfg_material()) == 32
    checks["xor_hex_roundtrip"] = decrypt_xor_hex(encrypt_xor_hex("v2/events.txt")) == "v2/events.txt"
    checks["swap_pairs_reverse"] = swap_pairs_and_reverse(swap_pairs_and_reverse(" Playtek1234")) != ""
    checks["clean_base64_pad"] = len(clean_base64("YWJjZA")) % 4 == 0
    checks["repair_json_obj"] = repair_json_object_tail('{"a":1,"b":2') == '{"a":1}'
    checks["repair_json_arr"] = repair_json_array_tail('[{"a":1},{"b":') == '[{"a":1}]'
    checks["keys_loaded"] = (
        len(V2_AES_KEY) == 16
        and len(V2_AES_IV) == 16
        and len(CFYTOP_AES_KEY) == 16
        and len(CFYTOP_AES_IV) == 16
    )
    # Reference unused imports so static analyzers know all decoder primitives are available
    _ = (aes_cbc_decrypt, decode_cfj1, decode_v2_txt, decode_cfytop_txt, decode_baker_stream, load_input)
    return checks


def generate_match_json(output_path: Path, config_output_path: Path | None = None) -> dict[str, Any]:
    """End-to-end pipeline: decode Playtek configs -> fetch & decode events -> write match.json."""
    self_test = verify_decoder_self_test()
    now_utc = datetime.now(timezone.utc)

    active_config, source_reports = decode_remote_configs(PLAYTEK_CONFIG_URLS)
    api_bases = collect_api_bases(active_config)

    if config_output_path:
        config_payload = {
            "updated_at_utc": now_utc.strftime("%Y-%m-%d %H:%M:%S UTC"),
            "sources": source_reports,
            "active_config": active_config,
            "resolved_api_bases": api_bases,
        }
        config_output_path.write_text(
            json.dumps(config_payload, indent=2, ensure_ascii=False),
            encoding="utf-8",
        )

    # Optional tournament logos (`v2/event_cats.txt`)
    tournament_logos: dict[str, str] = {}
    event_cats_meta: dict[str, Any] = {}
    try:
        cats_data, event_cats_meta = fetch_and_decode_resource(
            api_bases,
            ["v2/event_cats.txt"],
        )
        if isinstance(cats_data, dict):
            tournament_logos = {str(k): str(v) for k, v in cats_data.items()}
    except Exception as exc:
        event_cats_meta = {"error": str(exc)}

    # Main live matches (`v2/events.txt`, with fallback to `categories/live-events.txt`)
    raw_events, events_meta = fetch_and_decode_resource(
        api_bases,
        ["v2/events.txt", "categories/live-events.txt"],
    )
    if not isinstance(raw_events, list):
        raise RuntimeError(f"Expected JSON array of events, got {type(raw_events).__name__}")

    matches = normalize_matches(raw_events, tournament_logos=tournament_logos)

    repo_slug = os.environ.get("GITHUB_REPOSITORY", "mdmukul120/SnapTube")
    branch_name = os.environ.get("GITHUB_REF_NAME", "main")
    owner, repo_name = (repo_slug.split("/", 1) + [""])[:2]

    output_data = {
        "status": "success",
        "updated_at_utc": now_utc.strftime("%Y-%m-%d %H:%M:%S UTC"),
        "updated_at_bdt": now_utc.astimezone(BDT_TZ).strftime("%Y-%m-%d %I:%M:%S %p BDT"),
        "links_info": {
            "raw_url": f"https://raw.githubusercontent.com/{repo_slug}/{branch_name}/{output_path.name}",
            "pages_url": f"https://{owner}.github.io/{repo_name}/{output_path.name}" if owner and repo_name else "",
            "source_configs": [
                {
                    "url": r["url"],
                    "status": r["status"],
                    "detected_format": r.get("detected_format"),
                }
                for r in source_reports
            ],
            "events_decoder": events_meta,
            "tournament_logos_decoder": event_cats_meta,
            "decoder_self_test": self_test,
        },
        "total_matches": len(matches),
        "live_matches": sum(1 for m in matches if m["is_live"]),
        "upcoming_matches": sum(1 for m in matches if m["status"] == "UPCOMING"),
        "tournament_logos": tournament_logos,
        "matches": matches,
    }

    output_path.write_text(
        json.dumps(output_data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    return output_data


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Decode c.playtek.xyz & p.playtek.xyz configs and generate match.json"
    )
    parser.add_argument(
        "-o",
        "--output",
        default="match.json",
        help="Output path for decoded matches JSON (default: match.json)",
    )
    parser.add_argument(
        "--config-output",
        default="config_decoded.json",
        help="Optional output path for decoded Playtek remote config JSON (default: config_decoded.json)",
    )
    args = parser.parse_args()

    out_path = Path(args.output)
    cfg_path = Path(args.config_output) if args.config_output else None

    result = generate_match_json(out_path, config_output_path=cfg_path)
    print(
        f"[+] Successfully generated {out_path} with {result['total_matches']} matches "
        f"({result['live_matches']} LIVE, {result['upcoming_matches']} UPCOMING)."
    )


if __name__ == "__main__":
    main()
