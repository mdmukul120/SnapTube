#!/usr/bin/env python3
"""Extract the full catalogue (collections, latest imports, spotlight, fest wall,
navigation taxonomy) from the archived CTGMovies HTML snapshot into JSON data
consumed by the Next.js app."""
import json
import re
import html as htmllib
from pathlib import Path

SRC = Path("/tmp/source.html")
OUT = Path(__file__).resolve().parents[1] / "data" / "catalog.json"

raw = SRC.read_text(encoding="utf-8", errors="replace")


def text(fragment: str) -> str:
    return re.sub(r"\s+", " ", htmllib.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def slug_of(href: str) -> str:
    return href.rstrip("/").split("/")[-1]


def kind_of(href: str) -> str:
    if href.startswith("/tv/"):
        return "series"
    if href.startswith("/games/"):
        return "game"
    if href.startswith("/anime/"):
        return "anime"
    return "movie"


def to_int(value: str) -> int:
    return int(re.sub(r"[^\d]", "", value) or 0)


# ---------------------------------------------------------------- collections
COLLECTION_META = {
    "English Movies": ("english", "English", "movie"),
    "Hindi Movies": ("hindi", "Hindi", "movie"),
    "South Indian Movies": ("south-indian", "South Indian", "movie"),
    "Asian Movies": ("asian", "Asian", "movie"),
    "European Movies": ("european", "European", "movie"),
    "TV SHOWS": ("tv", "TV Shows", "series"),
    "Games": ("games", "Games", "game"),
}

sections = [
    (m.start(), m.group(1).strip(), to_int(m.group(2)))
    for m in re.finditer(
        r"▌ Collection.{1,900}?<h3[^>]*>([^<]+)</h3>.{0,900}?<b[^>]*>([\d,]+)</b>", raw, re.S
    )
]

card_re = re.compile(r'<a class="block shrink-0 w-\[136px\]" href="([^"]+)">(.*?)</a>', re.S)

collections = []
buckets = {name: [] for _, name, _ in sections}
for m in card_re.finditer(raw):
    href, inner = m.group(1), m.group(2)
    owner = None
    for pos, name, _count in sections:
        if pos < m.start():
            owner = name
        else:
            break
    if owner is None:
        continue
    images = re.findall(r'<img src="([^"]*)" data-fallback="([^"]*)" alt="([^"]*)"', inner)
    src, fallback, alt = images[0] if images else ("", "", "")
    quality = re.search(r'transform:scale\(0\.78\)"><span[^>]*>([^<]+)</span>', inner)
    views = re.search(r'aria-label="([\d,]+) views"', inner)
    title = re.search(
        r'font-size:13px;line-height:1\.05;margin-top:7px">([^<]*)</div>'
        r'<div class="font-mono" style="font-size:9px[^>]*>([^<]*)</div>',
        inner,
    )
    buckets[owner].append(
        {
            "slug": slug_of(href),
            "title": htmllib.unescape(title.group(1)) if title else htmllib.unescape(alt),
            "year": (title.group(2) if title else "").strip(),
            "quality": quality.group(1).strip() if quality else "1080p",
            "views": to_int(views.group(1)) if views else 0,
            "poster": fallback or src,
            "thumb": src,
            "kind": kind_of(href),
            "href": href,
        }
    )

for _pos, name, count in sections:
    key, label, kind = COLLECTION_META.get(name, (slug_of(name).lower(), name, "movie"))
    collections.append(
        {
            "key": key,
            "name": name,
            "label": label,
            "kind": kind,
            "count": count,
            "items": buckets.get(name, []),
        }
    )

# ------------------------------------------------------------- latest imports
latest_start = raw.find("LATEST IMPORTS")
latest_cards = re.split(
    r'(?=<a class="group block relative overflow-hidden border)', raw[latest_start:]
)[1:]
latest = []
for chunk in latest_cards:
    head = re.match(
        r'<a class="group block relative overflow-hidden border[^"]*" style="[^"]*" href="([^"]+)"',
        chunk,
    )
    if not head:
        continue
    href = head.group(1)
    images = re.findall(
        r'<img src="([^"]*)"(?:\s+data-fallback="([^"]*)")?[^>]*alt="([^"]*)"', chunk
    )
    poster = next((fb or src for src, fb, alt in images if alt), None)
    backdrop = None
    if len(images) > 1:
        backdrop = images[1][1] or images[1][0]
    views = re.search(r'aria-label="([\d,]+) views"', chunk)
    quality = re.search(r'>(\d{3,4}p [^<]{1,18})</span>', chunk)
    lang = re.search(r'text-\[10px\] font-mono uppercase[^>]*>([^<]+)<', chunk)
    if not lang:
        lang = re.search(r'>\s*([A-Za-z][A-Za-z ]{2,24})\s*</span>\s*</div>', chunk)
    title_html = re.search(r"<h3[^>]*>(.*?)</h3>", chunk, re.S)
    full = ""
    if title_html:
        inner_title = title_html.group(1)
        # pull the year out of the nested <span> before stripping tags slashes the text
        year_span = re.search(r"<span[^>]*>\D*?(\d{4})", inner_title)
        year = year_span.group(1) if year_span else ""
        full = text(re.sub(r"<span[^>]*>.*?</span>", "", inner_title, flags=re.S))
    # the source nests the year in a span with react comments -> "Title ( 2026 )"
    full = re.sub(r"\(\s*(\d{4})\s*\)", r"(\1)", full).strip()
    if not year:
        ym = re.match(r"(.*?)\((\d{4})\)$", full)
        if ym:
            full, year = ym.group(1).strip(), ym.group(2)
    kind = re.search(r">(MOVIE|SERIES|GAME|ANIME)</span>", chunk)
    description = re.search(r'line-clamp-\d+[^>]*>([^<]{40,})<', chunk)
    stars = len(re.findall(r'stop offset="100%"', chunk))
    language = htmllib.unescape(lang.group(1)).strip() if lang else "English"
    accent = re.search(
        r'<div class="p-3[^"]*" style="background:(#[0-9a-f]{6});color:(#[0-9a-f]{6})"', chunk
    )
    if language in {"MOVIE", "SERIES", "GAME", "ANIME"}:
        language = "English"
    latest.append(
        {
            "slug": slug_of(href),
            "href": href,
            "title": full,
            "year": year,
            "kind": (kind.group(1).lower() if kind else kind_of(href)),
            "language": language,
            "quality": quality.group(1).strip() if quality else "1080p WebRip",
            "views": to_int(views.group(1)) if views else 0,
            "poster": poster or "",
            "backdrop": backdrop or poster or "",
            "description": htmllib.unescape(description.group(1)).strip() if description else "",
            "rating": round(stars * 0.5, 1) if stars else None,
            "accent": accent.group(1) if accent else "#0369a1",
            "onAccent": accent.group(2) if accent else "#f0f9ff",
        }
    )

# ------------------------------------------------------------------- spotlight
spotlight = []
hero = re.search(
    r'SPOTLIGHT · .{0,120}?<h2[^>]*>([^<]+)</h2>(.*?)</section>', raw, re.S
)
if hero:
    body = hero.group(2)
    chips = re.findall(r'tracking-wider"[^>]*>([^<]+)</span>', body)
    desc = re.search(r'<p[^>]*>([^<]{40,})</p>', body)
    poster = re.search(r'<img src="([^"]*)" data-fallback="([^"]*)" alt="([^"]*)"', body)
    spotlight.append(
        {
            "slug": "the-lord-of-the-rings-the-rings-of-power",
            "href": "/tv/the-lord-of-the-rings-the-rings-of-power",
            "title": htmllib.unescape(hero.group(1)),
            "chips": [htmllib.unescape(c) for c in chips],
            "description": htmllib.unescape(desc.group(1)) if desc else "",
            "poster": (poster.group(2) or poster.group(1)) if poster else "",
            "backdrop": "",
            "kind": "series",
        }
    )

# --------------------------------------------------------------- featured rail
featured = []
for m in re.finditer(
    r'url\((https://image\.tmdb\.org/t/p/w500/[^)]+)\).{0,3000}?'
    r'▌ Featured</div><h2[^>]*>([^<]+)</h2><div[^>]*>([^<]+)</div>',
    raw,
    re.S,
):
    poster, name, meta = m.group(1), htmllib.unescape(m.group(2)), htmllib.unescape(m.group(3))
    year = (re.match(r"(\d{4})", meta.strip()) or [None, ""])[1]
    rating = re.search(r"★ ([\d.]+)", meta)
    quality = re.sub(r"^\s*\d{4}\s*·\s*", "", meta)
    quality = re.sub(r"★ [\d.]+\s*·?\s*", "", quality).strip()
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    featured.append(
        {
            "title": name,
            "year": year,
            "rating": float(rating.group(1)) if rating else None,
            "quality": quality or "1080p",
            "poster": poster,
            "slug": slug,
            "kind": "series" if name.startswith("The Lord") else "movie",
        }
    )

# -------------------------------------------------------------------- fest wall
fest = []
fest_block = raw[raw.find('aria-label="MCU Fest"') : raw.find('aria-label="MCU Fest"') + 60000]
for m in re.finditer(
    r'width:120px;height:180px;border-radius:10px[^>]*><img src="([^"]*)" data-fallback="([^"]*)"',
    fest_block,
):
    fest.append(m.group(2) or m.group(1))

# ------------------------------------------------- featured: real view counts
by_title = {}
for collection in collections:
    for entry in collection["items"]:
        by_title.setdefault(entry["title"].lower(), entry)
for entry in featured:
    match = by_title.get(entry["title"].lower())
    entry["views"] = match["views"] if match else 0
    entry["language"] = match.get("language", "") if match else ""

# --------------------------------------------------------------------- taxonomy
genres = [
    (m.group(1), m.group(2))
    for m in re.finditer(r'href="/genre/([a-z-]+)">([^<]+)</a>', raw)
]
seen = set()
genre_list = []
for slug, name in genres:
    if slug in seen:
        continue
    seen.add(slug)
    genre_list.append({"slug": slug, "name": htmllib.unescape(name)})

collections_nav = []
for m in re.finditer(
    r'/movies\?collection=([a-f0-9]{24})&amp;collectionName=([A-Za-z%0-9]+)', raw
):
    collections_nav.append(
        {"id": m.group(1), "name": htmllib.unescape(m.group(2).replace("%20", " "))}
    )
uniq = {}
for c in collections_nav:
    uniq[c["id"]] = c

decades = sorted({m.group(1) for m in re.finditer(r'href="/decade/([0-9]{4}s)"', raw)})
languages = sorted({m.group(1) for m in re.finditer(r"/movies\?language=([a-z]+)", raw)})

data = {
    "site": {
        "name": "CTGMovies",
        "tagline": "Your Own World of Entertainment",
        "mirror": "mobile.ctgmovies.com",
        "years": "2016-2026",
    },
    "spotlight": spotlight,
    "featured": featured,
    "collections": collections,
    "latest": latest,
    "fest": {"title": "MCU Fest", "posterWall": fest[:24]},
    "taxonomy": {
        "genres": genre_list,
        "collections": list(uniq.values()),
        "decades": decades,
        "languages": languages,
    },
}

OUT.write_text(json.dumps(data, indent=1, ensure_ascii=False), encoding="utf-8")

print(f"collections : {len(collections)} ({sum(len(c['items']) for c in collections)} cards)")
print(f"latest      : {len(latest)}")
print(f"spotlight   : {len(spotlight)}  featured: {len(featured)}  fest wall: {len(fest)}")
print(f"genres      : {len(genre_list)}  decades: {decades}  languages: {languages}")
print(f"collections nav: {[c['name'] for c in uniq.values()]}")
print(f"wrote {OUT} ({OUT.stat().st_size/1024:.1f} KB)")
