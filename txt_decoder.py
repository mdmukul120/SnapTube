#!/usr/bin/env python3
"""
CricfyTV APK (.txt / cfj1) Payload Decoder
Reverse-engineered from:
  1. cfj1: remote config decoder (cfgMaterial XOR + reverse) — c.playtek.xyz / p.playtek.xyz / 2-xmnhab.json
  2. Lz9/q7/b; (classes2.dex) — V2 Multi-stage .txt decoder (v2/events.txt, v2/categories.txt, channels/*.txt)
  3. Lcom/cricfytv/tv/remoteconfig/CfytopDirect; (classes4.dex) — Direct AES-CBC .txt decoder (categories/live-events.txt)
  4. Baker.merge SHA-256 stream cipher fallback (libnative-lib.so)

Usage:
  python3 txt_decoder.py <file_or_url_or_base64_string> [-o output.json]
"""

import argparse
import base64
import binascii
import hashlib
import json
import struct
import sys
import urllib.request
from pathlib import Path

try:
    from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
    from cryptography.hazmat.primitives import padding as sym_padding
    _HAS_CRYPTOGRAPHY = True
except ImportError:
    _HAS_CRYPTOGRAPHY = False
    from Crypto.Cipher import AES  # pycryptodome fallback


# --- Extracted Keys & Constants from APK ---
# Layer 1 (Remote Config & getData.php Query Codec)
DEFAULT_SIGNING_TOKEN = "8f4gha9affeegg7cigafdgc7hegfkefaicigdgg1haffhekgeeigcfgahedfhef"
QUERY_XOR_KEY = 90  # 0x5A

# Layer 2 (Lz9/q7/b; V2 Decoder)
V2_AES_KEY = b"WT1sdkEvUlR4ckd2"   # Derived from SHA256(CERT:ENTRY:SALT)[:16] ^ MASK
V2_AES_IV  = b"Q7sKcm9LR4VaX2pN"
V2_TRAILER = "abcdefghijklmnop"

# Layer 4 (CfytopDirect Decoder)
CFYTOP_AES_KEY = b"3hHzxYAgSGI8/ham"
CFYTOP_AES_IV  = b"UqCvkvjecEIz842V"


def encrypt_xor_hex(text: str, xor_key: int = QUERY_XOR_KEY) -> str:
    """Encode query parameters (`key` and `hmac`) for getData.php via XOR + hex."""
    data = text.encode("utf-8")
    encrypted = bytes([b ^ xor_key for b in data])
    return binascii.hexlify(encrypted).decode("utf-8")


def decrypt_xor_hex(hex_str: str, xor_key: int = QUERY_XOR_KEY) -> str:
    """Decode XOR-hex query parameters back to UTF-8 string."""
    raw = binascii.unhexlify(hex_str.strip())
    return bytes([b ^ xor_key for b in raw]).decode("utf-8")


def cfg_material() -> bytearray:
    """Generate the 32-byte keystream material for `cfj1:` remote config payloads."""
    b_arr = [29, 88, 17, 104, 66, 7, 91, 34, 113, 5, 47, 96]
    b_arr2 = [71, 12, 83, 44, 9, 121, 36, 58, 101, 22, 63]
    b_arr3 = [6, 39, 95, 14, 74, 52, 117, 27, 68, 3, 86, 41, 109]
    out = bytearray(32)
    for i in range(32):
        i10 = b_arr[i % 12] & 0xFF
        i11 = b_arr2[((i * 3) + 1) % 11] & 0xFF
        i12 = i & 7
        shift_r = 8 - i12
        term1 = (i11 & 0xFFFFFFFF) >> shift_r
        term2 = (i11 << i12) & 0xFFFFFFFF
        rotated = (term1 | term2) & 0xFF
        val = (((i10 ^ rotated) ^ (b_arr3[((i * 5) + 2) % 13] & 0xFF)) ^ 90) ^ i
        out[i] = val & 0xFF
    return out


def decode_cfj1(encoded_txt: str) -> str:
    """
    Decode `cfj1:` remote config format (used by c.playtek.xyz / p.playtek.xyz / 2-xmnhab.json).
    """
    text = encoded_txt.strip()
    if text.startswith("cfj1:"):
        text = text[5:]
    compact = "".join(text.split())
    raw = base64.b64decode(clean_base64(compact))
    material = cfg_material()
    out = bytearray(len(raw))
    for i, byte_val in enumerate(raw):
        val = ((material[i % len(material)] ^ byte_val) ^ (((i * 29) + 71) & 0xFF)) & 0xFF
        out[len(raw) - 1 - i] = val
    decoded = out.decode("utf-8", errors="replace").strip()
    repaired = repair_json_tail(decoded)
    return repaired if repaired else decoded


