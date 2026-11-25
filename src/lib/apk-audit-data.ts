export interface MatchedPlatformAudit {
  platform: string;
  badgeColor: string;
  patternsFromDump: string[];
  publicEndpointsUsed: string[];
  capabilities: string[];
}

export const APK_AUDIT_SUMMARY = {
  filesInspected: [
    { name: 'urls_and_links.txt', count: '506 URLs / 166 Domains', detail: 'মিডিয়া প্ল্যাটফর্ম লিংক, ইউটিউব/টিকটক/ফেসবুক/ইনস্টাগ্রাম/এক্স/রেডিট/ডেইলিমোশন/ব্লুস্কাই এন্ডপয়েন্ট এবং অ্যাড/ট্র্যাকার ডোমেইন' },
    { name: 'api_endpoints.txt', count: '811 API Paths', detail: 'সার্চ অটোকমপ্লিট (/complete/search), oEmbed (/oembed), প্লেয়ার মেটাডেটা এবং GraphQL/JSON রাউট' },
    { name: 'possible_keys_secrets.txt', count: '1,000 Entries', detail: 'মূলত Firebase/Crashlytics SDK ক্লাস লগ এবং থার্ড-পার্টি APK কী — নিরাপত্তার স্বার্থে কোনো লিকড কী ব্যবহার করা হয়নি' },
    { name: 'intel.txt', count: '23 Strings', detail: 'সোশ্যাল শেয়ার আইকন নাম ও লোকাল/প্রাইভেট IP — SSRF ফিল্টারের মাধ্যমে লোকাল IP ব্লক করা হয়েছে' },
  ],
  excludedUnsafeCategories: [
    {
      category: 'Ad SDKs & Click Redirectors (বাদ দেওয়া হয়েছে)',
      items: ['pangle.io', 'mintegral', 'inmobi', 'vungle', 'falconnet.app', 'vastvideo.com', 'spadsync.com'],
    },
    {
      category: 'Telemetry & User Tracking (বাদ দেওয়া হয়েছে)',
      items: ['sensorsdata.cn', 'api-event.falconnet.app/installapps', 'snaptube-eb104.firebaseio.com', 'app-measurement.com'],
    },
    {
      category: 'Adult / Unsafe Domains & Leaked Third-Party Keys (সম্পূর্ণ ব্লকড)',
      items: ['11 Adult Domains Blocked', 'Slack Webhook Excluded', 'Third-Party AIzaSy Keys Excluded'],
    },
  ],
};

export const MATCHED_PLATFORMS_AUDIT: MatchedPlatformAudit[] = [
  {
    platform: 'YouTube, Shorts & YT Music',
    badgeColor: '#FF0033',
    patternsFromDump: [
      'https://www.youtube.com/watch?v=%s',
      'https://m.youtube.com/watch?v=',
      'https://www.youtube.com/shorts/',
      'https://music.youtube.com/watch?v=',
      'https://i.ytimg.com/vi/',
    ],
    publicEndpointsUsed: [
      'clients1.google.com/complete/search?client=youtube&ds=yt',
      'www.youtube.com/oembed?url=',
      'i.ytimg.com/vi/{id}/maxresdefault.jpg',
      'Piped / Invidious / yt-dlp Engine',
    ],
    capabilities: ['লাইভ সার্চ সাজেশন', 'ভিডিও ও শর্টস লিংক ম্যাচিং', 'HD থাম্বনেইল, ভিডিও ও MP3/M4A অডিও'],
  },
  {
    platform: 'TikTok Video & Audio',
    badgeColor: '#00F2FE',
    patternsFromDump: [
      'https://www.tiktok.com/@',
      'https://m.tiktok.com/',
      'https://www.tiktok.com/oembed?url=%s',
      'https://www.tiktok.com/embed/',
    ],
    publicEndpointsUsed: [
      'www.tiktok.com/oembed?url=%s',
      'TikWM Public Resolver (No-Watermark HD MP4 & MP3)',
      'yt-dlp Server Fallback',
    ],
    capabilities: ['ওয়াটারমার্ক ছাড়া HD MP4 ডাউনলোড', 'অরিজিনাল MP3 অডিও ডাউনলোড', 'কীওয়ার্ড দিয়ে টিকটক ভিডিও সার্চ'],
  },
  {
    platform: 'X (Twitter) Video',
    badgeColor: '#38BDF8',
    patternsFromDump: [
      'https://twitter.com/%s/status/%s',
      'https://x.com/i/status/%s',
      'https://cdn.syndication.twimg.com/tweet-result?id=',
    ],
    publicEndpointsUsed: [
      'cdn.syndication.twimg.com/tweet-result',
      'api.vxtwitter.com (Direct Multi-Bitrate MP4)',
    ],
    capabilities: ['সরাসরি MP4 ভিডিও ডাউনলোড', 'টুইট টেক্সট ও থাম্বনেইল প্রিভিউ'],
  },
  {
    platform: 'Reddit Video (v.redd.it)',
    badgeColor: '#FF4500',
    patternsFromDump: [
      'https://www.reddit.com/%s/.json',
      'https://old.reddit.com/',
      'https://v.redd.it/',
    ],
    publicEndpointsUsed: [
      'www.reddit.com/{post}/.json?raw_json=1 -> fallback_url',
    ],
    capabilities: ['রেডিট পোস্ট লিংক থেকে সরাসরি HD MP4 ও DASH/HLS এক্সট্রাকশন'],
  },
  {
    platform: 'Facebook & Instagram Reels',
    badgeColor: '#1877F2',
    patternsFromDump: [
      'https://www.facebook.com/watch?v=%s',
      'https://www.facebook.com/reel/%s/',
      'https://www.instagram.com/reels/',
      'https://www.instagram.com/p/',
    ],
    publicEndpointsUsed: [
      'Embedded Player Preview',
      'Server yt-dlp & Custom Cobalt API Engine',
    ],
    capabilities: ['শেয়ার করা রিলস ও ভিডিও লিংক ক্লিনআপ', 'সার্ভার yt-dlp ও Cobalt ইঞ্জিন সাপোর্ট'],
  },
  {
    platform: 'Dailymotion, Bluesky, SoundCloud & Open Media',
    badgeColor: '#8B5CF6',
    patternsFromDump: [
      'https://www.dailymotion.com/player/metadata/video/',
      'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?',
      'https://api-v2.soundcloud.com/resolve?url=',
      'https://open.spotify.com/oembed?url=%s',
      'https://www.pinterest.com/pin/',
    ],
    publicEndpointsUsed: [
      'api.dailymotion.com/videos (Search & Metadata)',
      'public.api.bsky.app/xrpc/app.bsky.feed.getPostThread',
      'archive.org/advancedsearch.php & metadata/{id}',
      'commons.wikimedia.org/w/api.php',
    ],
    capabilities: ['ডেইলিমোশন ও ওপেন মিডিয়া সার্চ', 'ব্লুস্কাই ভিডিও স্ট্রিম', 'ডিরেক্ট MP4/MP3/WebM প্রগ্রেস ডাউনলোড'],
  },
];
