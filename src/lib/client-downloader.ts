import { MediaFormat } from './types';
import { sanitizeFilename } from './url-matcher';

/**
 * Fetches live YouTube search autocomplete suggestions in the browser
 * using the endpoint matched from urls_and_links.txt:
 * https://clients1.google.com/complete/search?client=youtube&ds=yt
 */
export function fetchSearchSuggestions(query: string): Promise<string[]> {
  const q = query.trim();
  if (!q || q.length < 2 || typeof window === 'undefined') {
    return Promise.resolve([]);
  }

  return new Promise((resolve) => {
    const cbName = `__mt_yt_suggest_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const script = document.createElement('script');
    let settled = false;

    const cleanup = () => {
      try {
        delete (window as any)[cbName];
      } catch {
        (window as any)[cbName] = undefined;
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    const timer = window.setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        resolve([]);
      }
    }, 3000);

    (window as any)[cbName] = (data: any) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      cleanup();
      try {
        const rawList = Array.isArray(data?.[1]) ? data[1] : [];
        const suggestions = rawList
          .map((entry: any) => (Array.isArray(entry) ? String(entry[0]) : String(entry)))
          .filter(Boolean)
          .slice(0, 7);
        resolve(suggestions);
      } catch {
        resolve([]);
      }
    };

    script.src = `https://clients1.google.com/complete/search?client=youtube&ds=yt&q=${encodeURIComponent(
      q
    )}&callback=${cbName}`;
    script.async = true;
    script.onerror = () => {
      if (!settled) {
        settled = true;
        window.clearTimeout(timer);
        cleanup();
        resolve([]);
      }
    };

    document.head.appendChild(script);
  });
}

export interface DownloadProgressCallback {
  (update: {
    progress: number;
    downloadedBytes: number;
    totalBytes?: number;
    status: 'downloading' | 'completed' | 'opened_external' | 'failed';
    error?: string;
  }): void;
}

/**
 * Streams media bytes with real-time progress tracking when CORS/server proxy permits,
 * falling back cleanly to browser native link download when cross-origin headers restrict fetch().
 */
export async function downloadMediaWithProgress(params: {
  format: MediaFormat;
  title: string;
  useServerProxy: boolean;
  onProgress: DownloadProgressCallback;
}): Promise<void> {
  const { format, title, useServerProxy, onProgress } = params;
  const filename = sanitizeFilename(title, format.ext);

  // HLS .m3u8 streams cannot be saved as a single raw file via blob fetch; open stream directly
  if (format.ext === 'm3u8') {
    window.open(format.url, '_blank', 'noopener,noreferrer');
    onProgress({
      progress: 100,
      downloadedBytes: 0,
      status: 'opened_external',
    });
    return;
  }

  const streamEndpoint = useServerProxy
    ? `/api/stream?url=${encodeURIComponent(format.url)}&title=${encodeURIComponent(
        title
      )}&ext=${encodeURIComponent(format.ext)}`
    : format.url;

  // Native Android APK WebView Bridge -> hand off directly to Android System DownloadManager
  if (typeof window !== 'undefined' && (window as any).MetaTubeAndroid?.downloadFile) {
    const absStreamUrl = streamEndpoint.startsWith('/')
      ? `${window.location.origin}${streamEndpoint}`
      : streamEndpoint;
    const mime =
      format.type === 'audio'
        ? 'audio/mpeg'
        : format.type === 'image'
          ? 'image/jpeg'
          : 'video/mp4';
    (window as any).MetaTubeAndroid.downloadFile(absStreamUrl, filename, mime);
    onProgress({
      progress: 100,
      downloadedBytes: format.sizeBytes || 0,
      totalBytes: format.sizeBytes,
      status: 'completed',
    });
    return;
  }

  try {
    onProgress({
      progress: 4,
      downloadedBytes: 0,
      totalBytes: format.sizeBytes,
      status: 'downloading',
    });

    const res = await fetch(streamEndpoint, {
      method: 'GET',
      mode: useServerProxy ? 'same-origin' : 'cors',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const contentLengthHeader = res.headers.get('content-length');
    const totalBytes = contentLengthHeader
      ? Number(contentLengthHeader)
      : format.sizeBytes || undefined;

    if (!res.body) {
      const blob = await res.blob();
      triggerBlobSave(blob, filename);
      onProgress({
        progress: 100,
        downloadedBytes: blob.size,
        totalBytes: blob.size,
        status: 'completed',
      });
      return;
    }

    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let downloadedBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        downloadedBytes += value.byteLength;
        const progress = totalBytes
          ? Math.min(99, Math.max(5, Math.round((downloadedBytes / totalBytes) * 100)))
          : Math.min(92, 15 + Math.floor(downloadedBytes / (256 * 1024)) * 6);

        onProgress({
          progress,
          downloadedBytes,
          totalBytes,
          status: 'downloading',
        });
      }
    }

    const mime =
      res.headers.get('content-type') ||
      (format.type === 'audio'
        ? 'audio/mpeg'
        : format.type === 'image'
          ? 'image/jpeg'
          : 'video/mp4');

    const blob = new Blob(chunks as BlobPart[], { type: mime });
    triggerBlobSave(blob, filename);

    onProgress({
      progress: 100,
      downloadedBytes,
      totalBytes: totalBytes || downloadedBytes,
      status: 'completed',
    });
  } catch {
    // Graceful fallback: trigger native browser anchor download / external save
    const a = document.createElement('a');
    a.href = useServerProxy ? streamEndpoint : format.url;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    onProgress({
      progress: 100,
      downloadedBytes: format.sizeBytes || 0,
      totalBytes: format.sizeBytes,
      status: 'opened_external',
    });
  }
}

function triggerBlobSave(blob: Blob, filename: string) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}
