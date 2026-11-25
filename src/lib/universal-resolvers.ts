import { MediaFormat, PlatformId, ResolvedMedia, SearchResultItem } from './types';
import { formatBytes, matchInputUrl } from './url-matcher';

function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function fetchJson<T = any>(url: string, init?: RequestInit, timeoutMs = 6000): Promise<T> {
  const res = await fetch(url, {
    ...init,
    signal: timeoutSignal(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Optional Cobalt API resolver (supports Cobalt v10 POST / and v7 POST /api/json)
 */
export async function resolveViaCobalt(
  targetUrl: string,
  cobaltBaseUrl?: string
): Promise<{ formats: MediaFormat[]; filename?: string } | null> {
  if (!cobaltBaseUrl || !cobaltBaseUrl.trim()) return null;
  const base = cobaltBaseUrl.trim().replace(/\/+$/, '');

  // Try Cobalt v10 root endpoint first, then v7 /api/json
  const endpoints = [
    {
      url: `${base}/`,
      body: JSON.stringify({
        url: targetUrl,
        videoQuality: '1080',
        audioFormat: 'mp3',
        filenameStyle: 'pretty',
      }),
    },
    {
      url: `${base}/api/json`,
      body: JSON.stringify({
        url: targetUrl,
        vQuality: '1080',
        aFormat: 'mp3',
      }),
    },
  ];

  for (const ep of endpoints) {
    try {
      const data = await fetchJson<any>(
        ep.url,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: ep.body,
        },
        6500
      );

      if (data && (data.url || data.picker)) {
        const formats: MediaFormat[] = [];
        if (data.url) {
          formats.push({
            id: 'cobalt-video-hd',
            label: 'HD Video (MP4 Direct)',
            quality: '1080p / HD',
            ext: 'mp4',
            type: 'video',
            url: data.url,
            hasAudio: true,
            watermarkFree: true,
            directDownload: true,
          });
        }
        if (Array.isArray(data.picker)) {
          data.picker.forEach((item: any, idx: number) => {
            if (!item.url) return;
            const isPhoto = item.type === 'photo';
            formats.push({
              id: `cobalt-pick-${idx}`,
              label: isPhoto ? `Slide Photo #${idx + 1} (JPG)` : `Video Clip #${idx + 1} (MP4)`,
              quality: 'HD',
              ext: isPhoto ? 'jpg' : 'mp4',
              type: isPhoto ? 'image' : 'video',
              url: item.url,
              hasAudio: !isPhoto,
              directDownload: true,
            });
          });
        }
        if (data.audio) {
          formats.push({
            id: 'cobalt-audio',
            label: 'Original Audio (MP3)',
            quality: '128kbps+',
            ext: 'mp3',
            type: 'audio',
            url: data.audio,
            hasAudio: true,
            directDownload: true,
          });
        }
        if (formats.length > 0) {
          return { formats, filename: data.filename };
        }
      }
    } catch {
      // try next format
    }
  }
  return null;
}

/**
 * 1. TikTok Resolver (matched from tiktok.com/oembed + TikWM HD API)
 */
async function resolveTikTok(targetUrl: string): Promise<ResolvedMedia | null> {
  try {
    const apiRes = await fetchJson<any>(
      `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`,
      undefined,
      7000
    );

    if (apiRes && apiRes.code === 0 && apiRes.data) {
      const d = apiRes.data;
      const formats: MediaFormat[] = [];

      const toAbs = (u?: string) =>
        u ? (u.startsWith('http') ? u : `https://www.tikwm.com${u}`) : '';

      if (d.hdplay) {
        formats.push({
          id: 'tt-hd-nowm',
          label: 'Full HD 1080p (No Watermark)',
          quality: '1080p HD',
          ext: 'mp4',
          type: 'video',
          url: toAbs(d.hdplay),
          sizeBytes: d.hd_size,
          sizeText: formatBytes(d.hd_size),
          hasAudio: true,
          watermarkFree: true,
          directDownload: true,
        });
      }

      if (d.play) {
        formats.push({
          id: 'tt-sd-nowm',
          label: 'HD 720p (No Watermark)',
          quality: '720p HD',
          ext: 'mp4',
          type: 'video',
          url: toAbs(d.play),
          sizeBytes: d.size,
          sizeText: formatBytes(d.size),
          hasAudio: true,
          watermarkFree: true,
          directDownload: true,
        });
      }

      if (d.wmplay) {
        formats.push({
          id: 'tt-wm',
          label: 'Standard MP4 (With Watermark)',
          quality: '540p',
          ext: 'mp4',
          type: 'video',
          url: toAbs(d.wmplay),
          sizeBytes: d.wm_size,
          sizeText: formatBytes(d.wm_size),
          hasAudio: true,
          watermarkFree: false,
          directDownload: true,
        });
      }

      if (d.music) {
        formats.push({
          id: 'tt-mp3',
          label: `Original Sound — ${d.music_info?.title || 'MP3 Audio'}`,
          quality: 'MP3 Audio',
          ext: 'mp3',
          type: 'audio',
          url: toAbs(d.music),
          hasAudio: true,
          directDownload: true,
        });
      }

      const cover = toAbs(d.origin_cover || d.cover);
      if (cover) {
        formats.push({
          id: 'tt-cover',
          label: 'Video Cover Thumbnail (JPG)',
          quality: 'HD Image',
          ext: 'jpg',
          type: 'image',
          url: cover,
          directDownload: true,
        });
      }

      return {
        id: String(d.id || Date.now()),
        platform: 'tiktok',
        platformName: 'TikTok',
        title: d.title || `TikTok Video by @${d.author?.unique_id || 'creator'}`,
        author: d.author?.nickname ? `${d.author.nickname} (@${d.author.unique_id})` : d.author?.unique_id,
        thumbnail: cover,
        durationSec: typeof d.duration === 'number' ? d.duration : undefined,
        views: typeof d.play_count === 'number' ? d.play_count : undefined,
        sourceUrl: targetUrl,
        canonicalUrl: targetUrl,
        previewStreamUrl: toAbs(d.play || d.hdplay),
        matchedEndpoint: 'tiktok.com/oembed + TikWM No-Watermark Stream Engine',
        formats,
        resolvedBy: 'browser-direct',
      };
    }
  } catch {
    // fallback to oembed below
  }

  try {
    const oembed = await fetchJson<any>(
      `https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`,
      undefined,
      5000
    );
    const formats: MediaFormat[] = [];
    if (oembed.thumbnail_url) {
      formats.push({
        id: 'tt-oembed-thumb',
        label: 'Cover Thumbnail (JPG)',
        quality: 'HD Image',
        ext: 'jpg',
        type: 'image',
        url: oembed.thumbnail_url,
        directDownload: true,
      });
    }
    return {
      id: String(oembed.embed_product_id || Date.now()),
      platform: 'tiktok',
      platformName: 'TikTok',
      title: oembed.title || 'TikTok Video',
      author: oembed.author_name,
      thumbnail: oembed.thumbnail_url,
      sourceUrl: targetUrl,
      canonicalUrl: targetUrl,
      matchedEndpoint: 'https://www.tiktok.com/oembed?url=%s',
      formats,
      resolvedBy: 'metadata-only',
    };
  } catch {
    return null;
  }
}

/**
 * 2. X / Twitter Video Resolver (vxTwitter CORS API + Syndication)
 */
async function resolveTwitter(targetUrl: string, tweetId: string | null): Promise<ResolvedMedia | null> {
  if (!tweetId) return null;
  try {
    const data = await fetchJson<any>(
      `https://api.vxtwitter.com/Twitter/status/${tweetId}`,
      undefined,
      6000
    );

    const formats: MediaFormat[] = [];
    let thumb = data.mediaURLs?.[0] || '';
    let durationSec: number | undefined;
    let previewStreamUrl: string | undefined;

    if (Array.isArray(data.media_extended)) {
      data.media_extended.forEach((m: any, idx: number) => {
        if ((m.type === 'video' || m.type === 'gif') && m.url) {
          const resLabel = m.size?.height ? `${m.size.height}p HD` : 'HD MP4';
          if (!previewStreamUrl) previewStreamUrl = m.url;
          if (!thumb && m.thumbnail_url) thumb = m.thumbnail_url;
          if (m.duration_millis) durationSec = Math.round(m.duration_millis / 1000);

          formats.push({
            id: `tw-vid-${idx}`,
            label: `X Video ${data.media_extended.length > 1 ? `#${idx + 1} ` : ''}(${resLabel} MP4)`,
            quality: resLabel,
            ext: 'mp4',
            type: 'video',
            url: m.url,
            hasAudio: m.type === 'video',
            watermarkFree: true,
            directDownload: true,
          });
        } else if (m.type === 'image' && m.url) {
          if (!thumb) thumb = m.url;
          formats.push({
            id: `tw-img-${idx}`,
            label: `Image #${idx + 1} (Original HD)`,
            quality: 'HD Image',
            ext: 'jpg',
            type: 'image',
            url: m.url,
            directDownload: true,
          });
        }
      });
    }

    if (thumb && !formats.some((f) => f.type === 'image')) {
      formats.push({
        id: 'tw-thumb',
        label: 'Video Thumbnail (JPG)',
        quality: 'HD Image',
        ext: 'jpg',
        type: 'image',
        url: thumb,
        directDownload: true,
      });
    }

    return {
      id: tweetId,
      platform: 'twitter',
      platformName: 'X (Twitter)',
      title: data.text ? data.text.slice(0, 120) : `X Post by @${data.user_screen_name || 'user'}`,
      author: data.user_name ? `${data.user_name} (@${data.user_screen_name})` : undefined,
      thumbnail: thumb || undefined,
      durationSec,
      views: typeof data.likes === 'number' ? data.likes : undefined,
      sourceUrl: targetUrl,
      canonicalUrl: data.tweetURL || targetUrl,
      previewStreamUrl,
      matchedEndpoint: 'x.com/i/status/%s -> vxTwitter Direct MP4 API',
      formats,
      resolvedBy: formats.some((f) => f.type === 'video') ? 'browser-direct' : 'metadata-only',
    };
  } catch {
    return null;
  }
}

/**
 * 3. Reddit Video Resolver (matched directly from https://www.reddit.com/%s/.json)
 */
async function resolveReddit(targetUrl: string, postId: string | null): Promise<ResolvedMedia | null> {
  try {
    const jsonEndpoints: string[] = [];
    if (postId && /^[a-z0-9]{5,10}$/i.test(postId)) {
      jsonEndpoints.push(`https://www.reddit.com/by_id/t3_${postId}.json?raw_json=1`);
    }
    const cleanPath = targetUrl.split('?')[0].replace(/\/+$/, '');
    if (cleanPath.includes('reddit.com/')) {
      jsonEndpoints.push(`${cleanPath}.json?raw_json=1`);
    }

    for (const ep of jsonEndpoints) {
      try {
        const res = await fetchJson<any>(ep, undefined, 6000);
        const post = Array.isArray(res)
          ? res[0]?.data?.children?.[0]?.data
          : res?.data?.children?.[0]?.data;
        if (!post) continue;

        const rv =
          post.secure_media?.reddit_video ||
          post.media?.reddit_video ||
          post.crosspost_parent_list?.[0]?.secure_media?.reddit_video;

        const formats: MediaFormat[] = [];
        let previewStreamUrl: string | undefined;

        if (rv?.fallback_url) {
          const cleanVideoUrl = rv.fallback_url.split('?')[0];
          const q = rv.height ? `${rv.height}p HD` : 'HD';
          previewStreamUrl = rv.fallback_url;
          formats.push({
            id: 'reddit-mp4',
            label: `Reddit Video ${q} (Direct MP4)`,
            quality: q,
            ext: 'mp4',
            type: 'video',
            url: cleanVideoUrl,
            hasAudio: !rv.is_gif,
            watermarkFree: true,
            directDownload: true,
          });

          // Derive separate audio track URL on v.redd.it if present
          const baseVreddit = cleanVideoUrl.substring(0, cleanVideoUrl.lastIndexOf('/'));
          if (baseVreddit.includes('v.redd.it')) {
            formats.push({
              id: 'reddit-audio',
              label: 'Reddit Audio Track (MP4/AAC)',
              quality: '128kbps',
              ext: 'm4a',
              type: 'audio',
              url: `${baseVreddit}/DASH_AUDIO_128.mp4`,
              hasAudio: true,
              directDownload: true,
            });
          }
        }

        const thumb =
          post.preview?.images?.[0]?.source?.url ||
          (post.thumbnail?.startsWith('http') ? post.thumbnail : undefined);

        if (thumb) {
          formats.push({
            id: 'reddit-thumb',
            label: 'Post Preview Image (JPG)',
            quality: 'HD Image',
            ext: 'jpg',
            type: 'image',
            url: thumb,
            directDownload: true,
          });
        }

        return {
          id: post.id || postId || String(Date.now()),
          platform: 'reddit',
          platformName: 'Reddit',
          title: post.title || 'Reddit Video Post',
          author: post.author ? `u/${post.author} • r/${post.subreddit}` : undefined,
          thumbnail: thumb,
          durationSec: rv?.duration,
          views: post.ups,
          sourceUrl: targetUrl,
          canonicalUrl: `https://www.reddit.com${post.permalink || ''}`,
          previewStreamUrl,
          matchedEndpoint: 'https://www.reddit.com/%s/.json (reddit_video.fallback_url)',
          formats,
          resolvedBy: formats.some((f) => f.type === 'video') ? 'browser-direct' : 'metadata-only',
        };
      } catch {
        // try next endpoint
      }
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * 4. Bluesky Social Video Resolver (matched directly from public.api.bsky.app/xrpc/app.bsky.feed.getPostThread)
 */
async function resolveBluesky(targetUrl: string, mediaId: string | null): Promise<ResolvedMedia | null> {
  if (!mediaId || !mediaId.includes(':')) return null;
  const [handleOrDid, rkey] = mediaId.split(':');
  try {
    let did = handleOrDid;
    if (!did.startsWith('did:')) {
      const idRes = await fetchJson<any>(
        `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handleOrDid)}`,
        undefined,
        5000
      );
      did = idRes.did;
    }

    const uri = `at://${did}/app.bsky.feed.post/${rkey}`;
    const thread = await fetchJson<any>(
      `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=0`,
      undefined,
      6000
    );

    const post = thread?.thread?.post;
    if (!post) return null;

    const embed = post.embed;
    const formats: MediaFormat[] = [];

    if (embed?.playlist) {
      formats.push({
        id: 'bsky-hls',
        label: 'Bluesky HD Video Stream (HLS .m3u8)',
        quality: embed.aspectRatio?.height ? `${embed.aspectRatio.height}p` : 'HD',
        ext: 'm3u8',
        type: 'video',
        url: embed.playlist,
        hasAudio: true,
        directDownload: false,
      });
    }

    // Direct blob download via ATProto repo getBlob if video cid exists
    const videoCid = post.record?.embed?.video?.ref?.$link;
    if (videoCid && did) {
      const directBlobUrl = `https://bsky.social/xrpc/com.atproto.sync.getBlob?did=${encodeURIComponent(did)}&cid=${encodeURIComponent(videoCid)}`;
      formats.unshift({
        id: 'bsky-mp4-blob',
        label: 'Original Bluesky Video (Direct MP4)',
        quality: 'Original HD',
        ext: 'mp4',
        type: 'video',
        url: directBlobUrl,
        hasAudio: true,
        watermarkFree: true,
        directDownload: true,
      });
    }

    if (embed?.thumbnail) {
      formats.push({
        id: 'bsky-thumb',
        label: 'Video Thumbnail (JPG)',
        quality: 'HD Image',
        ext: 'jpg',
        type: 'image',
        url: embed.thumbnail,
        directDownload: true,
      });
    }

    return {
      id: rkey,
      platform: 'bluesky',
      platformName: 'Bluesky',
      title: post.record?.text?.slice(0, 120) || 'Bluesky Video Post',
      author: post.author?.displayName
        ? `${post.author.displayName} (@${post.author.handle})`
        : post.author?.handle,
      thumbnail: embed?.thumbnail,
      views: post.likeCount,
      sourceUrl: targetUrl,
      canonicalUrl: targetUrl,
      previewStreamUrl: formats[0]?.url,
      matchedEndpoint: 'https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread',
      formats,
      resolvedBy: 'browser-direct',
    };
  } catch {
    return null;
  }
}

/**
 * 5. Internet Archive Direct Video/Audio Resolver
 */
async function resolveArchive(targetUrl: string, archiveId: string | null): Promise<ResolvedMedia | null> {
  if (!archiveId) return null;
  try {
    const data = await fetchJson<any>(
      `https://archive.org/metadata/${encodeURIComponent(archiveId)}`,
      undefined,
      7000
    );
    if (!data || !Array.isArray(data.files)) return null;

    const meta = data.metadata || {};
    const formats: MediaFormat[] = [];
    let thumb: string | undefined = `https://archive.org/services/img/${encodeURIComponent(archiveId)}`;
    let durationSec: number | undefined;

    for (const f of data.files) {
      if (!f.name) continue;
      const lower = f.name.toLowerCase();
      const dlUrl = `https://archive.org/download/${encodeURIComponent(archiveId)}/${encodeURIComponent(f.name).replace(/%2F/g, '/')}`;
      const sizeBytes = f.size ? Number(f.size) : undefined;
      if (!durationSec && f.length && !Number.isNaN(Number(f.length))) {
        durationSec = Math.round(Number(f.length));
      }

      if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogv')) {
        const ext = lower.split('.').pop() || 'mp4';
        const q = f.height ? `${f.height}p` : f.format || ext.toUpperCase();
        formats.push({
          id: `arc-v-${f.name}`,
          label: `${f.format || ext.toUpperCase()} — ${f.name}`,
          quality: String(q),
          ext,
          type: 'video',
          url: dlUrl,
          sizeBytes,
          sizeText: formatBytes(sizeBytes),
          hasAudio: true,
          watermarkFree: true,
          directDownload: true,
        });
      } else if (lower.endsWith('.mp3') || lower.endsWith('.m4a') || lower.endsWith('.ogg')) {
        const ext = lower.split('.').pop() || 'mp3';
        formats.push({
          id: `arc-a-${f.name}`,
          label: `Audio (${ext.toUpperCase()}) — ${f.name}`,
          quality: f.bitrate ? `${f.bitrate}kbps` : ext.toUpperCase(),
          ext,
          type: 'audio',
          url: dlUrl,
          sizeBytes,
          sizeText: formatBytes(sizeBytes),
          hasAudio: true,
          directDownload: true,
        });
      }
    }

    const previewVideo = formats.find((f) => f.ext === 'mp4') || formats.find((f) => f.type === 'video');

    return {
      id: archiveId,
      platform: 'archive',
      platformName: 'Internet Archive',
      title: Array.isArray(meta.title) ? meta.title[0] : meta.title || archiveId,
      author: Array.isArray(meta.creator) ? meta.creator[0] : meta.creator || 'Open Media Archive',
      thumbnail: thumb,
      durationSec,
      sourceUrl: targetUrl,
      canonicalUrl: `https://archive.org/details/${archiveId}`,
      previewStreamUrl: previewVideo?.url || formats[0]?.url,
      matchedEndpoint: 'https://archive.org/metadata/{id} (Direct Byte-Stream)',
      formats: formats.slice(0, 12),
      resolvedBy: 'browser-direct',
    };
  } catch {
    return null;
  }
}

/**
 * 6. Wikimedia Commons Open HD Video Resolver
 */
async function resolveWikimedia(targetUrl: string, fileTitle: string | null): Promise<ResolvedMedia | null> {
  if (!fileTitle) return null;
  try {
    const cleanName = fileTitle.replace(/^File:/i, '');
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(
      cleanName
    )}&prop=videoinfo&viprop=url|size|mediatype|derivatives|user&viurlwidth=800&format=json&origin=*`;

    const data = await fetchJson<any>(apiUrl, undefined, 6000);
    const pages = data?.query?.pages;
    const page = pages ? (Object.values(pages)[0] as any) : null;
    const vi = page?.videoinfo?.[0];
    if (!vi) return null;

    const formats: MediaFormat[] = [];
    if (vi.url) {
      const ext = vi.url.split('.').pop()?.toLowerCase() || 'webm';
      const isAudio = vi.mediatype === 'AUDIO' || ['mp3', 'ogg', 'flac', 'wav'].includes(ext);
      formats.push({
        id: 'wiki-orig',
        label: `Original Master (${vi.height ? `${vi.height}p ` : ''}${ext.toUpperCase()})`,
        quality: vi.height ? `${vi.height}p` : 'Original',
        ext,
        type: isAudio ? 'audio' : 'video',
        url: vi.url,
        sizeBytes: vi.size,
        sizeText: formatBytes(vi.size),
        hasAudio: true,
        watermarkFree: true,
        directDownload: true,
      });
    }

    if (Array.isArray(vi.derivatives)) {
      for (const d of vi.derivatives) {
        if (!d.src) continue;
        const ext = d.type?.includes('mp4')
          ? 'mp4'
          : d.type?.includes('webm')
            ? 'webm'
            : d.src.split('.').pop()?.toLowerCase() || 'webm';
        const isAudio = d.type?.startsWith('audio/');
        formats.push({
          id: `wiki-der-${d.shorttitle || d.height || Math.random()}`,
          label: `${d.title || d.shorttitle || ext.toUpperCase()}`,
          quality: d.height ? `${d.height}p` : d.shorttitle || 'Stream',
          ext,
          type: isAudio ? 'audio' : 'video',
          url: d.src,
          hasAudio: true,
          watermarkFree: true,
          directDownload: true,
        });
      }
    }

    return {
      id: String(page.pageid || cleanName),
      platform: 'wikimedia',
      platformName: 'Wikimedia Commons',
      title: cleanName.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
      author: vi.user || 'Wikimedia Contributor',
      thumbnail: vi.thumburl,
      durationSec: vi.duration ? Math.round(vi.duration) : undefined,
      sourceUrl: targetUrl,
      canonicalUrl: targetUrl,
      previewStreamUrl: formats[0]?.url,
      matchedEndpoint: 'commons.wikimedia.org/w/api.php?action=query&prop=videoinfo',
      formats,
      resolvedBy: 'browser-direct',
    };
  } catch {
    return null;
  }
}

/**
 * 7. Dailymotion Resolver (matched from api.dailymotion.com & player/metadata/video)
 */
async function resolveDailymotion(targetUrl: string, dmId: string | null): Promise<ResolvedMedia | null> {
  if (!dmId) return null;
  try {
    const info = await fetchJson<any>(
      `https://api.dailymotion.com/video/${encodeURIComponent(
        dmId
      )}?fields=id,title,description,duration,thumbnail_1080_url,thumbnail_720_url,views_total,owner.screenname,url,embed_url`,
      undefined,
      6000
    );

    const formats: MediaFormat[] = [];

    // Try player metadata endpoint matched from urls_and_links.txt (works on server or permissive CORS)
    try {
      const playerMeta = await fetchJson<any>(
        `https://www.dailymotion.com/player/metadata/video/${encodeURIComponent(dmId)}`,
        undefined,
        4500
      );
      const qualities = playerMeta?.qualities;
      if (qualities && typeof qualities === 'object') {
        for (const [qKey, arr] of Object.entries<any>(qualities)) {
          if (!Array.isArray(arr)) continue;
          for (const item of arr) {
            if (!item.url) continue;
            const isMp4 = item.type?.includes('mp4');
            formats.push({
              id: `dm-${qKey}-${isMp4 ? 'mp4' : 'hls'}`,
              label: `Dailymotion ${qKey === 'auto' ? 'Auto Adaptive' : `${qKey}p`} (${isMp4 ? 'MP4' : 'HLS Stream'})`,
              quality: qKey === 'auto' ? 'Adaptive HD' : `${qKey}p`,
              ext: isMp4 ? 'mp4' : 'm3u8',
              type: 'video',
              url: item.url,
              hasAudio: true,
              directDownload: isMp4,
            });
          }
        }
      }
    } catch {
      // player metadata may require server yt-dlp or embed preview in browser
    }

    const thumb = info.thumbnail_1080_url || info.thumbnail_720_url;
    if (thumb) {
      formats.push({
        id: 'dm-thumb-hd',
        label: '1080p HD Video Thumbnail (JPG)',
        quality: '1080p Image',
        ext: 'jpg',
        type: 'image',
        url: thumb,
        directDownload: true,
      });
    }

    return {
      id: info.id || dmId,
      platform: 'dailymotion',
      platformName: 'Dailymotion',
      title: info.title || 'Dailymotion Video',
      author: info['owner.screenname'] || 'Dailymotion Channel',
      thumbnail: thumb,
      durationSec: info.duration,
      views: info.views_total,
      sourceUrl: targetUrl,
      canonicalUrl: info.url || `https://www.dailymotion.com/video/${dmId}`,
      embedUrl: info.embed_url || `https://www.dailymotion.com/embed/video/${dmId}`,
      matchedEndpoint: 'api.dailymotion.com/video + dailymotion.com/player/metadata/video/{id}',
      formats,
      note:
        formats.filter((f) => f.type === 'video').length === 0
          ? 'প্রিভিউ প্লেয়ার প্রস্তুত — সরাসরি MP4 স্ট্রিম পেতে লোকাল/সার্ভার yt-dlp বা Cobalt API সক্রিয় রাখুন।'
          : undefined,
      resolvedBy: formats.some((f) => f.type === 'video') ? 'browser-direct' : 'metadata-only',
    };
  } catch {
    return null;
  }
}

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.nosebs.ru',
  'https://piped-api.garudalinux.org',
];

