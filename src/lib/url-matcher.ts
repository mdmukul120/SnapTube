import { MatchedUrlInfo, PlatformId } from './types';

// Explicitly block unsafe / adult / telemetry / ad-network domains identified during APK link audit
const BLOCKED_DOMAINS = [
  'pornhub.com',
  'pornhub.net',
  'xnxx.com',
  'xvideos.com',
  'youporn.com',
  'redtube.com',
  'thumbzilla.com',
  'eporner.com',
  'beeg.com',
  'porn.com',
  'xhamster.com',
  // Ad / tracker domains from APK dump
  'pangle.io',
  'falconnet.app',
  'sensorsdata.cn',
  'gdfsnt.com',
  'spadsync.com',
  'vastvideo.com',
];

export function isSafePublicUrl(rawUrl: string): { ok: boolean; reason?: string; parsed?: URL } {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, reason: 'Only HTTP/HTTPS links are supported.' };
    }

    const host = parsed.hostname.toLowerCase();

    // SSRF Guard: block localhost & private IP ranges (e.g. 127.0.0.1, 192.168.43.1, 172.20.10.1 from intel.txt)
    if (
      host === 'localhost' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
    ) {
      return { ok: false, reason: 'Local or private network addresses are blocked for security.' };
    }

    for (const blocked of BLOCKED_DOMAINS) {
      if (host === blocked || host.endsWith(`.${blocked}`)) {
        return {
          ok: false,
          reason: 'This domain was excluded during safety & ad-tracker filtering.',
        };
      }
    }

    return { ok: true, parsed };
  } catch {
    return { ok: false, reason: 'Invalid URL format.' };
  }
}

/**
 * Extracts a clean HTTP(S) URL out of messy Android/iOS shared text such as:
 * "এই ভিডিওটি দেখুন! https://vm.tiktok.com/ZS8abc/ #fyp"
 */
export function extractUrlFromSharedText(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // Direct http(s) URL inside shared text
  const urlRegex = /https?:\/\/[^\s<>"'`]+/i;
  const match = trimmed.match(urlRegex);
  if (match) {
    return match[0].replace(/[),.;!?]+$/, '');
  }

  // Handle bare domain links pasted without protocol (e.g. "youtu.be/dQw4w9WgXcQ" or "www.tiktok.com/@a/video/1")
  const bareDomainRegex =
    /^(?:www\.|m\.|music\.|vm\.|vt\.|mobile\.|old\.)?(?:youtube\.com|youtu\.be|tiktok\.com|facebook\.com|fb\.watch|instagram\.com|x\.com|twitter\.com|reddit\.com|v\.redd\.it|dailymotion\.com|dai\.ly|soundcloud\.com|open\.spotify\.com|tidal\.com|bsky\.app|pinterest\.com|pin\.it|vimeo\.com|ok\.ru|kwai\.com|archive\.org)\/\S+/i;
  const bareMatch = trimmed.match(bareDomainRegex);
  if (bareMatch) {
    return `https://${bareMatch[0].replace(/[),.;!?]+$/, '')}`;
  }

  return null;
}

export const PLATFORM_META: Record<
  PlatformId,
  { name: string; color: string; shortTag: string }
> = {
  youtube: { name: 'YouTube', color: '#FF0033', shortTag: 'YT' },
  youtube_shorts: { name: 'YouTube Shorts', color: '#FF2E63', shortTag: 'Shorts' },
  youtube_music: { name: 'YouTube Music', color: '#FF0055', shortTag: 'YT Music' },
  tiktok: { name: 'TikTok', color: '#00F2FE', shortTag: 'TikTok' },
  facebook: { name: 'Facebook Video / Reels', color: '#1877F2', shortTag: 'FB' },
  instagram: { name: 'Instagram Reels / Post', color: '#E1306C', shortTag: 'IG' },
  twitter: { name: 'X (Twitter)', color: '#38BDF8', shortTag: 'X' },
  reddit: { name: 'Reddit Video', color: '#FF4500', shortTag: 'Reddit' },
  dailymotion: { name: 'Dailymotion', color: '#00D2FF', shortTag: 'DM' },
  soundcloud: { name: 'SoundCloud', color: '#FF5500', shortTag: 'SC' },
  spotify: { name: 'Spotify', color: '#1DB954', shortTag: 'Spotify' },
  tidal: { name: 'TIDAL', color: '#2DD4BF', shortTag: 'TIDAL' },
  bluesky: { name: 'Bluesky Social', color: '#0285FF', shortTag: 'Bluesky' },
  pinterest: { name: 'Pinterest Video', color: '#E60023', shortTag: 'Pin' },
  vimeo: { name: 'Vimeo', color: '#1AB7EA', shortTag: 'Vimeo' },
  okru: { name: 'OK.ru Video', color: '#EE8208', shortTag: 'OK.ru' },
  kwai: { name: 'Kwai Video', color: '#FF7700', shortTag: 'Kwai' },
  archive: { name: 'Internet Archive', color: '#A78BFA', shortTag: 'Archive' },
  wikimedia: { name: 'Wikimedia Commons', color: '#34D399', shortTag: 'Commons' },
  itunes: { name: 'Apple Music / Video', color: '#FB7185', shortTag: 'Music' },
  direct: { name: 'Direct Media Stream', color: '#10B981', shortTag: 'MP4/MP3' },
  generic: { name: 'Web Video Link', color: '#94A3B8', shortTag: 'Web' },
};

