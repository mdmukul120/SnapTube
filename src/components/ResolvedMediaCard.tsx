'use client';

import React, { useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  Film,
  Image as ImageIcon,
  Link2,
  Music,
  Play,
  Sparkles,
  User,
} from 'lucide-react';
import { MediaFormat, ResolvedMedia } from '@/lib/types';
import { formatDuration, PLATFORM_META } from '@/lib/url-matcher';

interface ResolvedMediaCardProps {
  media: ResolvedMedia;
  onDownload: (media: ResolvedMedia, format: MediaFormat) => void;
  onPreview: (params: {
    title: string;
    author?: string;
    streamUrl?: string;
    embedUrl?: string;
    thumbnail?: string;
    isAudio?: boolean;
    sourceUrl?: string;
  }) => void;
  activeDownloadIds: Set<string>;
  lang: 'bn' | 'en';
}

export function ResolvedMediaCard({
  media,
  onDownload,
  onPreview,
  activeDownloadIds,
  lang,
}: ResolvedMediaCardProps) {
  const videoFormats = useMemo(
    () => media.formats.filter((f) => f.type === 'video'),
    [media.formats]
  );
  const audioFormats = useMemo(
    () => media.formats.filter((f) => f.type === 'audio'),
    [media.formats]
  );
  const imageFormats = useMemo(
    () => media.formats.filter((f) => f.type === 'image'),
    [media.formats]
  );

  const defaultTab: 'video' | 'audio' | 'image' =
    videoFormats.length > 0 ? 'video' : audioFormats.length > 0 ? 'audio' : 'image';

  const [tab, setTab] = useState<'video' | 'audio' | 'image'>(defaultTab);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const currentList =
    tab === 'video' ? videoFormats : tab === 'audio' ? audioFormats : imageFormats;

  const badgeColor = PLATFORM_META[media.platform]?.color || '#FF2E63';

  const handleCopy = (format: MediaFormat) => {
    navigator.clipboard?.writeText(format.url);
    setCopiedId(format.id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  return (
    <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-b from-[#131829] to-[#0D111C] shadow-2xl overflow-hidden">
      {/* Top Media Summary */}
      <div className="p-4 sm:p-6 flex flex-col md:flex-row gap-5">
        {/* Thumbnail + Play Trigger */}
        <div className="relative w-full md:w-72 aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 group">
          {media.thumbnail ? (
            <img
              src={media.thumbnail}
              alt={media.title}
              className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
              <Film className="w-12 h-12 text-slate-600" />
            </div>
          )}

          {(media.previewStreamUrl || media.embedUrl) && (
            <button
              onClick={() =>
                onPreview({
                  title: media.title,
                  author: media.author,
                  streamUrl: media.previewStreamUrl,
                  embedUrl: media.embedUrl,
                  thumbnail: media.thumbnail,
                  isAudio: videoFormats.length === 0 && audioFormats.length > 0,
                  sourceUrl: media.canonicalUrl,
                })
              }
              className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/55 transition"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-white/95 text-slate-950 px-4 py-2 text-xs font-bold shadow-xl transform group-hover:scale-105 transition">
                <Play className="w-4 h-4 fill-current" />
                <span>{lang === 'bn' ? 'প্রিভিউ প্লে' : 'Play Preview'}</span>
              </span>
            </button>
          )}

          {media.durationSec ? (
            <span className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-md bg-black/80 px-2 py-0.5 text-xs font-semibold text-white">
              <Clock className="w-3 h-3" />
              {formatDuration(media.durationSec)}
            </span>
          ) : null}
        </div>

        {/* Metadata */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold text-white shadow"
                style={{ backgroundColor: badgeColor }}
              >
                {media.platformName}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-800/90 border border-slate-700/70 px-2.5 py-0.5 text-[11px] text-slate-300">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                {media.resolvedBy === 'server-ytdlp'
                  ? 'yt-dlp HD Engine'
                  : media.resolvedBy === 'cobalt'
                    ? 'Cobalt HD Stream'
                    : media.resolvedBy === 'metadata-only'
                      ? 'oEmbed Metadata'
                      : 'Direct Stream Matched'}
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2">
              {media.title}
            </h2>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
              {media.author && (
                <span className="inline-flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate max-w-[220px]">{media.author}</span>
                </span>
              )}
              {typeof media.views === 'number' && (
                <span className="inline-flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-slate-500" />
                  <span>{media.views.toLocaleString()}</span>
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-slate-950/70 border border-slate-800/80 px-3 py-2 flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="inline-flex items-center gap-1.5 truncate">
              <Link2 className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="text-slate-500">Matched API:</span>
              <code className="text-cyan-300 truncate">{media.matchedEndpoint}</code>
            </span>
          </div>
        </div>
      </div>

      {/* Optional Note */}
      {media.note && (
        <div className="mx-4 sm:mx-6 mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-2.5 text-xs text-amber-200 leading-relaxed">
          {media.note}
        </div>
      )}

      {/* Format Category Tabs */}
      <div className="px-4 sm:px-6 border-t border-slate-800/80 pt-4 pb-5">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            onClick={() => setTab('video')}
            disabled={videoFormats.length === 0}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
              tab === 'video'
                ? 'bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white disabled:opacity-40'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>
              {lang === 'bn' ? 'ভিডিও' : 'Video'} ({videoFormats.length})
            </span>
          </button>

          <button
            onClick={() => setTab('audio')}
            disabled={audioFormats.length === 0}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
              tab === 'audio'
                ? 'bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white disabled:opacity-40'
            }`}
          >
            <Music className="w-4 h-4" />
            <span>
              {lang === 'bn' ? 'অডিও / MP3' : 'Audio / MP3'} ({audioFormats.length})
            </span>
          </button>

          <button
            onClick={() => setTab('image')}
            disabled={imageFormats.length === 0}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition ${
              tab === 'image'
                ? 'bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] text-white shadow-md'
                : 'bg-slate-900 text-slate-400 hover:text-white disabled:opacity-40'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>
              {lang === 'bn' ? 'থাম্বনেইল' : 'Thumbnail'} ({imageFormats.length})
            </span>
          </button>
        </div>

        {/* Formats List */}
        {currentList.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-center text-xs text-slate-400">
            {lang === 'bn'
              ? 'এই ক্যাটাগরিতে কোনো ডিরেক্ট ফাইল পাওয়া যায়নি। অন্য ট্যাব দেখুন।'
              : 'No direct streams in this category. Try another tab.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentList.map((fmt) => {
              const isBusy = activeDownloadIds.has(`${media.id}-${fmt.id}`);
              return (
                <div
                  key={fmt.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-[#0B0E17]/90 hover:border-slate-700 p-3 transition"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-bold uppercase text-cyan-300">
                        {fmt.ext}
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-white truncate">
                        {fmt.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                      <span>{fmt.quality}</span>
                      {fmt.sizeText && <span>• {fmt.sizeText}</span>}
                      {fmt.watermarkFree && (
                        <span className="text-emerald-400 font-medium">• No Watermark</span>
                      )}
                      {fmt.type === 'video' && fmt.hasAudio === false && (
                        <span className="text-amber-400">• Video Only</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {(fmt.type === 'video' || fmt.type === 'audio') && fmt.ext !== 'm3u8' && (
                      <button
                        onClick={() =>
                          onPreview({
                            title: `${media.title} (${fmt.quality})`,
                            author: media.author,
                            streamUrl: fmt.url,
                            thumbnail: media.thumbnail,
                            isAudio: fmt.type === 'audio',
                            sourceUrl: media.canonicalUrl,
                          })
                        }
                        title={lang === 'bn' ? 'প্লে করুন' : 'Preview stream'}
                        className="rounded-lg bg-slate-800/90 hover:bg-slate-700 p-2 text-slate-300 hover:text-white transition"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      onClick={() => handleCopy(fmt)}
                      title={lang === 'bn' ? 'ডিরেক্ট লিংক কপি করুন' : 'Copy direct stream URL'}
                      className="rounded-lg bg-slate-800/90 hover:bg-slate-700 p-2 text-slate-300 hover:text-white transition"
                    >
                      {copiedId === fmt.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => onDownload(media, fmt)}
                      disabled={isBusy}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] hover:opacity-95 disabled:opacity-60 px-3.5 py-2 text-xs font-bold text-white shadow-lg transition"
                    >
                      <Download className={`w-3.5 h-3.5 ${isBusy ? 'animate-bounce' : ''}`} />
                      <span>
                        {isBusy
                          ? lang === 'bn'
                            ? 'ডাউনলোড হচ্ছে...'
                            : 'Saving...'
                          : lang === 'bn'
                            ? 'ডাউনলোড'
                            : 'Download'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