const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.privacyredirect.com',
];

/**
 * 8. YouTube / Shorts / Music Resolver (Piped + Invidious + oEmbed + i.ytimg.com)
 */
async function resolveYouTube(
  targetUrl: string,
  videoId: string | null,
  platform: PlatformId
): Promise<ResolvedMedia | null> {
  if (!videoId) return null;

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const highResThumb = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  const hqThumb = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

  // 1. Race Piped instances for direct video/audio streams
  try {
    const pipedData = await Promise.any(
      PIPED_INSTANCES.map(async (base) => {
        const d = await fetchJson<any>(`${base}/streams/${encodeURIComponent(videoId)}`, undefined, 4800);
        if (!d || (!d.videoStreams?.length && !d.audioStreams?.length)) {
          throw new Error('empty');
        }
        return d;
      })
    );

    const formats: MediaFormat[] = [];
    const seen = new Set<string>();

    // Muxed streams first (videoOnly === false)
    for (const vs of pipedData.videoStreams || []) {
      if (!vs.url) continue;
      const isMuxed = vs.videoOnly === false;
      const ext = (vs.format || '').toLowerCase().includes('webm') ? 'webm' : 'mp4';
      const q = vs.quality || `${vs.height || 720}p`;
      const key = `${isMuxed ? 'mux' : 'vo'}-${q}-${ext}`;
      if (seen.has(key)) continue;
      seen.add(key);

      if (isMuxed || (vs.height && vs.height >= 720 && formats.length < 5)) {
        formats.push({
          id: `yt-piped-${key}`,
          label: isMuxed
            ? `${q} (${ext.toUpperCase()} Video + Audio)`
            : `${q} High-Res (${ext.toUpperCase()} Video Stream)`,
          quality: q,
          ext,
          type: 'video',
          url: vs.url,
          sizeBytes: vs.contentLength,
          sizeText: formatBytes(vs.contentLength),
          hasAudio: isMuxed,
          watermarkFree: true,
          directDownload: true,
        });
      }
    }

    // Audio streams
    for (const as of (pipedData.audioStreams || []).slice(0, 3)) {
      if (!as.url) continue;
      const ext = (as.mimeType || '').includes('mp4') ? 'm4a' : 'webm';
      const q = as.quality || `${as.bitrate ? Math.round(as.bitrate / 1000) : 128}kbps`;
      formats.push({
        id: `yt-aud-${q}-${ext}`,
        label: `Audio Track ${q} (${ext.toUpperCase()})`,
        quality: q,
        ext,
        type: 'audio',
        url: as.url,
        sizeBytes: as.contentLength,
        sizeText: formatBytes(as.contentLength),
        hasAudio: true,
        directDownload: true,
      });
    }

    formats.push({
      id: 'yt-thumb-max',
      label: 'YouTube HD Thumbnail (JPG)',
      quality: '1280×720 HD',
      ext: 'jpg',
      type: 'image',
      url: pipedData.thumbnailUrl || highResThumb,
      directDownload: true,
    });

    const muxedPreview = formats.find((f) => f.type === 'video' && f.hasAudio);

    return {
      id: videoId,
      platform,
      platformName: platform === 'youtube_shorts' ? 'YouTube Shorts' : platform === 'youtube_music' ? 'YouTube Music' : 'YouTube',
      title: pipedData.title || 'YouTube Video',
      author: pipedData.uploader || undefined,
      thumbnail: pipedData.thumbnailUrl || hqThumb,
      durationSec: pipedData.duration,
      views: pipedData.views,
      sourceUrl: targetUrl,
      canonicalUrl,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      previewStreamUrl: muxedPreview?.url,
      matchedEndpoint: 'youtube.com/watch?v=%s + Piped Stream API + i.ytimg.com/vi/',
      formats,
      resolvedBy: 'browser-direct',
    };
  } catch {
    // Fallback to Invidious API
  }

  // 2. Race Invidious instances
  try {
    const invData = await Promise.any(
      INVIDIOUS_INSTANCES.map(async (base) => {
        const d = await fetchJson<any>(
          `${base}/api/v1/videos/${encodeURIComponent(videoId)}`,
          undefined,
          4800
        );
        if (!d || !d.title) throw new Error('empty');
        return { base, d };
      })
    );

    const { d } = invData;
    const formats: MediaFormat[] = [];

    for (const fs of d.formatStreams || []) {
      if (!fs.url) continue;
      const q = fs.qualityLabel || fs.resolution || '360p';
      formats.push({
        id: `yt-inv-mux-${fs.itag || q}`,
        label: `${q} (MP4 Video + Audio)`,
        quality: q,
        ext: 'mp4',
        type: 'video',
        url: fs.url,
        hasAudio: true,
        watermarkFree: true,
        directDownload: true,
      });
    }

    for (const af of (d.adaptiveFormats || []).filter((x: any) => x.type?.startsWith('audio/')).slice(0, 3)) {
      if (!af.url) continue;
      const isM4a = af.type?.includes('mp4');
      const kbps = af.bitrate ? `${Math.round(Number(af.bitrate) / 1000)}kbps` : '128kbps';
      formats.push({
        id: `yt-inv-aud-${af.itag || kbps}`,
        label: `Audio ${kbps} (${isM4a ? 'M4A' : 'WEBM'})`,
        quality: kbps,
        ext: isM4a ? 'm4a' : 'webm',
        type: 'audio',
        url: af.url,
        sizeBytes: af.clen ? Number(af.clen) : undefined,
        sizeText: af.clen ? formatBytes(Number(af.clen)) : undefined,
        hasAudio: true,
        directDownload: true,
      });
    }

    formats.push({
      id: 'yt-thumb-hq',
      label: 'YouTube HD Thumbnail (JPG)',
      quality: 'HD Image',
      ext: 'jpg',
      type: 'image',
      url: highResThumb,
      directDownload: true,
    });

    return {
      id: videoId,
      platform,
      platformName: platform === 'youtube_shorts' ? 'YouTube Shorts' : 'YouTube',
      title: d.title,
      author: d.author,
      thumbnail: hqThumb,
      durationSec: d.lengthSeconds,
      views: d.viewCount,
      sourceUrl: targetUrl,
      canonicalUrl,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      previewStreamUrl: formats.find((f) => f.type === 'video')?.url,
      matchedEndpoint: 'youtube.com/watch?v=%s + Invidious Stream API',
      formats,
      resolvedBy: formats.some((f) => f.type === 'video') ? 'browser-direct' : 'metadata-only',
    };
  } catch {
    // Fallback to guaranteed oEmbed + Thumbnail metadata
  }

  // 3. Guaranteed oEmbed metadata (from urls_and_links.txt: youtube.com/oembed?url=)
  try {
    const oembed = await fetchJson<any>(
      `https://noembed.com/embed?url=${encodeURIComponent(canonicalUrl)}`,
      undefined,
      5000
    );

    const formats: MediaFormat[] = [
      {
        id: 'yt-maxres-jpg',
        label: 'Max Resolution Thumbnail (1280×720 JPG)',
        quality: '1080p/720p Image',
        ext: 'jpg',
        type: 'image',
        url: highResThumb,
        directDownload: true,
      },
      {
        id: 'yt-hq-jpg',
        label: 'Standard HQ Thumbnail (480×360 JPG)',
        quality: 'HQ Image',
        ext: 'jpg',
        type: 'image',
        url: hqThumb,
        directDownload: true,
      },
    ];

    return {
      id: videoId,
      platform,
      platformName: platform === 'youtube_shorts' ? 'YouTube Shorts' : 'YouTube',
      title: oembed.title || `YouTube Video (${videoId})`,
      author: oembed.author_name || 'YouTube Channel',
      thumbnail: oembed.thumbnail_url || hqThumb,
      sourceUrl: targetUrl,
      canonicalUrl,
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      matchedEndpoint: 'https://www.youtube.com/oembed?url= + https://i.ytimg.com/vi/',
      formats,
      note:
        'ভিডিও তথ্য ও প্রিভিউ লোড হয়েছে। সম্পূর্ণ 1080p/MP3 স্ট্রিম ডাউনলোডের জন্য Settings-এ Cobalt API URL যুক্ত করুন অথবা লোকাল/সার্ভার yt-dlp ইঞ্জিনে চালান।',
      resolvedBy: 'metadata-only',
    };
  } catch {
    return null;
  }
}

