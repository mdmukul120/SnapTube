'use client';

import React from 'react';
import { CheckCircle2, Download, Share2, Smartphone, X } from 'lucide-react';

export const APK_DOWNLOAD_URL =
  'https://github.com/mdmukul120/SnapTube/releases/download/MetaTube-v1.0/MetaTube.apk';

interface ShareInstallModalProps {
  open: boolean;
  onClose: () => void;
  canInstallPwa: boolean;
  onInstallPwa: () => void;
  lang: 'bn' | 'en';
}

export function ShareInstallModal({
  open,
  onClose,
  canInstallPwa,
  onInstallPwa,
  lang,
}: ShareInstallModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#101422] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#FF2E63] to-[#8B5CF6] flex items-center justify-center shadow-lg">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {lang === 'bn'
                  ? 'Meta Tube অ্যাপ ডাউনলোড ও ইনস্টল'
                  : 'Download & Install Meta Tube App'}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'bn'
                  ? 'Android APK অথবা ওয়েব অ্যাপ (PWA) ইনস্টল করুন'
                  : 'Android Native APK & PWA Share Target'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Direct Android APK Download Box */}
        <div className="mb-4 rounded-2xl border border-rose-500/35 bg-gradient-to-r from-rose-500/15 to-violet-500/15 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-white">MetaTube.apk (Android App)</p>
            <p className="text-xs text-slate-300 mt-0.5">
              {lang === 'bn'
                ? 'নেটিভ Share Menu ও Android DownloadManager সাপোর্টসহ'
                : 'Includes native Android Share Sheet & system DownloadManager'}
            </p>
          </div>
          <a
            href={APK_DOWNLOAD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:opacity-95 shrink-0 transition"
          >
            <Download className="w-4 h-4" />
            <span>{lang === 'bn' ? 'APK ডাউনলোড করুন' : 'Download APK'}</span>
          </a>
        </div>

        <div className="space-y-3 text-sm text-slate-300">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 flex gap-3">
            <Share2 className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white mb-1">
                {lang === 'bn'
                  ? 'YouTube / TikTok / Facebook থেকে সরাসরি Share'
                  : 'Share Directly from YouTube / TikTok / Facebook / X'}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? 'APK ইনস্টল করার পর যেকোনো ভিডিওতে "Share" বাটনে চাপ দিলে অ্যাপের তালিকায় "Meta Tube" পাবেন। সেটিতে ট্যাপ করলেই লিংকটি অটো-লোড হয়ে ডাউনলোড অপশন চলে আসবে!'
                  : 'After installing Meta Tube, tap Share on any video -> select "Meta Tube" from the Android share menu.'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-200/90 leading-relaxed">
              {lang === 'bn'
                ? 'বিকল্পভাবে ব্রাউজার মেনু (⋮) থেকে "Install App" চাপলে কোনো APK ছাড়াই সরাসরি ওয়েব অ্যাপ হিসেবে ইনস্টল হবে।'
                : 'Alternatively, tap Chrome menu (⋮) -> "Install App" to install the lightweight PWA directly.'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-3">
          {canInstallPwa && (
            <button
              onClick={onInstallPwa}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 text-xs font-semibold text-white transition"
            >
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <span>{lang === 'bn' ? 'ওয়েব অ্যাপ ইনস্টল' : 'Install Web App'}</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-medium text-slate-200 transition"
          >
            {lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
