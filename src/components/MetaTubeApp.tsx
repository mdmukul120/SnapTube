'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  Clock,
  Compass,
  Download,
  ExternalLink,
  Film,
  Flame,
  Globe,
  HardDriveDownload,
  Layers,
  Link2,
  Loader2,
  Music,
  Play,
  Search,
  Settings,
  Share2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { downloadMediaWithProgress, fetchSearchSuggestions } from '@/lib/client-downloader';
import {
  DownloadRecord,
  MediaFormat,
  ResolvedMedia,
  SearchResultItem,
} from '@/lib/types';
import { resolveUniversalUrl, searchUniversalMedia } from '@/lib/universal-resolvers';
import {
  extractUrlFromSharedText,
  formatBytes,
  formatDuration,
  matchInputUrl,
  PLATFORM_META,
} from '@/lib/url-matcher';
import { LinkAuditView } from './LinkAuditView';
import { PreviewModal } from './PreviewModal';
import { ResolvedMediaCard } from './ResolvedMediaCard';
import { ShareInstallModal } from './ShareInstallModal';

type NavTab = 'home' | 'downloads' | 'audit' | 'settings';
type SearchSource = 'all' | 'tiktok' | 'youtube' | 'dailymotion' | 'music' | 'direct';

const STORAGE_DOWNLOADS_KEY = 'metatube_downloads_v1';
const STORAGE_SETTINGS_KEY = 'metatube_settings_v1';

const TRENDING_QUERIES = [
  'Bangla New Song',
  'Lofi Music',
  'Cricket Highlights',
  'Islamic Nasheed',
  'Nature 4K',
  'Funny Cat',
];

const QUICK_TEST_LINKS = [
  {
    labelBn: 'HD অ্যানিমেশন মুভি (Direct MP4)',
    labelEn: 'HD Animation Short (Direct MP4)',
    url: 'https://archive.org/details/BigBuckBunny_124',
  },
  {
    labelBn: 'YouTube ভিডিও লিংক টেস্ট',
    labelEn: 'Test YouTube Video Link',
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
  },
  {
    labelBn: 'Commons 1080p ন্যাচার ভিডিও',
    labelEn: 'Commons HD Nature Stream',
    url: 'https://commons.wikimedia.org/wiki/File:Big_Buck_Bunny_4K.webm',
  },
];

