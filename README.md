# SnapTube — Playtek / Cricfy Automated Decoder (`match.json`)

গিটহাব অ্যাকশন ও পাইথনের সম্পূর্ণ ডিকোডার (`txt_decoder.py` + `generate_match.py`) ব্যবহার করে স্বয়ংক্রিয়ভাবে দুটি Playtek কনফিগ লিংক এবং লাইভ ইভেন্ট ডাটা ডিকোড করে `match.json` তৈরি করা হয়।

## সোর্স লিংকসমূহ
- `https://c.playtek.xyz/2-xmnhab.json`
- `https://p.playtek.xyz/2-xmnhab.json`

## পাইথন ডিকোডার পাইপলাইন (`txt_decoder.py` ও `generate_match.py`)
1. **`cfj1:` Remote Config ডিকোডার (`decode_cfj1` / `cfg_material`)** — Playtek লিংকের `cfj1:` এনক্রিপ্টেড পে-লোড ডিকোড করে মূল API সার্ভার (`api_url`, `api2`, `api3`) বের করে।
2. **XOR-Hex Query সাইনিং (`encrypt_xor_hex` / `decrypt_xor_hex`)** — APK টোকেন ও টাইমস্ট্যাম্প দিয়ে `getData.php` এর `key` ও `hmac` জেনারেট করে।
3. **V2 Multi-stage AES-128-CBC ডিকোডার (`decode_v2_txt` / `swap_pairs_and_reverse` / `clean_base64` / `repair_json_tail`)** — `v2/events.txt` ও `v2/event_cats.txt` ডিকোড করে।
4. **CfytopDirect AES-CBC ও Baker SHA-256 Stream ফলব্যাক (`decode_cfytop_txt`, `decode_baker_stream`)** — বিকল্প ফরম্যাট স্বয়ংক্রিয়ভাবে শনাক্ত ও ডিকোড করে।

## জেনারেটেড `match.json` লিংক
- **Main ব্রাঞ্চ (মার্জ করার পর):**
  `https://raw.githubusercontent.com/mdmukul120/SnapTube/main/match.json`
- **বর্তমান ব্রাঞ্চ (`arena/7db00d9e-snaptube`):**
  `https://raw.githubusercontent.com/mdmukul120/SnapTube/arena/7db00d9e-snaptube/match.json`

## লোকালি রান করার নিয়ম
```bash
pip install -r requirements.txt
python3 generate_match.py -o match.json --config-output config_decoded.json
```
