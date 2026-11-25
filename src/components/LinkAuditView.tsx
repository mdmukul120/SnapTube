'use client';

import React from 'react';
import { CheckCircle2, FileCode2, ShieldAlert, ShieldCheck, Zap } from 'lucide-react';
import { APK_AUDIT_SUMMARY, MATCHED_PLATFORMS_AUDIT } from '@/lib/apk-audit-data';

interface LinkAuditViewProps {
  lang: 'bn' | 'en';
  onTestSampleUrl: (url: string) => void;
}

export function LinkAuditView({ lang, onTestSampleUrl }: LinkAuditViewProps) {
  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-[#141A2E] via-[#101422] to-[#0B0E17] p-5 sm:p-6">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white">
              {lang === 'bn'
                ? 'আপলোড করা ৪টি ফাইল বিশ্লেষণ ও লিংক ম্যাচিং রিপোর্ট'
                : 'Uploaded APK Link Dump Analysis & Endpoint Matching'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-400 leading-relaxed">
              {lang === 'bn'
                ? 'আপনার দেওয়া urls_and_links.txt, api_endpoints.txt, possible_keys_secrets.txt এবং intel.txt সম্পূর্ণ পড়ে বৈধ ভিডিও ও সার্চ এন্ডপয়েন্টগুলো Meta Tube-এ যুক্ত করা হয়েছে এবং বিজ্ঞাপন, ট্র্যাকার ও ঝুঁকিপূর্ণ ডোমেইনগুলো বাদ দেওয়া হয়েছে।'
                : 'All 4 attached text dumps were analyzed: clean public media endpoints & URL matchers were wired into Meta Tube while ad SDKs, trackers, leaked third-party keys, and unsafe domains were stripped out.'}
            </p>
          </div>
        </div>

        {/* 4 Files Summary Grid */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {APK_AUDIT_SUMMARY.filesInspected.map((f) => (
            <div
              key={f.name}
              className="rounded-xl border border-slate-800/90 bg-slate-950/60 p-3.5"
            >
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-300">
                  <FileCode2 className="w-4 h-4 text-violet-400" />
                  {f.name}
                </span>
                <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200">
                  {f.count}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{f.detail}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Matched Platforms Cards */}
      <div>
        <h3 className="text-base font-bold text-white mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-rose-500" />
          <span>
            {lang === 'bn'
              ? 'ম্যাচ করা প্ল্যাটফর্ম ও সক্রিয় API এন্ডপয়েন্টসমূহ'
              : 'Matched Platforms & Active Public Endpoints'}
          </span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MATCHED_PLATFORMS_AUDIT.map((item) => (
            <div
              key={item.platform}
              className="rounded-2xl border border-slate-800 bg-[#101422] p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <span
                    className="inline-flex items-center rounded-full px-3 py-0.5 text-xs font-bold text-white"
                    style={{ backgroundColor: item.badgeColor }}
                  >
                    {item.platform}
                  </span>
                </div>

                <div className="mb-2.5">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                    Matched URL Patterns
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {item.patternsFromDump.map((pat) => (
                      <code
                        key={pat}
                        className="rounded bg-slate-950 border border-slate-800 px-2 py-0.5 text-[11px] text-slate-300"
                      >
                        {pat}
                      </code>
                    ))}
                  </div>
                </div>

                <div className="mb-2.5">
                  <p className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                    Active Meta Tube Resolver
                  </p>
                  <div className="space-y-1">
                    {item.publicEndpointsUsed.map((ep) => (
                      <div key={ep} className="text-xs text-cyan-300 font-mono truncate">
                        → {ep}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/70 flex flex-wrap gap-2">
                {item.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-300"
                  >
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Security & Privacy Filtering Card */}
      <div className="rounded-2xl border border-rose-500/20 bg-rose-950/10 p-5">
        <h3 className="text-sm sm:text-base font-bold text-white mb-3 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-400" />
          <span>
            {lang === 'bn'
              ? 'নিরাপত্তা ও প্রাইভেসি ফিল্টার (অ্যাডওয়্যার ও ট্র্যাকার মুক্ত)'
              : 'Security & Privacy Sanitization (Zero Ads, Zero Trackers)'}
          </span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {APK_AUDIT_SUMMARY.excludedUnsafeCategories.map((cat) => (
            <div
              key={cat.category}
              className="rounded-xl border border-slate-800 bg-slate-950/70 p-3.5"
            >
              <p className="text-xs font-semibold text-rose-300 mb-2">{cat.category}</p>
              <div className="flex flex-wrap gap-1.5">
                {cat.items.map((it) => (
                  <span
                    key={it}
                    className="rounded-md bg-slate-900 border border-slate-800 px-2 py-0.5 text-[11px] text-slate-400 line-through"
                  >
                    {it}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            onClick={() => onTestSampleUrl('https://archive.org/details/BigBuckBunny_124')}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-white transition"
          >
            {lang === 'bn' ? 'টেস্ট ডিরেক্ট MP4 লিংক লোড করুন' : 'Test Direct MP4 Link'}
          </button>
          <button
            onClick={() => onTestSampleUrl('https://www.youtube.com/watch?v=aqz-KE-bpKQ')}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-3.5 py-2 text-xs font-semibold text-white transition"
          >
            {lang === 'bn' ? 'টেস্ট YouTube লিংক লোড করুন' : 'Test YouTube Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
