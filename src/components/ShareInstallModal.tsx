'use client';

import React from 'react';
import { CheckCircle2, Download, FolderArchive, Share2, Smartphone, X } from 'lucide-react';

export const PROJECT_ZIP_DOWNLOAD_URL =
  'https://github.com/mdmukul120/SnapTube/archive/refs/heads/arena/0cd52cb2-snaptube.zip';

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
                  ? 'Meta Tube অ্যাপ ইনস্টল ও ডাউনলোড'
                  : 'Install & Download Meta Tube App'}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'bn'
                  ? 'সরাসরি ফোনে ইনস্টল করুন এবং সোর্স + Android প্রজেক্ট ডাউনলোড করুন'
                  : 'Install on Android/Desktop or download full Source + Android APK project'}
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

        {/* One-Click Install / Source Zip Download Box */}
        <div className="mb-4 space-y-2.5">
          {canInstallPwa && (
            <div className="rounded-2xl border border-rose-500/35 bg-gradient-to-r from-rose-500/15 to-violet-500/15 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">
                  {lang === 'bn' ? 'ফোনে Meta Tube অ্যাপ ইনস্টল করুন' : 'Install Meta Tube App'}
                </p>
                <p className="text-xs text-slate-300 mt-0.5">
                  {lang === 'bn'
                    ? 'এক ক্লিকে হোম স্ক্রিন ও Android Share Menu-তে যুক্ত হবে'
                    : 'Adds Meta Tube to your Home Screen & Android Share Sheet'}
                </p>
              </div>
              <button
                onClick={onInstallPwa}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:opacity-95 shrink-0 transition"
              >
                <Download className="w-4 h-4" />
                <span>{lang === 'bn' ? 'ইনস্টল করুন' : 'Install Now'}</span>
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">
                {lang === 'bn'
                  ? 'ফুল অ্যাপ্লিকেশন জিপ (Web + Android Studio প্রজেক্ট)'
                  : 'Full App Package ZIP (Web + Android Project)'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'bn'
                  ? 'সম্পূর্ণ কোড ও অটোমেটিক APK বিল্ডারসহ সরাসরি ডাউনলোড'
                  : 'Direct ZIP download with full Next.js & Android APK wrapper code'}
              </p>
            </div>
            <a
              href={PROJECT_ZIP_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2.5 text-xs font-bold text-cyan-300 shrink-0 transition"
            >
              <FolderArchive className="w-4 h-4" />
              <span>{lang === 'bn' ? 'ZIP ডাউনলোড' : 'Download ZIP'}</span>
            </a>
          </div>
        </div>

        <div className="space-y-3 text-sm text-slate-300">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 flex gap-3">
            <Smartphone className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white mb-1">
                {lang === 'bn'
                  ? 'ফোনে অ্যাপ হিসেবে ইনস্টল করার নিয়ম'
                  : 'How to Install as an Android App'}
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                {lang === 'bn'
                  ? 'Chrome ব্রাউজারে এই লিংক খুলে উপরের মেনু (⋮) থেকে "Install App" বা "Add to Home screen" ট্যাপ করলেই আপনার ফোনে আসল অ্যাপ হিসেবে ইনস্টল হয়ে যাবে।'
                  : 'Open in Chrome on Android -> tap menu (⋮) -> "Install App" to install Meta Tube natively on your phone.'}
              </p>
            </div>
          </div>

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
                  ? 'ইনস্টল করার পর যেকোনো ভিডিওতে "Share" বাটনে চাপ দিলে অ্যাপের তালিকায় "Meta Tube" দেখতে পাবেন। সেটিতে ট্যাপ করলেই লিংকটি অটো-লোড হয়ে ডাউনলোড অপশন চলে আসবে!'
                  : 'Tap Share on any video -> pick "Meta Tube" from the Android share menu.'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-200/90 leading-relaxed">
              {lang === 'bn'
                ? 'কপি করা টেক্সটে অতিরিক্ত ক্যাপশন বা হ্যাশট্যাগ থাকলেও Meta Tube স্বয়ংক্রিয়ভাবে আসল ভিডিও লিংক আলাদা করে নেয়।'
                : 'Meta Tube automatically strips captions and hashtags from shared links.'}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end">
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