/**
 * Matches any user input against the platform link patterns derived from
 * urls_and_links.txt & api_endpoints.txt
 */
export function matchInputUrl(input: string): MatchedUrlInfo {
  const extracted = extractUrlFromSharedText(input);
  if (!extracted) {
    return {
      isUrl: false,
      rawInput: input,
      extractedUrl: null,
      canonicalUrl: null,
      platform: 'generic',
      platformName: 'Search Query',
      mediaId: null,
      badgeColor: '#8B5CF6',
      matchedPattern: 'search/query',
      matchedEndpoint: 'clients1.google.com/complete/search + multi-engine search',
    };
  }

  const safety = isSafePublicUrl(extracted);
  if (!safety.ok || !safety.parsed) {
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: null,
      platform: 'generic',
      platformName: 'Blocked / Invalid Link',
      mediaId: null,
      badgeColor: '#EF4444',
      matchedPattern: 'security-filter',
      matchedEndpoint: 'blocked',
      isBlockedCategory: true,
      blockReason: safety.reason,
    };
  }

  const url = safety.parsed;
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const path = url.pathname;

  // 1. Direct Media Files (.mp4, .webm, .mp3, .m4a, .ogg, .wav, .m3u8, .ogv, .m4v)
  if (/\.(mp4|webm|mkv|mov|m4v|ogv|mp3|m4a|aac|ogg|wav|flac|m3u8)(\?.*)?$/i.test(path)) {
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'direct',
      platformName: PLATFORM_META.direct.name,
      mediaId: path.split('/').pop() || 'media',
      badgeColor: PLATFORM_META.direct.color,
      matchedPattern: 'GET /%s/%s.mp4',
      matchedEndpoint: 'Direct Byte-Range Media Stream',
    };
  }

  // 2. YouTube / YouTube Shorts / YouTube Music / youtu.be
  if (
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtu.be'
  ) {
    let videoId: string | null = null;
    let platform: PlatformId = host === 'music.youtube.com' ? 'youtube_music' : 'youtube';
    let pattern = 'youtube.com/watch?v=%s';

    if (host === 'youtu.be') {
      videoId = path.split('/').filter(Boolean)[0] || null;
      pattern = 'youtu.be/%s';
    } else if (path.startsWith('/shorts/')) {
      videoId = path.split('/')[2] || null;
      platform = 'youtube_shorts';
      pattern = 'youtube.com/shorts/%s';
    } else if (path.startsWith('/embed/')) {
      videoId = path.split('/')[2] || null;
      pattern = 'youtube.com/embed/%s';
    } else if (url.searchParams.get('v')) {
      videoId = url.searchParams.get('v');
    }

    const canonical = videoId
      ? `https://www.youtube.com/watch?v=${videoId}`
      : url.toString();

    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: canonical,
      platform,
      platformName: PLATFORM_META[platform].name,
      mediaId: videoId,
      badgeColor: PLATFORM_META[platform].color,
      matchedPattern: pattern,
      matchedEndpoint: 'youtube.com/oembed + i.ytimg.com/vi/{id} + Piped/yt-dlp',
    };
  }

  // 3. TikTok (tiktok.com, m.tiktok.com, vm.tiktok.com, vt.tiktok.com)
  if (
    host === 'tiktok.com' ||
    host === 'm.tiktok.com' ||
    host === 'vm.tiktok.com' ||
    host === 'vt.tiktok.com' ||
    host === 't.tiktok.com'
  ) {
    const idMatch = path.match(/\/(?:video|v|embed)\/(\d+)/);
    const mediaId = idMatch ? idMatch[1] : path.split('/').filter(Boolean)[0] || null;
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'tiktok',
      platformName: PLATFORM_META.tiktok.name,
      mediaId,
      badgeColor: PLATFORM_META.tiktok.color,
      matchedPattern: 'tiktok.com/@user/video/%s',
      matchedEndpoint: 'tiktok.com/oembed?url=%s + TikWM HD No-Watermark Resolver',
    };
  }

  // 4. Facebook / FB Watch / FB Reels
  if (host === 'facebook.com' || host === 'm.facebook.com' || host === 'web.facebook.com' || host === 'fb.watch') {
    const reelMatch = path.match(/\/reel\/(\d+)/) || path.match(/\/videos\/(\d+)/);
    const vParam = url.searchParams.get('v') || url.searchParams.get('story_fbid');
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'facebook',
      platformName: PLATFORM_META.facebook.name,
      mediaId: (reelMatch && reelMatch[1]) || vParam || null,
      badgeColor: PLATFORM_META.facebook.color,
      matchedPattern: 'facebook.com/watch?v=%s | facebook.com/reel/%s/',
      matchedEndpoint: 'facebook.com/video/embed + yt-dlp / Cobalt Extractor',
    };
  }

  // 5. Instagram (Posts / Reels / Clips)
  if (host === 'instagram.com' || host === 'm.instagram.com') {
    const igMatch = path.match(/\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'instagram',
      platformName: PLATFORM_META.instagram.name,
      mediaId: igMatch ? igMatch[1] : null,
      badgeColor: PLATFORM_META.instagram.color,
      matchedPattern: 'instagram.com/reels/%s | instagram.com/p/%s',
      matchedEndpoint: 'Instagram Embed / Cobalt / yt-dlp Media Resolver',
    };
  }

  // 6. X / Twitter
  if (host === 'x.com' || host === 'twitter.com' || host === 'mobile.twitter.com' || host === 'm.twitter.com') {
    const statusMatch = path.match(/\/status\/(\d+)/);
    const tweetId = statusMatch ? statusMatch[1] : null;
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'twitter',
      platformName: PLATFORM_META.twitter.name,
      mediaId: tweetId,
      badgeColor: PLATFORM_META.twitter.color,
      matchedPattern: 'x.com/i/status/%s | twitter.com/%s/status/%s',
      matchedEndpoint: 'cdn.syndication.twimg.com/tweet-result + vxTwitter MP4 API',
    };
  }

  // 7. Reddit (reddit.com, old.reddit.com, v.redd.it)
  if (host === 'reddit.com' || host === 'old.reddit.com' || host === 'np.reddit.com' || host === 'v.redd.it') {
    const postMatch = path.match(/\/comments\/([a-z0-9]+)/i);
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'reddit',
      platformName: PLATFORM_META.reddit.name,
      mediaId: postMatch ? postMatch[1] : path.split('/').filter(Boolean)[0] || null,
      badgeColor: PLATFORM_META.reddit.color,
      matchedPattern: 'reddit.com/%s/.json | v.redd.it/%s',
      matchedEndpoint: 'GET https://www.reddit.com/%s/.json (reddit_video.fallback_url)',
    };
  }

  // 8. Dailymotion
  if (host === 'dailymotion.com' || host === 'dai.ly') {
    const dmId =
      host === 'dai.ly'
        ? path.split('/').filter(Boolean)[0]
        : path.match(/\/video\/([a-zA-Z0-9]+)/)?.[1] || null;
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: dmId ? `https://www.dailymotion.com/video/${dmId}` : url.toString(),
      platform: 'dailymotion',
      platformName: PLATFORM_META.dailymotion.name,
      mediaId: dmId || null,
      badgeColor: PLATFORM_META.dailymotion.color,
      matchedPattern: 'dailymotion.com/video/%s',
      matchedEndpoint: 'dailymotion.com/player/metadata/video/{id} + api.dailymotion.com',
    };
  }

  // 9. SoundCloud
  if (host === 'soundcloud.com' || host === 'm.soundcloud.com' || host === 'on.soundcloud.com') {
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'soundcloud',
      platformName: PLATFORM_META.soundcloud.name,
      mediaId: path.replace(/^\//, ''),
      badgeColor: PLATFORM_META.soundcloud.color,
      matchedPattern: 'soundcloud.com/%s',
      matchedEndpoint: 'soundcloud.com/oembed + api-v2.soundcloud.com/resolve',
    };
  }

  // 10. Spotify / TIDAL
  if (host === 'open.spotify.com') {
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'spotify',
      platformName: PLATFORM_META.spotify.name,
      mediaId: path.split('/').pop() || null,
      badgeColor: PLATFORM_META.spotify.color,
      matchedPattern: 'open.spotify.com/oembed?url=%s',
      matchedEndpoint: 'open.spotify.com/oembed',
    };
  }

  if (host === 'tidal.com' || host === 'listen.tidal.com') {
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'tidal',
      platformName: PLATFORM_META.tidal.name,
      mediaId: path.split('/').pop() || null,
      badgeColor: PLATFORM_META.tidal.color,
      matchedPattern: 'tidal.com/v1/videos/ | tidal.com/v1/tracks/',
      matchedEndpoint: 'TIDAL Metadata / yt-dlp Resolver',
    };
  }

  // 11. Bluesky (bsky.app) — matched from public.api.bsky.app/xrpc/app.bsky.feed.getPostThread
  if (host === 'bsky.app') {
    const bskyMatch = path.match(/\/profile\/([^/]+)\/post\/([a-zA-Z0-9]+)/);
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'bluesky',
      platformName: PLATFORM_META.bluesky.name,
      mediaId: bskyMatch ? `${bskyMatch[1]}:${bskyMatch[2]}` : null,
      badgeColor: PLATFORM_META.bluesky.color,
      matchedPattern: 'bsky.app/profile/%s/post/%s',
      matchedEndpoint: 'public.api.bsky.app/xrpc/app.bsky.feed.getPostThread',
    };
  }

  // 12. Pinterest
  if (host.includes('pinterest.') || host === 'pin.it') {
    const pinMatch = path.match(/\/pin\/(?:[^/]*--)?(\d+)/);
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'pinterest',
      platformName: PLATFORM_META.pinterest.name,
      mediaId: pinMatch ? pinMatch[1] : path.split('/').filter(Boolean)[0] || null,
      badgeColor: PLATFORM_META.pinterest.color,
      matchedPattern: 'pinterest.com/pin/%s | pin.it/%s',
      matchedEndpoint: 'Pinterest PinResource / yt-dlp Video Extractor',
    };
  }

  // 13. Vimeo
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const vimeoId = path.match(/\/(\d+)/)?.[1] || null;
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'vimeo',
      platformName: PLATFORM_META.vimeo.name,
      mediaId: vimeoId,
      badgeColor: PLATFORM_META.vimeo.color,
      matchedPattern: 'vimeo.com/%s',
      matchedEndpoint: 'vimeo.com/api/oembed.json + yt-dlp',
    };
  }

  // 14. OK.ru & Kwai (from urls_and_links.txt)
  if (host === 'ok.ru' || host === 'm.ok.ru') {
    const okId = path.match(/\/video(?:embed)?\/(\d+)/)?.[1] || null;
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'okru',
      platformName: PLATFORM_META.okru.name,
      mediaId: okId,
      badgeColor: PLATFORM_META.okru.color,
      matchedPattern: 'm.ok.ru/video/%s | ok.ru/videoembed/%s',
      matchedEndpoint: 'ok.ru/videoembed + yt-dlp',
    };
  }

  if (host.endsWith('kwai.com')) {
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'kwai',
      platformName: PLATFORM_META.kwai.name,
      mediaId: path.split('/').pop() || null,
      badgeColor: PLATFORM_META.kwai.color,
      matchedPattern: 'm.kwai.com/rest/o/w/photo/get',
      matchedEndpoint: 'Kwai Share Resolver / yt-dlp',
    };
  }

  // 15. Internet Archive (archive.org)
  if (host === 'archive.org') {
    const archiveId = path.match(/\/(?:details|download)\/([^/?#]+)/)?.[1] || null;
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'archive',
      platformName: PLATFORM_META.archive.name,
      mediaId: archiveId,
      badgeColor: PLATFORM_META.archive.color,
      matchedPattern: 'archive.org/details/%s',
      matchedEndpoint: 'https://archive.org/metadata/{identifier} (Direct MP4/MP3)',
    };
  }

  // 16. Wikimedia Commons
  if (host === 'commons.wikimedia.org' || host.endsWith('wikimedia.org')) {
    const fileMatch = decodeURIComponent(path).match(/File:(.+)$/i);
    return {
      isUrl: true,
      rawInput: input,
      extractedUrl: extracted,
      canonicalUrl: url.toString(),
      platform: 'wikimedia',
      platformName: PLATFORM_META.wikimedia.name,
      mediaId: fileMatch ? fileMatch[1] : path.split('/').pop() || null,
      badgeColor: PLATFORM_META.wikimedia.color,
      matchedPattern: 'commons.wikimedia.org/wiki/File:%s',
      matchedEndpoint: 'commons.wikimedia.org/w/api.php (Direct Transcoded HD Streams)',
    };
  }

  return {
    isUrl: true,
    rawInput: input,
    extractedUrl: extracted,
    canonicalUrl: url.toString(),
    platform: 'generic',
    platformName: host,
    mediaId: null,
    badgeColor: PLATFORM_META.generic.color,
    matchedPattern: 'https://%s/%s',
    matchedEndpoint: 'noembed / OpenGraph / yt-dlp Universal Extractor',
  };
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0 || !Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let i = 0;
  while (val >= 1024 && i < units.length - 1) {
    val /= 1024;
    i++;
  }
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0 || !Number.isFinite(seconds)) return '';
  const s = Math.floor(seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function sanitizeFilename(title: string, ext: string): string {
  const clean = title
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80)
    .trim();
  return `MetaTube_${clean || 'video'}.${ext.replace(/^\./, '')}`;
}
