'use client';

import React from 'react';
import { ExternalLink, Music, Play, X } from 'lucide-react';

interface PreviewModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  author?: string;
  streamUrl?: string;
  embedUrl?: string;
  thumbnail?: string;
  isAudio?: boolean;
  sourceUrl?: string;
}

export function PreviewModal({
  open,
  onClose,
  title,
  author,
  streamUrl,
  embedUrl,
  thumbnail,
  isAudio,
  sourceUrl,
}: PreviewModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl border border-slate-800 bg-[#0E121D] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800/80 bg-[#121726]">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-semibold text-white truncate">{title}</h3>
            {author && <p className="text-xs text-slate-400 truncate">{author}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {sourceUrl && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 transition"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>সোর্স</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close player"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Media Body */}
        <div className="bg-black aspect-video w-full flex items-center justify-center relative">
          {isAudio && streamUrl ? (
            <div className="flex flex-col items-center justify-center gap-5 p-8 text-center w-full">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={title}
                  className="w-36 h-36 rounded-2xl object-cover shadow-lg border border-white/10"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-rose-500 to-violet-600 flex items-center justify-center">
                  <Music className="w-12 h-12 text-white" />
                </div>
              )}
              <audio src={streamUrl} controls autoPlay className="w-full max-w-md" />
            </div>
          ) : streamUrl && !streamUrl.endsWith('.m3u8') ? (
            <video
              src={streamUrl}
              poster={thumbnail}
              controls
              autoPlay
              playsInline
              className="w-full h-full max-h-[72vh] object-contain"
            />
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              title={title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : (
            <div className="flex flex-col items-center gap-3 p-6 text-center text-slate-400">
              <Play className="w-10 h-10 text-rose-500" />
              <p className="text-sm">সরাসরি প্রিভিউ স্ট্রিম পাওয়া যায়নি। সোর্স লিংক থেকে দেখুন।</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