/**
 * 9. Direct Media File Resolver (.mp4, .webm, .mp3, .m4a, .m3u8)
 */
function resolveDirectMedia(targetUrl: string): ResolvedMedia {
  const cleanName = decodeURIComponent(targetUrl.split('?')[0].split('/').pop() || 'media_stream');
  const ext = (cleanName.split('.').pop() || 'mp4').toLowerCase();
  const isAudio = ['mp3', 'm4a', 'aac', 'ogg', 'wav', 'flac'].includes(ext);

  const formats: MediaFormat[] = [
    {
      id: 'direct-orig',
      label: isAudio
        ? `Original Audio File (${ext.toUpperCase()})`
        : `Original Video Stream (${ext.toUpperCase()})`,
      quality: 'Original HD',
      ext,
      type: isAudio ? 'audio' : 'video',
      url: targetUrl,
      hasAudio: true,
      watermarkFree: true,
      directDownload: ext !== 'm3u8',
    },
  ];

  return {
    id: cleanName,
    platform: 'direct',
    platformName: 'Direct Media Stream',
    title: cleanName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
    author: new URL(targetUrl).hostname,
    sourceUrl: targetUrl,
    canonicalUrl: targetUrl,
    previewStreamUrl: targetUrl,
    matchedEndpoint: 'GET /%s/%s.mp4 (Direct Byte Stream)',
    formats,
    resolvedBy: 'browser-direct',
  };
}

