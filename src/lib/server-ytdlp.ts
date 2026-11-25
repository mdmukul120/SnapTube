import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { MediaFormat, PlatformId, ResolvedMedia, SearchResultItem } from './types';
import { formatBytes, isSafePublicUrl, matchInputUrl } from './url-matcher';

const execFileAsync = promisify(execFile);

export function findYtDlpBinary(): string | null {
  const venvRoot = /* turbopackIgnore: true */ path.join(process.cwd(), '.venv', 'bin', 'yt-dlp');
  const candidates = [venvRoot, '/usr/local/bin/yt-dlp', '/usr/bin/yt-dlp'];
  for (const bin of candidates) {
    if (existsSync(/* turbopackIgnore: true */ bin)) return bin;
  }
  return null;
}

export async function getYtDlpVersion(): Promise<string | null> {
  const bin = findYtDlpBinary();
  if (!bin) return null;
  try {
    const { stdout } = await execFileAsync(bin, ['--version'], { timeout: 4000 });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

interface YtDlpFormatRaw {
  format_id?: string;
  ext?: string;
  url?: string;
  vcodec?: string;
  acodec?: string;
  height?: number;
  width?: number;
  abr?: number;
  tbr?: number;
  filesize?: number;
  filesize_approx?: number;
  format_note?: string;
  protocol?: string;
}

export async function resolveWithYtDlp(targetUrl: string): Promise<ResolvedMedia | null> {
  const bin = findYtDlpBinary();
  if (!bin) return null;

  const safety = isSafePublicUrl(targetUrl);
  if (!safety.ok) return null;

  try {
    const { stdout } = await execFileAsync(
      bin,
      [
        '--dump-single-json',
        '--no-warnings',
        '--no-playlist',
        '--socket-timeout',
        '6',
        '--retries',
        '1',
        '--',
        targetUrl,
      ],
      {
        timeout: 12000,
        maxBuffer: 15 * 1024 * 1024,
      }
    );

    const data = JSON.parse(stdout);
    const matched = matchInputUrl(targetUrl);

    const rawFormats: YtDlpFormatRaw[] = Array.isArray(data.formats)
      ? data.formats
      : data.url
        ? [{ format_id: 'default', ext: data.ext || 'mp4', url: data.url, vcodec: 'h264', acodec: 'aac' }]
        : [];

    const videoMuxed: MediaFormat[] = [];
    const videoOnly: MediaFormat[] = [];
    const audioFormats: MediaFormat[] = [];
    const seenVideoQualities = new Set<string>();
    const seenAudioQualities = new Set<string>();

    // Sort formats from highest height/bitrate down
    const sorted = [...rawFormats].sort((a, b) => {
      const hDiff = (b.height || 0) - (a.height || 0);
      if (hDiff !== 0) return hDiff;
      return (b.tbr || b.abr || 0) - (a.tbr || a.abr || 0);
    });

    for (const f of sorted) {
      if (!f.url || !f.url.startsWith('http')) continue;
      if (f.protocol && f.protocol.includes('mhtml')) continue;

      const hasVideo = f.vcodec && f.vcodec !== 'none';
      const hasAudio = f.acodec && f.acodec !== 'none';
      const size = f.filesize || f.filesize_approx;
      const ext = (f.ext || 'mp4').toLowerCase();

      if (hasVideo && hasAudio) {
        const q = f.height ? `${f.height}p` : f.format_note || 'HD';
        const key = `${q}-${ext}`;
        if (!seenVideoQualities.has(key)) {
          seenVideoQualities.add(key);
          videoMuxed.push({
            id: `ytdlp-mux-${f.format_id || key}`,
            label: `${q} (${ext.toUpperCase()} Video + Audio)`,
            quality: q,
            ext,
            type: 'video',
            url: f.url,
            sizeBytes: size,
            sizeText: formatBytes(size),
            hasAudio: true,
            watermarkFree: f.format_note ? !f.format_note.toLowerCase().includes('watermark') : undefined,
            directDownload: !f.protocol?.includes('m3u8'),
          });
        }
      } else if (hasVideo && !hasAudio && (f.height || 0) >= 720) {
        const q = `${f.height}p`;
        const key = `vo-${q}-${ext}`;
        if (!seenVideoQualities.has(key) && videoOnly.length < 3) {
          seenVideoQualities.add(key);
          videoOnly.push({
            id: `ytdlp-vo-${f.format_id || key}`,
            label: `${q} High-Res (${ext.toUpperCase()} Video Stream)`,
            quality: q,
            ext,
            type: 'video',
            url: f.url,
            sizeBytes: size,
            sizeText: formatBytes(size),
            hasAudio: false,
            directDownload: !f.protocol?.includes('m3u8'),
          });
        }
      } else if (!hasVideo && hasAudio) {
        const kbps = f.abr ? `${Math.round(f.abr)}kbps` : '128kbps';
        const key = `${kbps}-${ext}`;
        if (!seenAudioQualities.has(key) && audioFormats.length < 4) {
          seenAudioQualities.add(key);
          audioFormats.push({
            id: `ytdlp-aud-${f.format_id || key}`,
            label: `Audio ${kbps} (${ext.toUpperCase()})`,
            quality: kbps,
            ext: ext === 'webm' ? 'webm' : ext === 'm4a' ? 'm4a' : ext,
            type: 'audio',
            url: f.url,
            sizeBytes: size,
            sizeText: formatBytes(size),
            hasAudio: true,
            directDownload: true,
          });
        }
      }
    }

    const formats: MediaFormat[] = [...videoMuxed, ...videoOnly, ...audioFormats];
    if (data.thumbnail) {
      formats.push({
        id: 'thumb-hd',
        label: 'HD Thumbnail Cover (JPG)',
        quality: 'HD Image',
        ext: 'jpg',
        type: 'image',
        url: data.thumbnail,
        directDownload: true,
      });
    }

    if (formats.length === 0) return null;

    return {
      id: String(data.id || matched.mediaId || Date.now()),
      platform: matched.platform as PlatformId,
      platformName: data.extractor_key || matched.platformName,
      title: data.title || 'Untitled Video',
      author: data.uploader || data.channel || data.creator || undefined,
      thumbnail: data.thumbnail || undefined,
      durationSec: typeof data.duration === 'number' ? data.duration : undefined,
      views: typeof data.view_count === 'number' ? data.view_count : undefined,
      sourceUrl: targetUrl,
      canonicalUrl: data.webpage_url || matched.canonicalUrl || targetUrl,
      previewStreamUrl: videoMuxed[0]?.url || audioFormats[0]?.url,
      matchedEndpoint: `yt-dlp (${data.extractor || matched.matchedEndpoint})`,
      formats,
      resolvedBy: 'server-ytdlp',
    };
  } catch {
    return null;
  }
}

export async function searchWithYtDlp(query: string, limit = 10): Promise<SearchResultItem[] | null> {
  const bin = findYtDlpBinary();
  if (!bin) return null;

  try {
    const { stdout } = await execFileAsync(
      bin,
      [
        '--dump-json',
        '--flat-playlist',
        '--no-warnings',
        '--socket-timeout',
        '5',
        '--retries',
        '1',
        '--',
        `ytsearch${limit}:${query}`,
      ],
      {
        timeout: 9000,
        maxBuffer: 8 * 1024 * 1024,
      }
    );

    const lines = stdout
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const items: SearchResultItem[] = [];
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        const videoId = entry.id;
        if (!videoId) continue;
        const url = entry.url?.startsWith('http')
          ? entry.url
          : `https://www.youtube.com/watch?v=${videoId}`;
        const thumb =
          entry.thumbnails?.[entry.thumbnails.length - 1]?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        items.push({
          id: `yt-${videoId}`,
          platform: 'youtube',
          platformName: 'YouTube',
          title: entry.title || 'YouTube Video',
          author: entry.uploader || entry.channel || 'YouTube Creator',
          thumbnail: thumb,
          durationSec: typeof entry.duration === 'number' ? entry.duration : undefined,
          views: typeof entry.view_count === 'number' ? entry.view_count : undefined,
          url,
        });
      } catch {
        // skip malformed line
      }
    }

    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}
