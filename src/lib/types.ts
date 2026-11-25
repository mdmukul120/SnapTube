export type PlatformId =
  | 'youtube'
  | 'youtube_shorts'
  | 'youtube_music'
  | 'tiktok'
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'reddit'
  | 'dailymotion'
  | 'soundcloud'
  | 'spotify'
  | 'tidal'
  | 'bluesky'
  | 'pinterest'
  | 'vimeo'
  | 'okru'
  | 'kwai'
  | 'archive'
  | 'wikimedia'
  | 'itunes'
  | 'direct'
  | 'generic';

export interface MediaFormat {
  id: string;
  label: string;
  quality: string;
  ext: string;
  type: 'video' | 'audio' | 'image';
  url: string;
  sizeBytes?: number;
  sizeText?: string;
  hasAudio?: boolean;
  watermarkFree?: boolean;
  directDownload?: boolean;
}

export interface ResolvedMedia {
  id: string;
  platform: PlatformId;
  platformName: string;
  title: string;
  author?: string;
  thumbnail?: string;
  durationSec?: number;
  views?: number;
  sourceUrl: string;
  canonicalUrl: string;
  embedUrl?: string;
  previewStreamUrl?: string;
  matchedEndpoint: string;
  formats: MediaFormat[];
  note?: string;
  resolvedBy: 'server-ytdlp' | 'server-api' | 'browser-direct' | 'cobalt' | 'metadata-only';
}

export interface SearchResultItem {
  id: string;
  platform: PlatformId;
  platformName: string;
  title: string;
  author: string;
  thumbnail: string;
  durationSec?: number;
  views?: number;
  url: string;
  previewUrl?: string;
  instantFormats?: MediaFormat[];
}

export interface DownloadRecord {
  id: string;
  title: string;
  thumbnail?: string;
  platform: PlatformId;
  platformName: string;
  formatLabel: string;
  ext: string;
  url: string;
  sourceUrl: string;
  progress: number;
  downloadedBytes: number;
  totalBytes?: number;
  status: 'downloading' | 'completed' | 'opened_external' | 'failed';
  createdAt: number;
  error?: string;
}

export interface MatchedUrlInfo {
  isUrl: boolean;
  rawInput: string;
  extractedUrl: string | null;
  canonicalUrl: string | null;
  platform: PlatformId;
  platformName: string;
  mediaId: string | null;
  badgeColor: string;
  matchedPattern: string;
  matchedEndpoint: string;
  isBlockedCategory?: boolean;
  blockReason?: string;
}
