'use client';

import React from 'react';
import { CheckCircle2, Download, FolderArchive, Share2, Smartphone, X } from 'lucide-react';

export const DIRECT_APK_DOWNLOAD_URL = '/MetaTube.apk';
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
                  ? 'Meta Tube অ্যাপ ডাউনলোড ও ইনস্টল'
                  : 'Download & Install Meta Tube App'}
              </h3>
              <p className="text-xs text-slate-400">
                {lang === 'bn'
                  ? 'সরাসরি Android APK ডাউনলোড করুন অথবা ওয়েব অ্যাপ ইনস্টল করুন'
                  : 'Direct Android APK download, PWA install, or full source ZIP'}
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

        {/* Direct Android APK + One-Click PWA + Source Zip */}
        <div className="mb-4 space-y-2.5">
          <div className="rounded-2xl border border-rose-500/40 bg-gradient-to-r from-rose-500/15 to-violet-500/15 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white">
                  {lang === 'bn'
                    ? 'MetaTube.apk (Android অ্যাপ ইনস্টলার)'
                    : 'MetaTube.apk (Android Installer)'}
                </p>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                  v1.0 Signed
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                {lang === 'bn'
                  ? 'সরাসরি ফোনে ডাউনলোড করে ইনস্টল করুন (Android 7.0 – 16 সাপোর্টেড)'
                  : 'Direct signed Android APK with Share Sheet & system DownloadManager'}
              </p>
            </div>
            <a
              href={DIRECT_APK_DOWNLOAD_URL}
              download="MetaTube.apk"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] px-4 py-2.5 text-xs font-bold text-white shadow-lg hover:opacity-95 shrink-0 transition"
            >
              <Download className="w-4 h-4" />
              <span>{lang === 'bn' ? 'APK ডাউনলোড' : 'Download APK'}</span>
            </a>
          </div>

          {canInstallPwa && (
            <div className="rounded-2xl border border-violet-500/30 bg-slate-900/90 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">
                  {lang === 'bn' ? 'এক ক্লিকে ওয়েব অ্যাপ ইনস্টল (PWA)' : 'One-Click Web App Install'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lang === 'bn'
                    ? 'কোনো APK ছাড়াই সরাসরি ব্রাউজার থেকে হোম স্ক্রিনে যুক্ত করুন'
                    : 'Instant install on Android, iPhone, Windows, or Mac'}
                </p>
              </div>
              <button
                onClick={onInstallPwa}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-bold text-white shrink-0 transition"
              >
                <Smartphone className="w-4 h-4" />
                <span>{lang === 'bn' ? 'ইনস্টল করুন' : 'Install PWA'}</span>
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-white">
                {lang === 'bn'
                  ? 'সম্পূর্ণ সোর্স কোড ও Android প্রজেক্ট (.zip)'
                  : 'Full Source Code & Android Project (.zip)'}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {lang === 'bn'
                  ? 'Next.js ফুল-স্ট্যাক অ্যাপ এবং Android Studio প্রজেক্ট একসাথে'
                  : 'Complete repository archive with Next.js + Android Studio wrapper'}
              </p>
            </div>
            <a
              href={PROJECT_ZIP_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-xs font-bold text-cyan-300 shrink-0 transition"
            >
              <FolderArchive className="w-4 h-4" />
              <span>{lang === 'bn' ? 'ZIP ডাউনলোড' : 'Download ZIP'}</span>
            </a>
          </div>
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
                  ? 'MetaTube.apk ইনস্টল করার পর যেকোনো ভিডিওতে "Share" বাটনে চাপ দিলে অ্যাপের তালিকায় "Meta Tube" দেখতে পাবেন। সেটিতে ট্যাপ করলেই লিংকটি অটো-লোড হয়ে ডাউনলোড অপশন চলে আসবে!'
                  : 'Tap Share on any video -> pick "Meta Tube" from the Android share menu.'}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 flex gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-emerald-200/90 leading-relaxed">
              {lang === 'bn'
                ? 'APK ইনস্টল করার সময় ফোনে "Install unknown apps" পারমিশন চাইলে Allow করে দিন—এরপর সরাসরি আপনার ফোনের Downloads ফোল্ডারে ভিডিও সেভ হবে।'
                : 'Allow "Install unknown apps" if prompted by Android when installing MetaTube.apk.'}
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
