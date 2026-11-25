# Meta Tube — Universal Video Search, Link Share & Downloader

**Meta Tube** হলো একটি আধুনিক, বিজ্ঞাপন-মুক্ত (Ad-free) ও ট্র্যাকার-মুক্ত ভিডিও এবং অডিও সার্চ ও ডাউনলোড অ্যাপ্লিকেশন (Full-Stack Next.js PWA + `yt-dlp` Hybrid Engine)। যেকোনো অ্যাপ থেকে ভিডিও লিংক **Share** করে অথবা সরাসরি **Search** করে HD ভিডিও (MP4/WebM) ও অডিও (MP3/M4A) ডাউনলোড করা যায়।

## মূল ফিচারসমূহ (Key Features)

- **স্মার্ট লিংক ম্যাচিং (16+ Platforms):** YouTube, YouTube Shorts, YT Music, TikTok (No-Watermark HD MP4 + MP3), Facebook Video/Reels, Instagram Reels/Posts, X (Twitter), Reddit (`v.redd.it`), Dailymotion, SoundCloud, Spotify, TIDAL, Bluesky, Pinterest, Vimeo, Archive.org, Wikimedia Commons এবং Direct `.mp4`/`.mp3` লিংক সাপোর্ট।
- **মাল্টি-প্ল্যাটফর্ম সার্চ ও লাইভ সাজেশন:** ইউটিউব লাইভ অটোকমপ্লিট (`clients1.google.com/complete/search`) সহ TikTok, YouTube, Dailymotion, Music Video ও Direct HD ভিডিও সার্চ।
- **Android Native Share Menu সাপোর্ট (PWA Web Share Target):** ফোনে Chrome থেকে **Install App** করলে যেকোনো অ্যাপের **Share** মেনুতে সরাসরি **Meta Tube** চলে আসে।
- **বিল্ট-ইন প্রিভিউ প্লেয়ার ও ডাউনলোড ম্যানেজার:** ডাউনলোডের আগে ভিডিও/অডিও প্লে করে দেখার সুবিধা এবং রিয়েল-টাইম প্রগ্রেস বার ও ডাউনলোড হিস্ট্রি।
- **১০০% ক্লিন ও নিরাপদ:** বিশ্লেষিত APK ডাম্প থেকে সব অ্যাড নেটওয়ার্ক (`pangle`, `mintegral`, `falconnet`), ট্র্যাকার (`sensorsdata`), লিকড থার্ড-পার্টি কী এবং অনিরাপদ ডোমেইন বাদ দেওয়া হয়েছে।

## লোকাল বা সার্ভারে চালানোর নিয়ম (Run Locally)

```bash
npm install
# ঐচ্ছিক: ১০০০+ সাইটে ফুল yt-dlp সাপোর্টের জন্য
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

npm run dev
```

ব্রাউজারে খুলুন: `http://localhost:3000`