/**
 * 10. Generic oEmbed Resolver (SoundCloud, Vimeo, Spotify, Facebook, Instagram, Pinterest)
 */
async function resolveGenericOembed(
  targetUrl: string,
  platform: PlatformId,
  platformName: string,
  matchedEndpoint: string
): Promise<ResolvedMedia> {
  const formats: MediaFormat[] = [];
  let title = `${platformName} Media`;
  let author: string | undefined;
  let thumbnail: string | undefined;
  let embedUrl: string | undefined;

  if (platform === 'facebook') {
    embedUrl = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(targetUrl)}&show_text=false`;
  } else if (platform === 'vimeo') {
    const vimeoId = targetUrl.match(/vimeo\.com\/(\d+)/)?.[1];
    if (vimeoId) embedUrl = `https://player.vimeo.com/video/${vimeoId}`;
  }

  try {
    const oembedUrl =
      platform === 'spotify'
        ? `https://open.spotify.com/oembed?url=${encodeURIComponent(targetUrl)}`
        : platform === 'soundcloud'
          ? `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(targetUrl)}`
          : `https://noembed.com/embed?url=${encodeURIComponent(targetUrl)}`;

    const oe = await fetchJson<any>(oembedUrl, undefined, 5000);
    if (oe?.title) title = oe.title;
    if (oe?.author_name) author = oe.author_name;
    if (oe?.thumbnail_url) {
      thumbnail = oe.thumbnail_url;
      formats.push({
        id: 'oe-thumb',
        label: 'Cover / Artwork Image (JPG)',
        quality: 'HD Image',
        ext: 'jpg',
        type: 'image',
        url: oe.thumbnail_url,
        directDownload: true,
      });
    }
  } catch {
    // ignore oembed failure
  }

  return {
    id: String(Date.now()),
    platform,
    platformName,
    title,
    author,
    thumbnail,
    sourceUrl: targetUrl,
    canonicalUrl: targetUrl,
    embedUrl,
    matchedEndpoint,
    formats,
    note:
      'এই প্ল্যাটফর্মের সরাসরি ভিডিও স্ট্রিম পেতে সার্ভার yt-dlp ইঞ্জিন অথবা Settings-এ Cobalt API URL ব্যবহার করুন।',
    resolvedBy: 'metadata-only',
  };
}