def decode_baker_stream(encoded_txt: str) -> str:
    """
    Decode Baker.merge SHA-256 counter-XOR stream format (libnative-lib.so fallback).
    """
    raw = base64.b64decode(clean_base64(encoded_txt.strip()))
    if len(raw) <= 16:
        raise ValueError("Input too short for Baker stream")
    key = raw[:16]
    ciphertext = raw[16:]
    stream = bytearray()
    block_idx = 0
    while len(stream) < len(ciphertext):
        stream.extend(hashlib.sha256(key + struct.pack(">I", block_idx)).digest())
        block_idx += 1
    plain = bytes(a ^ b for a, b in zip(ciphertext, stream)).decode("utf-8")
    stripped = plain.strip()
    if not stripped.startswith(("{", "[")):
        raise ValueError("Baker output is not JSON")
    return stripped


def aes_cbc_decrypt(ciphertext: bytes, key: bytes, iv: bytes) -> bytes:
    """Decrypt AES-128-CBC with PKCS5/PKCS7 unpadding."""
    if _HAS_CRYPTOGRAPHY:
        cipher = Cipher(algorithms.AES(key), modes.CBC(iv))
        decryptor = cipher.decryptor()
        padded = decryptor.update(ciphertext) + decryptor.finalize()
        unpadder = sym_padding.PKCS7(128).unpadder()
        return unpadder.update(padded) + unpadder.finalize()
    else:
        cipher = AES.new(key, AES.MODE_CBC, iv)
        padded = cipher.decrypt(ciphertext)
        pad_len = padded[-1]
        if pad_len < 1 or pad_len > 16 or padded[-pad_len:] != bytes([pad_len]) * pad_len:
            raise ValueError("Invalid PKCS7 padding")
        return padded[:-pad_len]


def swap_pairs_and_reverse(text: str) -> str:
    """Equivalent to Lz9/q7/b;->swapPairs([C) followed by reverse([C)."""
    chars = list(text)
    for i in range(0, len(chars) - 1, 2):
        chars[i], chars[i + 1] = chars[i + 1], chars[i]
    chars.reverse()
    return "".join(chars)


def clean_base64(text: str) -> str:
    """Equivalent to Lz9/q7/b;->cleanBase64(String)."""
    allowed = [
        ch for ch in text
        if ("A" <= ch <= "Z") or ("a" <= ch <= "z") or ("0" <= ch <= "9") or ch in ("+", "/")
    ]
    rem = len(allowed) % 4
    if rem:
        allowed.extend("=" * (4 - rem))
    return "".join(allowed)


def repair_json_object_tail(s: str) -> str:
    """Equivalent to Lz9/q7/b;->repairJsonObjectTail(String)."""
    last_comma = -1
    in_str = False
    esc = False
    depth = 0
    for i, ch in enumerate(s):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in ("{", "["):
            depth += 1
        elif ch in ("}", "]"):
            depth -= 1
            if depth == 0 and ch == "}":
                return s[: i + 1]
        elif ch == "," and depth == 1:
            last_comma = i
    if last_comma > 0:
        return s[:last_comma] + "}"
    return ""


def repair_json_array_tail(s: str) -> str:
    """Equivalent to Lz9/q7/b;->repairJsonArrayTail(String)."""
    last_obj_end = -1
    first_nested = -1
    in_str = False
    esc = False
    depth = 0
    for i, ch in enumerate(s):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in ("{", "["):
            if depth == 1 and first_nested < 0:
                first_nested = i
            depth += 1
        elif ch in ("}", "]"):
            depth -= 1
            if depth == 1 and ch == "}":
                last_obj_end = i
            elif depth == 0 and ch == "]":
                return s[: i + 1]
    if last_obj_end > 0:
        return s[: last_obj_end + 1] + "]"
    if first_nested >= 0:
        repaired = repair_json_object_tail(s[first_nested:])
        if repaired:
            return "[" + repaired + "]"
    return ""


def repair_json_tail(s: str) -> str:
    """Equivalent to Lz9/q7/b;->repairJsonTail(String)."""
    s = s.strip()
    if s.startswith("["):
        return repair_json_array_tail(s)
    if s.startswith("{"):
        return repair_json_object_tail(s)
    return s