export function MetaTubeApp() {
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [lang, setLang] = useState<'bn' | 'en'>('bn');
  const [cobaltApiUrl, setCobaltApiUrl] = useState<string>('');

  // Omni-bar state
  const [inputVal, setInputVal] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Resolution & Search state
  const [isResolving, setIsResolving] = useState(false);
  const [resolvedMedia, setResolvedMedia] = useState<ResolvedMedia | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isSearching, setIsSearching] = useState(false);
  const [lastQuery, setLastQuery] = useState('');
  const [searchSource, setSearchSource] = useState<SearchSource>('all');
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);

  // Downloads state
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [activeDownloadIds, setActiveDownloadIds] = useState<Set<string>>(new Set());

  // Engine Health
  const [engineHealth, setEngineHealth] = useState<{
    ytdlpInstalled: boolean;
    ytdlpVersion: string | null;
    serverOutbound: boolean;
    engineMode: string;
  } | null>(null);

  // Modals & PWA install
  const [previewState, setPreviewState] = useState<{
    open: boolean;
    title: string;
    author?: string;
    streamUrl?: string;
    embedUrl?: string;
    thumbnail?: string;
    isAudio?: boolean;
    sourceUrl?: string;
  }>({ open: false, title: '' });

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const deferredInstallPrompt = useRef<any>(null);
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);

  // Live URL detection as user types/pastes
  const liveMatch = useMemo(() => matchInputUrl(inputVal), [inputVal]);

  // Load persisted downloads & settings + register Service Worker + check health
  useEffect(() => {
    try {
      const savedDl = localStorage.getItem(STORAGE_DOWNLOADS_KEY);
      if (savedDl) {
        const parsed = JSON.parse(savedDl);
        if (Array.isArray(parsed)) setDownloads(parsed);
      }
      const savedSet = localStorage.getItem(STORAGE_SETTINGS_KEY);
      if (savedSet) {
        const parsed = JSON.parse(savedSet);
        if (parsed.lang === 'en' || parsed.lang === 'bn') setLang(parsed.lang);
        if (typeof parsed.cobaltApiUrl === 'string') setCobaltApiUrl(parsed.cobaltApiUrl);
      }
    } catch {
      // ignore storage errors
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      deferredInstallPrompt.current = e;
      setCanInstallPwa(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok) setEngineHealth(d);
      })
      .catch(() => {});

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
    };
  }, []);

  // Persist downloads
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_DOWNLOADS_KEY, JSON.stringify(downloads.slice(0, 60)));
    } catch {
      // ignore
    }
  }, [downloads]);

  // Persist settings
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_SETTINGS_KEY, JSON.stringify({ lang, cobaltApiUrl }));
    } catch {
      // ignore
    }
  }, [lang, cobaltApiUrl]);

  // Close autocomplete on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch live YouTube autocomplete suggestions when typing a search query
  useEffect(() => {
    const trimmed = inputVal.trim();
    if (!trimmed || trimmed.length < 2 || liveMatch.isUrl) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const list = await fetchSearchSuggestions(trimmed);
      setSuggestions(list);
    }, 240);

    return () => window.clearTimeout(timer);
  }, [inputVal, liveMatch.isUrl]);

  // Core Link Resolution Handler (Server first -> Seamless Browser Hybrid Fallback!)
  const handleResolveUrl = useCallback(
    async (rawUrlInput: string) => {
      setErrorMsg(null);
      setShowSuggestions(false);
      setActiveTab('home');

      const matched = matchInputUrl(rawUrlInput);
      if (matched.isBlockedCategory) {
        setErrorMsg(
          matched.blockReason ||
            (lang === 'bn'
              ? 'এই লিংকটি নিরাপত্তার স্বার্থে ব্লক করা হয়েছে।'
              : 'This link was blocked by safety filters.')
        );
        return;
      }

      setIsResolving(true);
      try {
        // 1. Try Backend API Route (/api/resolve)
        const res = await fetch('/api/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: rawUrlInput,
            cobaltApiUrl: cobaltApiUrl || undefined,
          }),
        });
        const data = await res.json();

        if (data?.ok && data.media) {
          setResolvedMedia(data.media);
          return;
        }

        if (res.status === 403 && data?.error) {
          setErrorMsg(data.error);
          return;
        }

        // 2. Run Browser-Direct Hybrid Engine directly from user's browser!
        const clientMedia = await resolveUniversalUrl(rawUrlInput, {
          cobaltApiUrl: cobaltApiUrl || undefined,
        });
        setResolvedMedia(clientMedia);
      } catch (err: any) {
        setErrorMsg(
          err?.message ||
            (lang === 'bn'
              ? 'লিংকটি থেকে ভিডিও তথ্য আনা সম্ভব হয়নি। লিংকটি চেক করে আবার চেষ্টা করুন।'
              : 'Could not extract media from this link. Please verify the URL and try again.')
        );
      } finally {
        setIsResolving(false);
      }
    },
    [cobaltApiUrl, lang]
  );

  // Core Search Handler (Server first -> Browser Multi-Engine CORS Fallback!)
  const handleSearch = useCallback(
    async (queryInput: string, sourceOverride?: SearchSource) => {
      const q = queryInput.trim();
      if (!q) return;

      const src = sourceOverride || searchSource;
      setErrorMsg(null);
      setShowSuggestions(false);
      setLastQuery(q);
      setActiveTab('home');
      setIsSearching(true);

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&source=${encodeURIComponent(src)}`
        );
        const data = await res.json();

        if (data?.ok && Array.isArray(data.items) && data.items.length > 0) {
          setSearchResults(data.items);
          return;
        }

        // Browser-Direct Hybrid Multi-Platform Search
        const clientItems = await searchUniversalMedia(q, src);
        setSearchResults(clientItems);
        if (clientItems.length === 0) {
          setErrorMsg(
            lang === 'bn'
              ? 'কোনো ফলাফল পাওয়া যায়নি। অন্য কীওয়ার্ড বা ফিল্টার দিয়ে চেষ্টা করুন।'
              : 'No videos found. Try another keyword or source tab.'
          );
        }
      } catch {
        const clientItems = await searchUniversalMedia(q, src);
        setSearchResults(clientItems);
      } finally {
        setIsSearching(false);
      }
    },
    [lang, searchSource]
  );

  // Handle Android Web Share Target / Query Params on initial load + load default trending feed!
  const initialBootDone = useRef(false);
  useEffect(() => {
    if (initialBootDone.current) return;
    initialBootDone.current = true;

    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get('shared_url') || params.get('url');
    const sharedText = params.get('shared_text') || params.get('text');
    const sharedTitle = params.get('shared_title') || params.get('title');
    const queryParam = params.get('q');

    const combinedShare = [sharedUrl, sharedText, sharedTitle].filter(Boolean).join(' ').trim();
    if (combinedShare) {
      const foundUrl = extractUrlFromSharedText(combinedShare);
      if (foundUrl) {
        setInputVal(foundUrl);
        handleResolveUrl(foundUrl);
        return;
      }
      setInputVal(combinedShare);
      handleSearch(combinedShare, 'all');
      return;
    }

    if (queryParam) {
      setInputVal(queryParam);
      handleSearch(queryParam, 'all');
      return;
    }

    // Load an initial discovery feed so the home screen immediately feels alive!
    handleSearch('Nature Music HD', 'all');
  }, [handleResolveUrl, handleSearch]);

  // Unified Submit (detects URL vs Search Query automatically!)
  const handleOmniSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    const matched = matchInputUrl(trimmed);
    if (matched.isUrl) {
      handleResolveUrl(trimmed);
    } else {
      handleSearch(trimmed, searchSource);
    }
  };

  // Clipboard One-Tap Paste
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const cleanUrl = extractUrlFromSharedText(text);
      const nextVal = cleanUrl || text.trim();
      setInputVal(nextVal);
      if (cleanUrl) {
        handleResolveUrl(cleanUrl);
      }
    } catch {
      setErrorMsg(
        lang === 'bn'
          ? 'ক্লিপবোর্ড পারমিশন পাওয়া যায়নি — ইনপুট বক্সে চেপে ধরে Paste করুন।'
          : 'Clipboard permission denied — long-press inside the box to paste.'
      );
    }
  };

  // Trigger Download with real byte progress & history tracking
  const handleStartDownload = async (media: ResolvedMedia, format: MediaFormat) => {
    const busyKey = `${media.id}-${format.id}`;
    if (activeDownloadIds.has(busyKey)) return;

    const recordId = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newRecord: DownloadRecord = {
      id: recordId,
      title: media.title,
      thumbnail: media.thumbnail,
      platform: media.platform,
      platformName: media.platformName,
      formatLabel: format.label,
      ext: format.ext,
      url: format.url,
      sourceUrl: media.canonicalUrl,
      progress: 2,
      downloadedBytes: 0,
      totalBytes: format.sizeBytes,
      status: 'downloading',
      createdAt: Date.now(),
    };

    setDownloads((prev) => [newRecord, ...prev]);
    setActiveDownloadIds((prev) => new Set(prev).add(busyKey));

    await downloadMediaWithProgress({
      format,
      title: media.title,
      useServerProxy: Boolean(engineHealth?.serverOutbound),
      onProgress: (upd) => {
        setDownloads((prev) =>
          prev.map((d) =>
            d.id === recordId
              ? {
                  ...d,
                  progress: upd.progress,
                  downloadedBytes: upd.downloadedBytes,
                  totalBytes: upd.totalBytes ?? d.totalBytes,
                  status: upd.status,
                  error: upd.error,
                }
              : d
          )
        );
      },
    });

    setActiveDownloadIds((prev) => {
      const next = new Set(prev);
      next.delete(busyKey);
      return next;
    });
  };

  // Select a search result card -> either instant resolve if formats already present, or resolve link
  const handleSelectSearchResult = (item: SearchResultItem) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (item.instantFormats && item.instantFormats.length > 0) {
      setResolvedMedia({
        id: item.id,
        platform: item.platform,
        platformName: item.platformName,
        title: item.title,
        author: item.author,
        thumbnail: item.thumbnail,
        durationSec: item.durationSec,
        views: item.views,
        sourceUrl: item.url,
        canonicalUrl: item.url,
        previewStreamUrl: item.previewUrl || item.instantFormats[0]?.url,
        matchedEndpoint: `${item.platformName} Direct Stream Resolver`,
        formats: item.instantFormats,
        resolvedBy: 'browser-direct',
      });
      return;
    }
    setInputVal(item.url);
    handleResolveUrl(item.url);
  };

  const handleInstallPwa = async () => {
    if (!deferredInstallPrompt.current) return;
    deferredInstallPrompt.current.prompt();
    await deferredInstallPrompt.current.userChoice.catch(() => {});
    deferredInstallPrompt.current = null;
    setCanInstallPwa(false);
    setShareModalOpen(false);
  };

  const activeDownloadsCount = downloads.filter((d) => d.status === 'downloading').length;

  return (
    <div className="min-h-screen bg-[#090B10] text-slate-100 pb-24 md:pb-12 selection:bg-rose-500 selection:text-white">
      {/* Ambient Background Glow */}
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(ellipse_80%_50%_at_50%_-15%,rgba(255,46,99,0.22),rgba(139,92,246,0.10),transparent)]" />

      {/* Top Glass Header */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-[#090B10]/85 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 h-16 flex items-center justify-between gap-3">
          {/* Brand Logo */}
          <button
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 text-left group"
          >
            <img
              src="/icon.svg"
              alt="Meta Tube"
              className="w-9 h-9 rounded-xl shadow-lg group-hover:scale-105 transition"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-rose-100 to-violet-200 bg-clip-text text-transparent">
                  Meta Tube
                </span>
                <span className="rounded-md bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                {lang === 'bn'
                  ? 'যেকোনো ভিডিও লিংক শেয়ার বা সার্চ করে ডাউনলোড'
                  : 'Universal Video Search, Share & Downloader'}
              </p>
            </div>
          </button>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 rounded-xl bg-[#111522] border border-slate-800/90 p-1">
            <button
              onClick={() => setActiveTab('home')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'home'
                  ? 'bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'হোম ও সার্চ' : 'Home & Search'}</span>
            </button>

            <button
              onClick={() => setActiveTab('downloads')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'downloads'
                  ? 'bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <HardDriveDownload className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'ডাউনলোড' : 'Downloads'}</span>
              {downloads.length > 0 && (
                <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-bold">
                  {downloads.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'audit'
                  ? 'bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'লিংক অ্যানালাইসিস' : 'Matched Links'}</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${
                activeTab === 'settings'
                  ? 'bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'সেটিংস' : 'Settings'}</span>
            </button>
          </nav>

          {/* Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShareModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF2E63]/20 to-[#8B5CF6]/20 hover:from-[#FF2E63]/30 hover:to-[#8B5CF6]/30 border border-rose-500/35 px-3 py-1.5 text-xs font-bold text-rose-200 transition"
            >
              <Download className="w-3.5 h-3.5 text-rose-400" />
              <span>{lang === 'bn' ? 'অ্যাপ ডাউনলোড' : 'Get App / APK'}</span>
            </button>

            <button
              onClick={() => setLang((l) => (l === 'bn' ? 'en' : 'bn'))}
              className="inline-flex items-center gap-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 px-2.5 py-1.5 text-xs font-bold text-cyan-300 transition"
              title="Switch Language"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'EN' : 'বাংলা'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Active Download Floating Progress Strip */}
      {activeDownloadsCount > 0 && activeTab !== 'downloads' && (
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <div
            onClick={() => setActiveTab('downloads')}
            className="cursor-pointer rounded-xl border border-rose-500/40 bg-gradient-to-r from-rose-950/60 to-violet-950/60 px-4 py-2.5 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Loader2 className="w-4 h-4 text-rose-400 animate-spin shrink-0" />
              <span className="font-semibold text-white truncate">
                {lang === 'bn'
                  ? `${activeDownloadsCount}টি ফাইল ডাউনলোড হচ্ছে... প্রগ্রেস দেখতে ট্যাপ করুন`
                  : `${activeDownloadsCount} download in progress... Tap to view`}
              </span>
            </div>
            <span className="text-rose-300 font-bold shrink-0">
              {downloads.find((d) => d.status === 'downloading')?.progress || 0}%
            </span>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="relative mx-auto max-w-6xl px-4 pt-6">
        {activeTab === 'home' && (
          <div className="space-y-7">
            {/* Hero + Omni Search / Link Share Input */}
            <section className="rounded-3xl border border-slate-800/90 bg-gradient-to-b from-[#13182B]/95 to-[#0C0F1A]/95 p-5 sm:p-8 shadow-2xl">
              <div className="max-w-3xl mx-auto text-center mb-5">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 border border-rose-500/25 px-3 py-1 text-xs font-semibold text-rose-300 mb-3">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {lang === 'bn'
                      ? '১৬+ প্ল্যাটফর্ম সাপোর্ট • অ্যাড-মুক্ত • HD ভিডিও ও MP3 অডিও'
                      : '16+ Platforms Matched • Zero Ads • HD Video & MP3 Audio'}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-white">
                  {lang === 'bn' ? (
                    <>
                      যেকোনো ভিডিও <span className="bg-gradient-to-r from-[#FF2E63] via-[#A855F7] to-[#06B6D4] bg-clip-text text-transparent">লিংক পেস্ট বা সার্চ</span> করে ডাউনলোড করুন
                    </>
                  ) : (
                    <>
                      Paste Any Video Link or{' '}
                      <span className="bg-gradient-to-r from-[#FF2E63] via-[#A855F7] to-[#06B6D4] bg-clip-text text-transparent">
                        Search & Download
                      </span>
                    </>
                  )}
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-slate-400">
                  {lang === 'bn'
                    ? 'YouTube, TikTok (No Watermark), Facebook, Instagram, X/Twitter, Reddit, Dailymotion, Bluesky ও Direct MP4 সাপোর্টেড'
                    : 'Supports YouTube, TikTok (No Watermark), Facebook, Instagram, X/Twitter, Reddit, Dailymotion, Bluesky & Direct MP4'}
                </p>
              </div>

              {/* Omni Input Form */}
              <div ref={searchBoxRef} className="relative max-w-3xl mx-auto">
                <form
                  onSubmit={handleOmniSubmit}
                  className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-2xl border border-slate-700/80 bg-[#080A11] p-2 focus-within:border-rose-500/70 focus-within:ring-2 focus-within:ring-rose-500/20 transition"
                >
                  <div className="flex items-center flex-1 gap-2.5 pl-2.5 pr-1 py-1.5">
                    {liveMatch.isUrl ? (
                      <Link2 className="w-5 h-5 text-rose-400 shrink-0" />
                    ) : (
                      <Search className="w-5 h-5 text-slate-400 shrink-0" />
                    )}

                    <input
                      type="text"
                      value={inputVal}
                      onFocus={() => setShowSuggestions(true)}
                      onChange={(e) => {
                        setInputVal(e.target.value);
                        setShowSuggestions(true);
                      }}
                      placeholder={
                        lang === 'bn'
                          ? 'ভিডিও লিংক পেস্ট/শেয়ার করুন অথবা গানের/ভিডিওর নাম লিখে সার্চ করুন...'
                          : 'Paste/share any video URL or search videos, songs, shorts...'
                      }
                      className="w-full bg-transparent text-sm sm:text-base text-white placeholder:text-slate-500 focus:outline-none"
                    />

                    {/* Detected Platform Live Pill */}
                    {liveMatch.isUrl && !liveMatch.isBlockedCategory && (
                      <span
                        className="hidden sm:inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-bold text-white shrink-0"
                        style={{ backgroundColor: liveMatch.badgeColor }}
                      >
                        {PLATFORM_META[liveMatch.platform]?.shortTag || liveMatch.platformName}
                      </span>
                    )}

                    {inputVal && (
                      <button
                        type="button"
                        onClick={() => {
                          setInputVal('');
                          setSuggestions([]);
                        }}
                        className="rounded-lg p-1 text-slate-500 hover:text-white transition"
                        aria-label="Clear input"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handlePasteFromClipboard}
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition"
                    >
                      <ClipboardPaste className="w-4 h-4 text-cyan-400" />
                      <span>{lang === 'bn' ? 'পেস্ট' : 'Paste'}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isResolving || isSearching}
                      className="flex-[2] sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF2E63] via-[#D92682] to-[#8B5CF6] hover:opacity-95 disabled:opacity-60 px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg transition"
                    >
                      {isResolving || isSearching ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : liveMatch.isUrl ? (
                        <Download className="w-4 h-4" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      <span>
                        {liveMatch.isUrl
                          ? lang === 'bn'
                            ? 'লিংক চেক ও ডাউনলোড'
                            : 'Fetch Download'
                          : lang === 'bn'
                            ? 'সার্চ করুন'
                            : 'Search'}
                      </span>
                    </button>
                  </div>
                </form>

                {/* Live Autocomplete Dropdown (clients1.google.com/complete/search) */}
                {showSuggestions && suggestions.length > 0 && !liveMatch.isUrl && (
                  <div className="absolute left-0 right-0 top-full mt-2 z-30 rounded-2xl border border-slate-800 bg-[#101422] shadow-2xl overflow-hidden">
                    {suggestions.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => {
                          setInputVal(sug);
                          setShowSuggestions(false);
                          handleSearch(sug, searchSource);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-800/80 transition"
                      >
                        <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{sug}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Trending Searches + One-Click Demo Links */}
              <div className="max-w-3xl mx-auto mt-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 mr-1">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    {lang === 'bn' ? 'জনপ্রিয় সার্চ:' : 'Trending:'}
                  </span>
                  {TRENDING_QUERIES.map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setInputVal(q);
                        handleSearch(q, searchSource);
                      }}
                      className="rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-800 px-3 py-1 text-xs text-slate-300 hover:text-white transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <span className="text-[11px] font-semibold text-slate-500">
                    {lang === 'bn' ? 'ওয়ান-ক্লিক লিংক টেস্ট:' : 'Quick Link Test:'}
                  </span>
                  {QUICK_TEST_LINKS.map((sample) => (
                    <button
                      key={sample.url}
                      onClick={() => {
                        setInputVal(sample.url);
                        handleResolveUrl(sample.url);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/25 px-2.5 py-1 text-[11px] font-medium text-violet-300 transition"
                    >
                      <Link2 className="w-3 h-3" />
                      <span>{lang === 'bn' ? sample.labelBn : sample.labelEn}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* Error Alert */}
            {errorMsg && (
              <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 px-4 py-3.5 flex items-center justify-between gap-3 text-xs sm:text-sm text-rose-200">
                <div className="flex items-center gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
                <button
                  onClick={() => setErrorMsg(null)}
                  className="text-rose-300 hover:text-white p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Loading Skeleton during Link Resolution */}
            {isResolving && (
              <div className="rounded-2xl border border-slate-800 bg-[#101422] p-6 flex items-center justify-center gap-3 text-sm text-slate-300">
                <Loader2 className="w-5 h-5 text-rose-500 animate-spin" />
                <span>
                  {lang === 'bn'
                    ? 'লিংক বিশ্লেষণ করে ভিডিও ও অডিও কোয়ালিটি লোড করা হচ্ছে...'
                    : 'Matching link endpoint & extracting video/audio qualities...'}
                </span>
              </div>
            )}

            {/* Resolved Media Download Card */}
            {resolvedMedia && !isResolving && (
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                    <Download className="w-4 h-4" />
                    <span>
                      {lang === 'bn'
                        ? 'ডাউনলোডের জন্য প্রস্তুত ফরম্যাটসমূহ'
                        : 'Ready to Download Formats'}
                    </span>
                  </h2>
                  <button
                    onClick={() => setResolvedMedia(null)}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    {lang === 'bn' ? 'বন্ধ করুন' : 'Dismiss'}
                  </button>
                </div>

                <ResolvedMediaCard
                  media={resolvedMedia}
                  onDownload={handleStartDownload}
                  onPreview={(p) => setPreviewState({ open: true, ...p })}
                  activeDownloadIds={activeDownloadIds}
                  lang={lang}
                />
              </section>
            )}

            {/* Multi-Platform Search Results Section */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-violet-400" />
                    <span>
                      {lastQuery
                        ? lang === 'bn'
                          ? `"${lastQuery}" — সার্চ ফলাফল`
                          : `Search Results for "${lastQuery}"`
                        : lang === 'bn'
                          ? 'এক্সপ্লোর ভিডিও ও মিউজিক'
                          : 'Explore Videos & Music'}
                    </span>
                  </h2>
                </div>

                {/* Source Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {(
                    [
                      { id: 'all', bn: 'সব প্ল্যাটফর্ম', en: 'All' },
                      { id: 'tiktok', bn: 'TikTok HD', en: 'TikTok HD' },
                      { id: 'youtube', bn: 'YouTube', en: 'YouTube' },
                      { id: 'dailymotion', bn: 'Dailymotion', en: 'Dailymotion' },
                      { id: 'music', bn: 'মিউজিক ভিডিও', en: 'Music Video' },
                      { id: 'direct', bn: 'ডিরেক্ট MP4', en: 'Direct MP4' },
                    ] as { id: SearchSource; bn: string; en: string }[]
                  ).map((src) => (
                    <button
                      key={src.id}
                      onClick={() => {
                        setSearchSource(src.id);
                        if (lastQuery) {
                          handleSearch(lastQuery, src.id);
                        }
                      }}
                      className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        searchSource === src.id
                          ? 'bg-white text-slate-950 shadow'
                          : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {lang === 'bn' ? src.bn : src.en}
                    </button>
                  ))}
                </div>
              </div>

              {isSearching ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-slate-800/80 bg-[#101422] overflow-hidden animate-pulse"
                    >
                      <div className="aspect-video bg-slate-800/70" />
                      <div className="p-4 space-y-2.5">
                        <div className="h-4 bg-slate-800 rounded w-5/6" />
                        <div className="h-3 bg-slate-800/70 rounded w-1/2" />
                        <div className="h-8 bg-slate-800 rounded-xl w-full mt-2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : searchResults.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {searchResults.map((item) => {
                    const pColor = PLATFORM_META[item.platform]?.color || '#8B5CF6';
                    const hasInstantVideo = item.instantFormats?.find((f) => f.type === 'video');

                    return (
                      <div
                        key={item.id}
                        className="group rounded-2xl border border-slate-800/90 bg-[#101422] hover:border-slate-700 overflow-hidden flex flex-col justify-between transition shadow-lg"
                      >
                        <div>
                          {/* Card Thumbnail */}
                          <div className="relative aspect-video bg-slate-950 overflow-hidden">
                            {item.thumbnail ? (
                              <img
                                src={item.thumbnail}
                                alt={item.title}
                                loading="lazy"
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Film className="w-10 h-10 text-slate-700" />
                              </div>
                            )}

                            {/* Platform Badge */}
                            <span
                              className="absolute top-2.5 left-2.5 rounded-md px-2 py-0.5 text-[10px] font-bold text-white shadow"
                              style={{ backgroundColor: pColor }}
                            >
                              {item.platformName}
                            </span>

                            {item.durationSec ? (
                              <span className="absolute bottom-2.5 right-2.5 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                                {formatDuration(item.durationSec)}
                              </span>
                            ) : null}

                            {/* Play Overlay */}
                            <button
                              onClick={() => {
                                if (item.previewUrl) {
                                  setPreviewState({
                                    open: true,
                                    title: item.title,
                                    author: item.author,
                                    streamUrl: item.previewUrl,
                                    thumbnail: item.thumbnail,
                                    sourceUrl: item.url,
                                  });
                                } else {
                                  handleSelectSearchResult(item);
                                }
                              }}
                              className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition"
                            >
                              <span className="w-11 h-11 rounded-full bg-white/95 text-slate-950 flex items-center justify-center shadow-xl">
                                <Play className="w-5 h-5 fill-current ml-0.5" />
                              </span>
                            </button>
                          </div>

                          {/* Title & Creator */}
                          <div className="p-3.5">
                            <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug">
                              {item.title}
                            </h3>
                            <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                              <span className="truncate max-w-[70%]">{item.author}</span>
                              {typeof item.views === 'number' && (
                                <span>{item.views.toLocaleString()} views</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="px-3.5 pb-3.5 pt-1 flex items-center gap-2">
                          <button
                            onClick={() => handleSelectSearchResult(item)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] hover:opacity-95 px-3 py-2 text-xs font-bold text-white shadow transition"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>
                              {hasInstantVideo
                                ? lang === 'bn'
                                  ? 'HD ডাউনলোড অপশন'
                                  : 'HD Download'
                                : lang === 'bn'
                                  ? 'ডাউনলোড লিংক আনুন'
                                  : 'Get Formats'}
                            </span>
                          </button>

                          {item.previewUrl && (
                            <button
                              onClick={() =>
                                setPreviewState({
                                  open: true,
                                  title: item.title,
                                  author: item.author,
                                  streamUrl: item.previewUrl,
                                  thumbnail: item.thumbnail,
                                  sourceUrl: item.url,
                                })
                              }
                              className="rounded-xl bg-slate-800 hover:bg-slate-700 p-2 text-slate-200 transition"
                              title={lang === 'bn' ? 'প্রিভিউ দেখুন' : 'Play preview'}
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </section>
          </div>
        )}

        {/* TAB 2: DOWNLOADS & QUEUE */}
        {activeTab === 'downloads' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <HardDriveDownload className="w-5 h-5 text-rose-500" />
                  <span>
                    {lang === 'bn' ? 'ডাউনলোড তালিকা ও হিস্ট্রি' : 'Downloads & History'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {lang === 'bn'
                    ? 'আপনার ডাউনলোড করা ভিডিও ও অডিও ফাইলের লাইভ প্রগ্রেস এবং পুনরায় ডাউনলোড অপশন'
                    : 'Track live byte progress, replay streams, or re-save completed downloads'}
                </p>
              </div>

              {downloads.length > 0 && (
                <button
                  onClick={() => setDownloads([])}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/50 border border-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:text-rose-300 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'সব মুছুন' : 'Clear All'}</span>
                </button>
              )}
            </div>

            {downloads.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-[#101422] p-12 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto">
                  <Download className="w-7 h-7 text-slate-500" />
                </div>
                <h3 className="text-base font-semibold text-white">
                  {lang === 'bn' ? 'এখনো কোনো ডাউনলোড নেই' : 'No downloads yet'}
                </h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {lang === 'bn'
                    ? 'হোম পেজে গিয়ে যেকোনো ভিডিও লিংক পেস্ট করুন অথবা সার্চ করে ডাউনলোড বাটনে ক্লিক করুন।'
                    : 'Paste a video link or search on the Home tab to start downloading videos & MP3s.'}
                </p>
                <button
                  onClick={() => setActiveTab('home')}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] px-4 py-2 text-xs font-bold text-white"
                >
                  {lang === 'bn' ? 'সার্চ ও ডাউনলোড শুরু করুন' : 'Go to Search & Download'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {downloads.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-2xl border border-slate-800 bg-[#101422] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      {d.thumbnail ? (
                        <img
                          src={d.thumbnail}
                          alt={d.title}
                          className="w-20 h-14 rounded-xl object-cover bg-slate-900 shrink-0 border border-slate-800"
                        />
                      ) : (
                        <div className="w-20 h-14 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                          {d.ext === 'mp3' || d.ext === 'm4a' ? (
                            <Music className="w-6 h-6 text-rose-400" />
                          ) : (
                            <Film className="w-6 h-6 text-violet-400" />
                          )}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
                            {d.ext}
                          </span>
                          <span className="text-xs text-slate-400">{d.platformName}</span>
                          <span className="text-xs text-slate-500">• {d.formatLabel}</span>
                        </div>
                        <h4 className="text-sm font-semibold text-white truncate mt-0.5">
                          {d.title}
                        </h4>

                        {/* Progress Bar */}
                        <div className="mt-2">
                          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 ${
                                d.status === 'completed' || d.status === 'opened_external'
                                  ? 'bg-emerald-500'
                                  : d.status === 'failed'
                                    ? 'bg-rose-500'
                                    : 'bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6]'
                              }`}
                              style={{ width: `${Math.max(4, d.progress)}%` }}
                            />
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                            <span>
                              {d.status === 'downloading' &&
                                `${lang === 'bn' ? 'ডাউনলোড হচ্ছে' : 'Downloading'} (${d.progress}%) ${
                                  d.downloadedBytes > 0 ? `• ${formatBytes(d.downloadedBytes)}` : ''
                                }`}
                              {d.status === 'completed' && (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {lang === 'bn' ? 'ফোনে/পিসিতে সেভ হয়েছে' : 'Saved to device'}{' '}
                                  {d.downloadedBytes > 0 ? `(${formatBytes(d.downloadedBytes)})` : ''}
                                </span>
                              )}
                              {d.status === 'opened_external' && (
                                <span className="inline-flex items-center gap-1 text-cyan-300 font-medium">
                                  <CheckCircle2 className="w-3 h-3" />
                                  {lang === 'bn'
                                    ? 'ব্রাউজার ডাউনলোডারে পাঠানো হয়েছে'
                                    : 'Sent to browser downloader'}
                                </span>
                              )}
                              {d.status === 'failed' && (
                                <span className="text-rose-400">{d.error || 'Failed'}</span>
                              )}
                            </span>
                            <span className="inline-flex items-center gap-1 text-slate-500">
                              <Clock className="w-3 h-3" />
                              {new Date(d.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        download
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-white transition"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'ডিরেক্ট ফাইল' : 'Direct Link'}</span>
                      </a>
                      <button
                        onClick={() =>
                          setDownloads((prev) => prev.filter((item) => item.id !== d.id))
                        }
                        className="rounded-xl bg-slate-900 hover:bg-slate-800 p-2 text-slate-400 hover:text-rose-400 transition"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: APK LINK ANALYSIS & MATCHED ENDPOINTS */}
        {activeTab === 'audit' && (
          <LinkAuditView
            lang={lang}
            onTestSampleUrl={(sampleUrl) => {
              setInputVal(sampleUrl);
              handleResolveUrl(sampleUrl);
            }}
          />
        )}

        {/* TAB 4: SETTINGS & ENGINE */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="rounded-2xl border border-slate-800 bg-[#101422] p-5 space-y-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-violet-400" />
                <span>{lang === 'bn' ? 'অ্যাপ ও ইঞ্জিন সেটিংস' : 'App & Extraction Engine Settings'}</span>
              </h2>

              {/* Language */}
              <div className="flex items-center justify-between gap-4 py-3 border-b border-slate-800/80">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {lang === 'bn' ? 'অ্যাপের ভাষা (Language)' : 'Interface Language'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {lang === 'bn' ? 'বাংলা অথবা ইংরেজি বেছে নিন' : 'Choose Bangla or English UI'}
                  </p>
                </div>
                <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
                  <button
                    onClick={() => setLang('bn')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      lang === 'bn' ? 'bg-rose-500 text-white' : 'text-slate-400'
                    }`}
                  >
                    বাংলা
                  </button>
                  <button
                    onClick={() => setLang('en')}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                      lang === 'en' ? 'bg-rose-500 text-white' : 'text-slate-400'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Engine Status */}
              <div className="py-3 border-b border-slate-800/80 space-y-2">
                <p className="text-sm font-semibold text-white">
                  {lang === 'bn' ? 'ডাউনলোড ইঞ্জিন স্ট্যাটাস' : 'Extraction Engine Diagnostics'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                    <span className="text-slate-400 block mb-1">Active Mode</span>
                    <span className="font-semibold text-emerald-400">
                      {engineHealth?.engineMode || 'Hybrid Multi-Engine'}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
                    <span className="text-slate-400 block mb-1">yt-dlp Backend Binary</span>
                    <span className="font-semibold text-cyan-300">
                      {engineHealth?.ytdlpInstalled
                        ? `Installed (v${engineHealth.ytdlpVersion})`
                        : 'Serverless HTTP + Browser Hybrid'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Custom Cobalt API Instance */}
              <div className="py-2 space-y-2">
                <label className="block text-sm font-semibold text-white">
                  {lang === 'bn'
                    ? 'কাস্টম Cobalt API URL (ঐচ্ছিক — YouTube/IG/FB 1080p বুস্টার)'
                    : 'Custom Cobalt API Instance URL (Optional)'}
                </label>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {lang === 'bn'
                    ? 'আপনার নিজস্ব বা পাবলিক Cobalt v10/v7 সার্ভার থাকলে তার URL দিন (যেমন https://cobalt.example.com)। খালি রাখলে বিল্ট-ইন মাল্টি-ইঞ্জিন ব্যবহৃত হবে।'
                    : 'Optionally connect a self-hosted Cobalt instance for additional YouTube/Instagram/Facebook muxed streams.'}
                </p>
                <input
                  type="url"
                  value={cobaltApiUrl}
                  onChange={(e) => setCobaltApiUrl(e.target.value)}
                  placeholder="https://your-cobalt-instance.example.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-rose-500 focus:outline-none"
                />
              </div>

              {/* Android Share Target Guide */}
              <div className="pt-2">
                <button
                  onClick={() => setShareModalOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF2E63] to-[#8B5CF6] px-4 py-3 text-xs sm:text-sm font-bold text-white shadow-lg"
                >
                  <Smartphone className="w-4 h-4" />
                  <span>
                    {lang === 'bn'
                      ? 'ফোনে ইনস্টল ও Share Menu সেটআপ গাইড দেখুন'
                      : 'Open Phone Install & Android Share Menu Guide'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Native-Style Bottom Tab Navigation */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-800/90 bg-[#0B0E17]/95 backdrop-blur-xl px-2 py-1.5">
        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-semibold transition ${
              activeTab === 'home' ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400'
            }`}
          >
            <Compass className="w-5 h-5 mb-0.5" />
            <span>{lang === 'bn' ? 'হোম' : 'Home'}</span>
          </button>

          <button
            onClick={() => setActiveTab('downloads')}
            className={`relative flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-semibold transition ${
              activeTab === 'downloads' ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400'
            }`}
          >
            <HardDriveDownload className="w-5 h-5 mb-0.5" />
            <span>{lang === 'bn' ? 'ডাউনলোড' : 'Downloads'}</span>
            {downloads.length > 0 && (
              <span className="absolute top-1 right-5 rounded-full bg-rose-500 px-1.5 text-[9px] font-bold text-white">
                {downloads.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-semibold transition ${
              activeTab === 'audit' ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400'
            }`}
          >
            <ShieldCheck className="w-5 h-5 mb-0.5" />
            <span>{lang === 'bn' ? 'লিংক ম্যাচ' : 'Links'}</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`flex flex-col items-center justify-center py-1.5 rounded-xl text-[11px] font-semibold transition ${
              activeTab === 'settings' ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400'
            }`}
          >
            <Settings className="w-5 h-5 mb-0.5" />
            <span>{lang === 'bn' ? 'সেটিংস' : 'Settings'}</span>
          </button>
        </div>
      </nav>

      {/* Modals */}
      <PreviewModal
        open={previewState.open}
        onClose={() => setPreviewState((p) => ({ ...p, open: false }))}
        title={previewState.title}
        author={previewState.author}
        streamUrl={previewState.streamUrl}
        embedUrl={previewState.embedUrl}
        thumbnail={previewState.thumbnail}
        isAudio={previewState.isAudio}
        sourceUrl={previewState.sourceUrl}
      />

      <ShareInstallModal
        open={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        canInstallPwa={canInstallPwa}
        onInstallPwa={handleInstallPwa}
        lang={lang}
      />
    </div>
  );
}