/**
 * Master Universal Resolver (runs identically on Server or Browser!)
 */
export async function resolveUniversalUrl(
  rawInput: string,
  options?: { cobaltApiUrl?: string }
): Promise<ResolvedMedia> {
  const matched = matchInputUrl(rawInput);
  if (!matched.isUrl || !matched.extractedUrl) {
    throw new Error('বৈধ কোনো ভিডিও লিংক পাওয়া যায়নি।');
  }
  if (matched.isBlockedCategory) {
    throw new Error(matched.blockReason || 'এই লিংকটি নিরাপত্তার কারণে ব্লক করা হয়েছে।');
  }

  const targetUrl = matched.canonicalUrl || matched.extractedUrl;

  // Try optional user-configured Cobalt API first if provided
  const cobaltResult = await resolveViaCobalt(targetUrl, options?.cobaltApiUrl);

  if (matched.platform === 'direct') {
    return resolveDirectMedia(targetUrl);
  }

  let resolved: ResolvedMedia | null = null;

  switch (matched.platform) {
    case 'tiktok':
      resolved = await resolveTikTok(matched.extractedUrl);
      break;
    case 'twitter':
      resolved = await resolveTwitter(targetUrl, matched.mediaId);
      break;
    case 'reddit':
      resolved = await resolveReddit(targetUrl, matched.mediaId);
      break;
    case 'bluesky':
      resolved = await resolveBluesky(targetUrl, matched.mediaId);
      break;
    case 'archive':
      resolved = await resolveArchive(targetUrl, matched.mediaId);
      break;
    case 'wikimedia':
      resolved = await resolveWikimedia(targetUrl, matched.mediaId);
      break;
    case 'dailymotion':
      resolved = await resolveDailymotion(targetUrl, matched.mediaId);
      break;
    case 'youtube':
    case 'youtube_shorts':
    case 'youtube_music':
      resolved = await resolveYouTube(targetUrl, matched.mediaId, matched.platform);
      break;
    default:
      resolved = await resolveGenericOembed(
        targetUrl,
        matched.platform,
        matched.platformName,
        matched.matchedEndpoint
      );
      break;
  }

  if (!resolved) {
    resolved = await resolveGenericOembed(
      targetUrl,
      matched.platform,
      matched.platformName,
      matched.matchedEndpoint
    );
  }

  if (cobaltResult && cobaltResult.formats.length > 0) {
    resolved.formats = [...cobaltResult.formats, ...resolved.formats];
    resolved.resolvedBy = 'cobalt';
    resolved.note = undefined;
    if (!resolved.previewStreamUrl) {
      resolved.previewStreamUrl = cobaltResult.formats.find((f) => f.type === 'video')?.url;
    }
  }

  return resolved;
}