def decode_v2_txt(encoded_txt: str, key: bytes = V2_AES_KEY, iv: bytes = V2_AES_IV) -> str:
    """
    Decode Layer-2 V2 .txt format (Lz9/q7/b;->decodeV2).
    Pipeline:
      Base64 -> UTF-8 -> swapPairs -> reverse -> strip 'abcdefghijklmnop'
      -> Base64 -> AES-CBC(WT1sdkEvUlR4ckd2, Q7sKcm9LR4VaX2pN) -> UTF-8
      -> swapPairs -> reverse -> cleanBase64 -> Base64 -> UTF-8 -> repairJsonTail
    """
    stage1_bytes = base64.b64decode(clean_base64(encoded_txt.strip()))
    stage1_str = swap_pairs_and_reverse(stage1_bytes.decode("utf-8"))

    if not stage1_str.endswith(V2_TRAILER):
        raise ValueError("Missing V2 trailer ('abcdefghijklmnop')")

    stage2_b64 = stage1_str[: -len(V2_TRAILER)]
    cipher_bytes = base64.b64decode(clean_base64(stage2_b64))

    decrypted_bytes = aes_cbc_decrypt(cipher_bytes, key, iv)
    stage3_str = swap_pairs_and_reverse(decrypted_bytes.decode("utf-8"))

    final_b64 = clean_base64(stage3_str)
    plain_json = base64.b64decode(final_b64).decode("utf-8", errors="replace")
    repaired = repair_json_tail(plain_json)
    return repaired if repaired else plain_json


def decode_cfytop_txt(encoded_txt: str, key: bytes = CFYTOP_AES_KEY, iv: bytes = CFYTOP_AES_IV) -> str:
    """
    Decode Layer-4 CfytopDirect .txt format (CfytopDirect.getDecrypted).
    Pipeline:
      Base64 -> AES-CBC(3hHzxYAgSGI8/ham, UqCvkvjecEIz842V) -> UTF-8 -> unwrap JSON string quotes (up to 4x)
    """
    cipher_bytes = base64.b64decode(clean_base64(encoded_txt.strip()))
    plain = aes_cbc_decrypt(cipher_bytes, key, iv).decode("utf-8").strip()

    for _ in range(4):
        if plain.startswith('"'):
            plain = json.loads(plain).strip()
        else:
            break
    repaired = repair_json_tail(plain)
    return repaired if repaired else plain


def decode_auto(raw_text: str) -> tuple[str, str]:
    """Auto-detect plain JSON, cfj1 config, V2 .txt format, CfytopDirect AES, or Baker stream."""
    stripped = raw_text.strip()
    if stripped.startswith(("{", "[")):
        repaired = repair_json_tail(stripped)
        return "plain_json", repaired if repaired else stripped

    # 1. Explicit cfj1: remote config
    if stripped.startswith("cfj1:"):
        return "cfj1_config", decode_cfj1(stripped)

    # 2. Try V2 multi-stage decoder (Lz9/q7/b;)
    try:
        return "v2_z9_q7_b", decode_v2_txt(stripped)
    except Exception:
        pass

    # 3. Try CfytopDirect AES-CBC decoder
    try:
        return "cfytop_aes", decode_cfytop_txt(stripped)
    except Exception:
        pass

    # 4. Try cfj1 without prefix (in case prefix was stripped)
    try:
        candidate = decode_cfj1(stripped)
        json.loads(candidate)
        return "cfj1_config_unprefixed", candidate
    except Exception:
        pass

    # 5. Try Baker SHA-256 stream cipher fallback
    try:
        return "baker_sha256_stream", decode_baker_stream(stripped)
    except Exception as exc:
        raise ValueError(f"Unable to decode input with known Cricfy/Playtek formats: {exc}") from exc


def load_input(target: str, timeout: int = 20) -> str:
    if target.startswith(("http://", "https://")):
        req = urllib.request.Request(
            target,
            headers={
                "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36",
                "Accept": "text/plain, application/json, */*",
            },
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.read().decode("utf-8", errors="replace")
    p = Path(target)
    if p.is_file():
        return p.read_text(encoding="utf-8", errors="replace")
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description="Decode CricfyTV / Playtek encrypted payloads (.txt / cfj1)")
    parser.add_argument("input", help="Path to file, HTTP(S) URL, cfj1:... string, or raw Base64 string")
    parser.add_argument("-o", "--output", help="Optional output file path to save decoded JSON")
    args = parser.parse_args()

    raw = load_input(args.input)
    fmt, decoded = decode_auto(raw)

    # Pretty-print if valid JSON
    try:
        parsed = json.loads(decoded)
        formatted = json.dumps(parsed, indent=2, ensure_ascii=False)
    except Exception:
        formatted = decoded

    print(f"[+] Detected format: {fmt}", file=sys.stderr)
    if args.output:
        Path(args.output).write_text(formatted, encoding="utf-8")
        print(f"[+] Saved decoded output to: {args.output}", file=sys.stderr)
    else:
        print(formatted)


if __name__ == "__main__":
    main()