/**
 * Universal Multi-Platform Search (runs identically on Server or Browser!)
 */
export async function searchUniversalMedia(
  query: string,
  sourceFilter: 'all' | 'youtube' | 'tiktok' | 'dailymotion' | 'music' | 'direct' = 'all'
): Promise<SearchResultItem[]> {
  const q = query.trim();
  if (!q) return [];

  const tasks: Promise<SearchResultItem[]>[] = [];

  // 1. TikTok Video Search (returns instant HD No-Watermark MP4 + MP3!)
  if (sourceFilter === 'all' || sourceFilter === 'tiktok') {
    tasks.push(
      (async (): Promise<SearchResultItem[]> => {
        try {
          const res = await fetchJson<any>(
            `https://www.tikwm.com/api/feed/search?keywords=${encodeURIComponent(q)}&count=10&cursor=0&HD=1`,
            undefined,
            6000
          );
          const videos = res?.data?.videos;
          if (!Array.isArray(videos)) return [];
          const toAbs = (u?: string) =>
            u ? (u.startsWith('http') ? u : `https://www.tikwm.com${u}`) : '';

          return videos.map((v: any) => {
            const playUrl = toAbs(v.play);
            const wmUrl = toAbs(v.wmplay);
            const musicUrl = toAbs(v.music);
            const cover = toAbs(v.origin_cover || v.cover);
            const authorId = v.author?.unique_id || 'tiktok';
            const vidId = v.video_id || v.id;
            const pageUrl = `https://www.tiktok.com/@${authorId}/video/${vidId}`;

            const instantFormats: MediaFormat[] = [];
            if (playUrl) {
              instantFormats.push({
                id: `tt-s-hd-${vidId}`,
                label: 'HD MP4 (No Watermark)',
                quality: '720p/1080p HD',
                ext: 'mp4',
                type: 'video',
                url: playUrl,
                sizeBytes: v.size,
                sizeText: formatBytes(v.size),
                hasAudio: true,
                watermarkFree: true,
                directDownload: true,
              });
            }
            if (wmUrl) {
              instantFormats.push({
                id: `tt-s-wm-${vidId}`,
                label: 'Standard MP4 (Watermark)',
                quality: '540p',
                ext: 'mp4',
                type: 'video',
                url: wmUrl,
                sizeBytes: v.wm_size,
                sizeText: formatBytes(v.wm_size),
                hasAudio: true,
                directDownload: true,
              });
            }
            if (musicUrl) {
              instantFormats.push({
                id: `tt-s-mp3-${vidId}`,
                label: 'Original Sound (MP3)',
                quality: 'MP3 Audio',
                ext: 'mp3',
                type: 'audio',
                url: musicUrl,
                hasAudio: true,
                directDownload: true,
              });
            }

            return {
              id: `tiktok-${vidId}`,
              platform: 'tiktok',
              platformName: 'TikTok',
              title: v.title || `TikTok Video by @${authorId}`,
              author: v.author?.nickname || `@${authorId}`,
              thumbnail: cover,
              durationSec: v.duration,
              views: v.play_count,
              url: pageUrl,
              previewUrl: playUrl,
              instantFormats,
            };
          });
        } catch {
          return [];
        }
      })()
    );
  }

  // 2. YouTube Search (races Piped & Invidious public CORS endpoints)
  if (sourceFilter === 'all' || sourceFilter === 'youtube') {
    tasks.push(
      (async (): Promise<SearchResultItem[]> => {
        try {
          const items = await Promise.any([
            ...PIPED_INSTANCES.map(async (base) => {
              const d = await fetchJson<any>(
                `${base}/search?q=${encodeURIComponent(q)}&filter=videos`,
                undefined,
                4500
              );
              if (!Array.isArray(d?.items) || d.items.length === 0) throw new Error('empty');
              return d.items
                .filter((it: any) => it.url?.includes('watch?v='))
                .slice(0, 10)
                .map((it: any): SearchResultItem => {
                  const vid = new URL(`https://youtube.com${it.url}`).searchParams.get('v') || '';
                  return {
                    id: `yt-${vid}`,
                    platform: it.isShort ? 'youtube_shorts' : 'youtube',
                    platformName: it.isShort ? 'YouTube Shorts' : 'YouTube',
                    title: it.title || 'YouTube Video',
                    author: it.uploaderName || 'YouTube Channel',
                    thumbnail: it.thumbnail || `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`,
                    durationSec: it.duration > 0 ? it.duration : undefined,
                    views: it.views > 0 ? it.views : undefined,
                    url: `https://www.youtube.com/watch?v=${vid}`,
                  };
                });
            }),
            ...INVIDIOUS_INSTANCES.map(async (base) => {
              const arr = await fetchJson<any[]>(
                `${base}/api/v1/search?q=${encodeURIComponent(q)}&type=video`,
                undefined,
                4500
              );
              if (!Array.isArray(arr) || arr.length === 0) throw new Error('empty');
              return arr.slice(0, 10).map((it: any): SearchResultItem => ({
                id: `yt-${it.videoId}`,
                platform: 'youtube',
                platformName: 'YouTube',
                title: it.title || 'YouTube Video',
                author: it.author || 'YouTube',
                thumbnail: `https://i.ytimg.com/vi/${it.videoId}/hqdefault.jpg`,
                durationSec: it.lengthSeconds > 0 ? it.lengthSeconds : undefined,
                views: it.viewCount > 0 ? it.viewCount : undefined,
                url: `https://www.youtube.com/watch?v=${it.videoId}`,
              }));
            }),
          ]);
          return items;
        } catch {
          return [];
        }
      })()
    );
  }

  // 3. Dailymotion Official Public Video Search
  if (sourceFilter === 'all' || sourceFilter === 'dailymotion') {
    tasks.push(
      (async (): Promise<SearchResultItem[]> => {
        try {
          const d = await fetchJson<any>(
            `https://api.dailymotion.com/videos?fields=id,title,duration,thumbnail_720_url,views_total,owner.screenname,url&limit=10&search=${encodeURIComponent(
              q
            )}`,
            undefined,
            5500
          );
          if (!Array.isArray(d?.list)) return [];
          return d.list.map((v: any): SearchResultItem => ({
            id: `dm-${v.id}`,
            platform: 'dailymotion',
            platformName: 'Dailymotion',
            title: v.title || 'Dailymotion Video',
            author: v['owner.screenname'] || 'Dailymotion',
            thumbnail: v.thumbnail_720_url || '',
            durationSec: v.duration,
            views: v.views_total,
            url: v.url || `https://www.dailymotion.com/video/${v.id}`,
          }));
        } catch {
          return [];
        }
      })()
    );
  }

  // 4. Music Videos & Audio Search (Apple iTunes CORS API — direct .m4v & .m4a previews!)
  if (sourceFilter === 'all' || sourceFilter === 'music') {
    tasks.push(
      (async (): Promise<SearchResultItem[]> => {
        try {
          const d = await fetchJson<any>(
            `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=musicVideo&limit=8`,
            undefined,
            5500
          );
          if (!Array.isArray(d?.results)) return [];
          return d.results
            .filter((r: any) => r.previewUrl)
            .map((r: any): SearchResultItem => {
              const hiThumb = (r.artworkUrl100 || '').replace('100x100bb', '600x600bb');
              const ext = r.previewUrl.includes('.m4a') ? 'm4a' : 'm4v';
              return {
                id: `it-${r.trackId}`,
                platform: 'itunes',
                platformName: 'Music Video',
                title: r.trackName || 'Music Video',
                author: r.artistName || 'Artist',
                thumbnail: hiThumb,
                durationSec: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 1000) : undefined,
                url: r.previewUrl,
                previewUrl: r.previewUrl,
                instantFormats: [
                  {
                    id: `it-dl-${r.trackId}`,
                    label: `Music Video Clip (${ext.toUpperCase()} HD)`,
                    quality: 'HD Preview',
                    ext: ext === 'm4v' ? 'mp4' : 'm4a',
                    type: ext === 'm4a' ? 'audio' : 'video',
                    url: r.previewUrl,
                    hasAudio: true,
                    watermarkFree: true,
                    directDownload: true,
                  },
                  ...(hiThumb
                    ? [
                        {
                          id: `it-art-${r.trackId}`,
                          label: 'Album / Video Artwork (600×600 JPG)',
                          quality: 'HD Image',
                          ext: 'jpg',
                          type: 'image' as const,
                          url: hiThumb,
                          directDownload: true,
                        },
                      ]
                    : []),
                ],
              };
            });
        } catch {
          return [];
        }
      })()
    );
  }

  // 5. Open Direct HD Videos (Wikimedia Commons + Internet Archive — 100% direct byte download!)
  if (sourceFilter === 'all' || sourceFilter === 'direct') {
    tasks.push(
      (async (): Promise<SearchResultItem[]> => {
        try {
          const [wikiRes, arcRes] = await Promise.allSettled([
            fetchJson<any>(
              `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
                `${q} filetype:video`
              )}&gsrnamespace=6&gsrlimit=6&prop=videoinfo&viprop=url|size|mediatype|derivatives&viurlwidth=640&format=json&origin=*`,
              undefined,
              5500
            ),
            fetchJson<any>(
              `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
                `(${q}) AND mediatype:(movies)`
              )}&fl[]=identifier,title,creator,downloads&sort[]=downloads+desc&rows=6&page=1&output=json`,
              undefined,
              5500
            ),
          ]);

          const combined: SearchResultItem[] = [];

          if (wikiRes.status === 'fulfilled' && wikiRes.value?.query?.pages) {
            for (const p of Object.values<any>(wikiRes.value.query.pages)) {
              const vi = p.videoinfo?.[0];
              if (!vi?.url) continue;
              const cleanTitle = (p.title || '').replace(/^File:/i, '').replace(/\.[^.]+$/, '');
              combined.push({
                id: `wiki-${p.pageid}`,
                platform: 'wikimedia',
                platformName: 'Commons HD',
                title: cleanTitle,
                author: 'Open Commons Video',
                thumbnail: vi.thumburl || '',
                url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`,
                previewUrl: vi.url,
                instantFormats: [
                  {
                    id: `wiki-orig-${p.pageid}`,
                    label: `Direct HD Video (${vi.url.split('.').pop()?.toUpperCase() || 'WEBM'})`,
                    quality: vi.height ? `${vi.height}p` : 'HD',
                    ext: vi.url.split('.').pop()?.toLowerCase() || 'webm',
                    type: 'video',
                    url: vi.url,
                    sizeBytes: vi.size,
                    sizeText: formatBytes(vi.size),
                    hasAudio: true,
                    watermarkFree: true,
                    directDownload: true,
                  },
                ],
              });
            }
          }

          if (arcRes.status === 'fulfilled' && Array.isArray(arcRes.value?.response?.docs)) {
            for (const doc of arcRes.value.response.docs) {
              if (!doc.identifier) continue;
              combined.push({
                id: `arc-${doc.identifier}`,
                platform: 'archive',
                platformName: 'Archive MP4',
                title: Array.isArray(doc.title) ? doc.title[0] : doc.title || doc.identifier,
                author: Array.isArray(doc.creator) ? doc.creator[0] : doc.creator || 'Internet Archive',
                thumbnail: `https://archive.org/services/img/${encodeURIComponent(doc.identifier)}`,
                views: doc.downloads,
                url: `https://archive.org/details/${doc.identifier}`,
              });
            }
          }

          return combined;
        } catch {
          return [];
        }
      })()
    );
  }

  const settled = await Promise.all(tasks);

  // Interleave results across sources when sourceFilter === 'all' so top results are diverse!
  if (sourceFilter === 'all') {
    const interleaved: SearchResultItem[] = [];
    const maxLen = Math.max(0, ...settled.map((arr) => arr.length));
    for (let i = 0; i < maxLen; i++) {
      for (const group of settled) {
        if (group[i]) interleaved.push(group[i]);
      }
    }
    return interleaved;
  }

  return settled.flat();
}
