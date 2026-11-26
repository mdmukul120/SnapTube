import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  Globe2,
  Info,
  ListVideo,
  Menu,
  MonitorPlay,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Signal,
  Sparkles,
  Star,
  Trash2,
  Tv,
  X,
} from 'lucide-react';
import { categories, fixturePreviews, starterChannels, STORAGE_KEYS } from './data.js';
import { fetchProviderChannels, fetchProviderFixtures, fetchProviderScores } from './services/api.js';

const en = {
  discover: 'Discover',
  ready: 'Ready to watch',
  channels: 'Channels',
  fixtures: 'Fixtures',
  scores: 'Scores',
  saved: 'My list',
  manage: 'Manage lineup',
  explore: 'Explore',
  yourSpace: 'Your space',
  library: 'Library',
  tagline: 'Your matchday, your way',
  pageHomeTitle: 'The game is better together.',
  pageHomeSubtitle: 'Your sports hub for fixture previews, channels and streams you are authorized to watch.',
  pageReadyTitle: 'Your ready-to-watch lineup',
  pageReadySubtitle: 'Only channels with a source configured in this browser appear here.',
  pageChannelsTitle: 'Find your next channel',
  pageChannelsSubtitle: 'Browse your lineup, then add an authorized HLS or video source.',
  pageFixturesTitle: 'The fixture board',
  pageFixturesSubtitle: 'Browse match schedules from your configured sports data provider.',
  pageScoresTitle: 'Match scores',
  pageScoresSubtitle: 'Follow score updates from your configured sports data provider.',
  pageSavedTitle: 'Your personal watchlist',
  pageSavedSubtitle: 'The channels you have saved on this device.',
  pageManageTitle: 'Make the lineup yours',
  pageManageSubtitle: 'Add channels and manage playback sources. Changes stay in this browser.',
  heroKicker: 'A better home for matchday',
  heroLineOne: 'Every game.',
  heroLineTwo: 'One home.',
  heroDescription: 'Follow the fixtures, keep your favourites close, and play streams you have permission to watch.',
  browseChannels: 'Explore channels',
  configureStream: 'Set up a stream',
  licensedOnly: 'Only use sources you own or are licensed to distribute.',
  featured: 'Your channels',
  featuredNote: 'A few places to start',
  seeAll: 'See all',
  upcoming: 'Fixtures & events',
  upcomingNote: 'Illustrative preview cards · no provider configured',
  providerEventsNote: 'Events from your configured data provider',
  addChannel: 'Add channel',
  searchPlaceholder: 'Search channels…',
  allSports: 'All sports',
  noChannels: 'No channels found',
  noChannelsText: 'Try another search or add a channel to your lineup.',
  readyEmpty: 'No streams set up yet',
  readyEmptyText: 'Add a licensed HLS, MP4 or WebM source to a channel to make it ready to watch.',
  savedEmpty: 'Your list is waiting',
  savedEmptyText: 'Tap the star on any channel to save it here.',
  scheduleEmpty: 'Fixture feed is not configured',
  scheduleEmptyText: 'Sample cards are shown until a sports data provider is configured.',
  fixtureFeedConnected: 'Sports schedule connected',
  fixtureFeedConnectedText: 'Events below are supplied by your configured sports data provider.',
  fixtureFeedUnavailableText: 'The schedule provider could not be reached. Try again after checking your server-side API settings.',
  scoreFeedUnavailableText: 'The score provider could not be reached. Check your server-side API settings and try again.',
  sourceAdded: 'Source added',
  addSource: 'Add source',
  setupRequired: 'Setup required',
  watch: 'Watch',
  sourceReady: 'Source ready',
  multipleLinks: 'Multiple links',
  chooseStream: 'Choose a stream',
  floatingPlayer: 'Floating player',
  floatingPlayerUnavailable: 'Picture-in-picture is not available in this browser.',
  preview: 'Preview',
  localPreview: 'Browser preview',
  localOnly: 'Saved in this browser only',
  notificationTitle: 'No updates yet',
  notificationText: 'Fixture alerts will appear here after a schedule feed is connected.',
  setupSources: 'Set up sources',
  channelsStat: 'Channels',
  sourcesStat: 'Sources ready',
  savedStat: 'Saved',
  previewData: 'Preview data',
  feedLoading: 'Checking data feed…',
  feedConnected: 'Sports feed connected',
  feedSetupNeeded: 'API setup needed',
  feedUnavailable: 'Provider unavailable',
  refreshData: 'Refresh sports data',
  scoreEmpty: 'No scores available',
  scoreEmptyText: 'Configure an authorized scores provider to show current match scores here.',
  fixtureEmpty: 'No fixtures returned',
  fixtureEmptyText: 'Your provider is connected, but it has not returned any events yet.',
  liveData: 'Provider data',
  sourceInfoTitle: 'A note about streams',
  sourceInfoText: 'This preview does not include third-party stream links. Add only direct sources you own or are licensed to use.',
  openManage: 'Open lineup setup',
  scheduleFeed: 'Schedule feed not connected',
  sampleFixture: 'Sample fixture',
  sampleOnly: 'Sample only',
  setupSourceTitle: 'Configure a channel',
  setupSourceDescription: 'Paste a direct, authorized playback URL. Embedded pages and DRM-protected streams are not supported.',
  channelName: 'Channel name',
  category: 'Category',
  shortDescription: 'Short description',
  playbackUrl: 'Direct playback URL',
  urlHint: 'Supported: HTTPS HLS (.m3u8), MP4 or WebM. Keep private signed URLs on trusted devices only.',
  rightsNotice: 'I have the rights to use and distribute this stream.',
  saveChannel: 'Save channel',
  cancel: 'Cancel',
  invalidUrl: 'Enter a valid HTTPS or HTTP URL.',
  unsupportedUrl: 'Use a direct .m3u8, .mp4 or .webm URL. Embed pages are not supported.',
  missingName: 'Add a channel name to continue.',
  rightsRequired: 'Please confirm you are allowed to use this stream.',
  channelSaved: 'Channel saved in this browser',
  channelRemoved: 'Channel removed',
  setupEmptySource: 'Add a source to get started',
  setupEmptySourceText: 'Create your own lineup with channels you are authorized to distribute.',
  edit: 'Edit',
  remove: 'Remove',
  addFirstChannel: 'Add your first channel',
  clearDemo: 'Restore demo lineup',
  localStorageNote: 'This is a front-end preview. Channel data and favourites are stored in local browser storage, not on a server.',
  rightsTitle: 'Content rights matter',
  rightsText: 'Use streams, logos and fixtures only when you have permission. This player supports direct HLS and video URLs; it does not bypass DRM or access controls.',
  fixtureRightsNote: 'Fixture cards are illustrative placeholders, not confirmed or live events.',
  playerTitle: 'Now playing',
  noSourceTitle: 'No source attached yet',
  noSourceText: 'Add a direct HLS or video source that you are authorized to play.',
  playbackHelp: 'Playback needs a direct HLS (.m3u8), MP4 or WebM URL. The media host must allow this site through CORS.',
  playbackError: 'Could not play this source. Check the URL, provider availability and CORS settings.',
  close: 'Close',
  streamSetup: 'Configure source',
  languageLabel: 'Toggle language',
  guestProfile: 'Guest profile',
  builtForFans: 'Built for fans',
  moreInfo: 'More info',
  sampleEvent: 'Fixture preview',
  addMore: 'Add another channel',
  backToDiscover: 'Back to Discover',
};

const bn = {
  discover: 'আবিষ্কার',
  ready: 'দেখার জন্য প্রস্তুত',
  channels: 'চ্যানেল',
  fixtures: 'সূচি',
  scores: 'স্কোর',
  saved: 'আমার তালিকা',
  manage: 'লাইনআপ পরিচালনা',
  explore: 'এক্সপ্লোর',
  yourSpace: 'আপনার জায়গা',
  library: 'লাইব্রেরি',
  tagline: 'আপনার ম্যাচডে, আপনার মতো',
  pageHomeTitle: 'খেলা আরও ভালো, একসঙ্গে।',
  pageHomeSubtitle: 'ম্যাচের প্রিভিউ, চ্যানেল এবং অনুমোদিত স্ট্রিমের জন্য আপনার স্পোর্টস হাব।',
  pageReadyTitle: 'দেখার জন্য প্রস্তুত লাইনআপ',
  pageReadySubtitle: 'এই ব্রাউজারে উৎস যোগ করা চ্যানেলগুলো এখানে দেখানো হবে।',
  pageChannelsTitle: 'আপনার পছন্দের চ্যানেল খুঁজুন',
  pageChannelsSubtitle: 'লাইনআপ দেখুন, তারপর অনুমোদিত HLS বা ভিডিও উৎস যোগ করুন।',
  pageFixturesTitle: 'ম্যাচের সূচি',
  pageFixturesSubtitle: 'আপনার কনফিগার করা স্পোর্টস ডেটা-সেবার ম্যাচের সময় দেখুন।',
  pageScoresTitle: 'ম্যাচের স্কোর',
  pageScoresSubtitle: 'আপনার কনফিগার করা ডেটা-সেবা থেকে স্কোর আপডেট দেখুন।',
  pageSavedTitle: 'আপনার পছন্দের তালিকা',
  pageSavedSubtitle: 'এই ডিভাইসে সংরক্ষিত চ্যানেলগুলো।',
  pageManageTitle: 'নিজের মতো লাইনআপ সাজান',
  pageManageSubtitle: 'চ্যানেল ও প্লেব্যাক উৎস যোগ করুন। পরিবর্তন এই ব্রাউজারেই থাকবে।',
  heroKicker: 'ম্যাচডের আরও ভালো ঠিকানা',
  heroLineOne: 'সব খেলা।',
  heroLineTwo: 'এক ঠিকানায়।',
  heroDescription: 'সূচি দেখুন, পছন্দের চ্যানেল রাখুন, আর অনুমতি আছে এমন স্ট্রিম চালান।',
  browseChannels: 'চ্যানেল দেখুন',
  configureStream: 'স্ট্রিম সেটআপ',
  licensedOnly: 'নিজের বা বিতরণের অনুমতি আছে এমন উৎসই ব্যবহার করুন।',
  featured: 'আপনার চ্যানেল',
  featuredNote: 'শুরু করার কয়েকটি জায়গা',
  seeAll: 'সব দেখুন',
  upcoming: 'সূচি ও ইভেন্ট',
  upcomingNote: 'উদাহরণ কার্ড · কোনো ডেটা-সেবা যুক্ত নেই',
  providerEventsNote: 'কনফিগার করা ডেটা-সেবার ইভেন্ট',
  addChannel: 'চ্যানেল যোগ করুন',
  searchPlaceholder: 'চ্যানেল খুঁজুন…',
  allSports: 'সব খেলা',
  noChannels: 'কোনো চ্যানেল পাওয়া যায়নি',
  noChannelsText: 'অন্যভাবে খুঁজুন অথবা লাইনআপে চ্যানেল যোগ করুন।',
  readyEmpty: 'এখনও কোনো স্ট্রিম সেটআপ নেই',
  readyEmptyText: 'অনুমোদিত HLS, MP4 বা WebM উৎস যোগ করলে চ্যানেল দেখার জন্য প্রস্তুত হবে।',
  savedEmpty: 'আপনার তালিকা তৈরি হয়নি',
  savedEmptyText: 'এখানে রাখতে যেকোনো চ্যানেলের তারকা চিহ্নে চাপ দিন।',
  scheduleEmpty: 'সূচি-সেবা কনফিগার করা হয়নি',
  scheduleEmptyText: 'স্পোর্টস ডেটা-সেবা কনফিগার না করা পর্যন্ত নমুনা কার্ড দেখানো হবে।',
  fixtureFeedConnected: 'স্পোর্টস সূচি যুক্ত হয়েছে',
  fixtureFeedConnectedText: 'নিচের ইভেন্টগুলো আপনার কনফিগার করা ডেটা-সেবা থেকে এসেছে।',
  fixtureFeedUnavailableText: 'সূচি-সেবায় সংযোগ পাওয়া যাচ্ছে না। সার্ভার-সাইড API সেটিং দেখে আবার চেষ্টা করুন।',
  scoreFeedUnavailableText: 'স্কোর-সেবায় সংযোগ পাওয়া যাচ্ছে না। সার্ভার-সাইড API সেটিং দেখে আবার চেষ্টা করুন।',
  sourceAdded: 'উৎস যোগ হয়েছে',
  addSource: 'উৎস যোগ করুন',
  setupRequired: 'সেটআপ প্রয়োজন',
  watch: 'দেখুন',
  sourceReady: 'উৎস প্রস্তুত',
  multipleLinks: 'একাধিক লিংক',
  chooseStream: 'স্ট্রিম বেছে নিন',
  floatingPlayer: 'ফ্লোটিং প্লেয়ার',
  floatingPlayerUnavailable: 'এই ব্রাউজারে পিকচার-ইন-পিকচার পাওয়া যাচ্ছে না।',
  preview: 'প্রিভিউ',
  localPreview: 'ব্রাউজার প্রিভিউ',
  localOnly: 'শুধু এই ব্রাউজারে সংরক্ষিত',
  notificationTitle: 'এখনও কোনো আপডেট নেই',
  notificationText: 'সূচি-সেবা যুক্ত হলে ম্যাচের সতর্কতা এখানে দেখা যাবে।',
  setupSources: 'উৎস সেটআপ',
  channelsStat: 'চ্যানেল',
  sourcesStat: 'প্রস্তুত উৎস',
  savedStat: 'সংরক্ষিত',
  previewData: 'প্রিভিউ ডেটা',
  feedLoading: 'ডেটা-সেবা দেখা হচ্ছে…',
  feedConnected: 'স্পোর্টস ডেটা যুক্ত',
  feedSetupNeeded: 'API সেটআপ প্রয়োজন',
  feedUnavailable: 'ডেটা-সেবা পাওয়া যাচ্ছে না',
  refreshData: 'স্পোর্টস ডেটা রিফ্রেশ',
  scoreEmpty: 'কোনো স্কোর পাওয়া যায়নি',
  scoreEmptyText: 'এখানে ম্যাচের স্কোর দেখতে অনুমোদিত স্কোর-সেবা কনফিগার করুন।',
  fixtureEmpty: 'কোনো সূচি পাওয়া যায়নি',
  fixtureEmptyText: 'ডেটা-সেবা যুক্ত আছে, তবে এখনো কোনো ইভেন্ট পাঠায়নি।',
  liveData: 'ডেটা-সেবা',
  sourceInfoTitle: 'স্ট্রিম সম্পর্কে',
  sourceInfoText: 'এই প্রিভিউতে তৃতীয় পক্ষের স্ট্রিম লিংক নেই। নিজের বা ব্যবহারের অনুমতি আছে এমন উৎস যোগ করুন।',
  openManage: 'লাইনআপ সেটআপ খুলুন',
  scheduleFeed: 'সূচি-সেবা যুক্ত নেই',
  sampleFixture: 'নমুনা ম্যাচ',
  sampleOnly: 'শুধু নমুনা',
  setupSourceTitle: 'চ্যানেল সেটআপ',
  setupSourceDescription: 'অনুমোদিত সরাসরি প্লেব্যাক URL দিন। এম্বেড পেজ ও DRM-সুরক্ষিত স্ট্রিম সমর্থিত নয়।',
  channelName: 'চ্যানেলের নাম',
  category: 'বিভাগ',
  shortDescription: 'সংক্ষিপ্ত বিবরণ',
  playbackUrl: 'সরাসরি প্লেব্যাক URL',
  urlHint: 'সমর্থিত: HTTPS HLS (.m3u8), MP4 বা WebM। ব্যক্তিগত সাইনড লিংক নিরাপদ ডিভাইসেই রাখুন।',
  rightsNotice: 'এই স্ট্রিম ব্যবহার ও বিতরণের অধিকার আমার আছে।',
  saveChannel: 'চ্যানেল সংরক্ষণ',
  cancel: 'বাতিল',
  invalidUrl: 'বৈধ HTTPS বা HTTP URL দিন।',
  unsupportedUrl: 'সরাসরি .m3u8, .mp4 বা .webm URL ব্যবহার করুন। এম্বেড পেজ সমর্থিত নয়।',
  missingName: 'চালিয়ে যেতে চ্যানেলের নাম দিন।',
  rightsRequired: 'স্ট্রিম ব্যবহারের অনুমতি আছে—এটি নিশ্চিত করুন।',
  channelSaved: 'চ্যানেল এই ব্রাউজারে সংরক্ষিত হয়েছে',
  channelRemoved: 'চ্যানেল সরানো হয়েছে',
  setupEmptySource: 'শুরু করতে উৎস যোগ করুন',
  setupEmptySourceText: 'বিতরণের অনুমতি আছে এমন চ্যানেল দিয়ে নিজের লাইনআপ সাজান।',
  edit: 'সম্পাদনা',
  remove: 'সরান',
  addFirstChannel: 'প্রথম চ্যানেল যোগ করুন',
  clearDemo: 'নমুনা লাইনআপ ফিরিয়ে আনুন',
  localStorageNote: 'এটি ওয়েব প্রিভিউ। চ্যানেল ও পছন্দের তালিকা সার্ভারে নয়, ব্রাউজারে সংরক্ষিত থাকে।',
  rightsTitle: 'কনটেন্টের অধিকার গুরুত্বপূর্ণ',
  rightsText: 'অনুমতি ছাড়া স্ট্রিম, লোগো বা সূচি ব্যবহার করবেন না। প্লেয়ার সরাসরি HLS ও ভিডিও URL চালায়; DRM বা অ্যাক্সেস নিয়ন্ত্রণ এড়িয়ে যায় না।',
  fixtureRightsNote: 'ম্যাচের কার্ডগুলো উদাহরণ—নিশ্চিত বা লাইভ ইভেন্ট নয়।',
  playerTitle: 'এখন চলছে',
  noSourceTitle: 'এখনও কোনো উৎস যোগ হয়নি',
  noSourceText: 'অনুমোদিত সরাসরি HLS বা ভিডিও উৎস যোগ করুন।',
  playbackHelp: 'সরাসরি HLS (.m3u8), MP4 বা WebM URL লাগবে। মিডিয়া হোস্টে এই সাইটের CORS অনুমতি থাকতে হবে।',
  playbackError: 'এই উৎস চালানো যায়নি। URL, সেবা এবং CORS সেটিং যাচাই করুন।',
  close: 'বন্ধ',
  streamSetup: 'উৎস সেটআপ',
  languageLabel: 'ভাষা বদলান',
  guestProfile: 'অতিথি প্রোফাইল',
  builtForFans: 'ভক্তদের জন্য তৈরি',
  moreInfo: 'আরও তথ্য',
  sampleEvent: 'ম্যাচ প্রিভিউ',
  addMore: 'আরও চ্যানেল যোগ করুন',
  backToDiscover: 'আবিষ্কারে ফিরুন',
};

const contentKeys = {
  home: { title: 'pageHomeTitle', subtitle: 'pageHomeSubtitle' },
  live: { title: 'pageReadyTitle', subtitle: 'pageReadySubtitle' },
  channels: { title: 'pageChannelsTitle', subtitle: 'pageChannelsSubtitle' },
  fixtures: { title: 'pageFixturesTitle', subtitle: 'pageFixturesSubtitle' },
  scores: { title: 'pageScoresTitle', subtitle: 'pageScoresSubtitle' },
  saved: { title: 'pageSavedTitle', subtitle: 'pageSavedSubtitle' },
  manage: { title: 'pageManageTitle', subtitle: 'pageManageSubtitle' },
};

function readStorage(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (!stored) return fallback;
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full storage quota should not break the preview.
  }
}

function makeId(name) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const random = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${slug || 'channel'}-${random}`;
}

function App() {
  const [view, setView] = useState('home');
  const [channels, setChannels] = useState(() => readStorage(STORAGE_KEYS.channels, starterChannels));
  const [favorites, setFavorites] = useState(() => readStorage(STORAGE_KEYS.favorites, []));
  const [category, setCategory] = useState('All sports');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [language, setLanguage] = useState('en');
  const [configChannel, setConfigChannel] = useState(null);
  const [configOpen, setConfigOpen] = useState(false);
  const [playerChannel, setPlayerChannel] = useState(null);
  const [toast, setToast] = useState('');
  const [channelFeed, setChannelFeed] = useState({ configured: false, items: [], error: false });
  const [fixtureFeed, setFixtureFeed] = useState({ configured: false, items: [], error: false });
  const [scoreFeed, setScoreFeed] = useState({ configured: false, items: [], error: false });
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedRefreshKey, setFeedRefreshKey] = useState(0);
  const searchRef = useRef(null);
  const t = useMemo(() => (key) => (language === 'bn' ? bn[key] : en[key]) ?? en[key] ?? key, [language]);

  useEffect(() => writeStorage(STORAGE_KEYS.channels, channels), [channels]);
  useEffect(() => writeStorage(STORAGE_KEYS.favorites, favorites), [favorites]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setFeedLoading(true);

    Promise.all([
      fetchProviderChannels(controller.signal),
      fetchProviderFixtures(controller.signal),
      fetchProviderScores(controller.signal),
    ]).then(([channelsResult, fixturesResult, scoresResult]) => {
      if (!active) return;
      setChannelFeed(channelsResult);
      setFixtureFeed(fixturesResult);
      setScoreFeed(scoresResult);
    }).catch(() => {
      if (!active) return;
      setChannelFeed({ configured: false, items: [], error: true });
      setFixtureFeed({ configured: false, items: [], error: true });
      setScoreFeed({ configured: false, items: [], error: true });
    }).finally(() => {
      if (active) setFeedLoading(false);
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [feedRefreshKey]);
  useEffect(() => {
    if (!scoreFeed.configured) return undefined;
    const controller = new AbortController();
    const refreshScoreFeed = () => {
      fetchProviderScores(controller.signal).then((result) => {
        if (!controller.signal.aborted) setScoreFeed(result);
      });
    };
    const timer = window.setInterval(refreshScoreFeed, 60_000);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [scoreFeed.configured]);
  useEffect(() => {
    document.documentElement.lang = language === 'bn' ? 'bn' : 'en';
  }, [language]);
  useEffect(() => setCategory('All sports'), [view]);
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const toastTimerRef = useRef(null);
  const showToast = (message) => {
    setToast(message);
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(''), 2800);
  };

  const openConfig = (channel = null) => {
    const editableChannel = channel?.isProvider
      ? { ...channel, id: undefined, isProvider: false, isCustom: true }
      : channel;
    setConfigChannel(editableChannel);
    setConfigOpen(true);
  };

  const changeView = (nextView) => {
    setView(nextView);
    setMobileNavOpen(false);
    setNotificationsOpen(false);
  };

  const openSearch = () => {
    setSearchOpen(true);
    setNotificationsOpen(false);
  };

  const closeSearch = () => {
    setSearchOpen(false);
    setSearchTerm('');
  };

  const toggleFavorite = (id) => {
    setFavorites((current) => (
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    ));
  };

  const saveChannel = (payload) => {
    const channel = {
      ...payload,
      id: payload.id || makeId(payload.name),
      streamUrl: payload.streamUrl || '',
      isCustom: payload.isCustom ?? true,
    };
    setChannels((current) => {
      const exists = current.some((item) => item.id === channel.id);
      return exists
        ? current.map((item) => (item.id === channel.id ? channel : item))
        : [channel, ...current];
    });
    setConfigChannel(null);
    setConfigOpen(false);
    showToast(t('channelSaved'));
  };

  const removeChannel = (id) => {
    setChannels((current) => current.filter((channel) => channel.id !== id));
    setFavorites((current) => current.filter((favorite) => favorite !== id));
    showToast(t('channelRemoved'));
  };

  const restoreDemo = () => {
    setChannels(starterChannels);
    setFavorites([]);
    showToast(t('clearDemo'));
  };

  const allChannels = useMemo(() => [...channelFeed.items, ...channels], [channelFeed.items, channels]);
  const fixturesForDisplay = fixtureFeed.configured ? fixtureFeed.items : fixturePreviews;
  const providerFeaturedMatch = scoreFeed.items[0] || fixtureFeed.items[0];
  const featuredMatch = providerFeaturedMatch || fixturePreviews[0];
  const featuredMatchIsSample = !providerFeaturedMatch;
  const providerConfigured = channelFeed.configured || fixtureFeed.configured || scoreFeed.configured;
  const providerUnavailable = channelFeed.error || fixtureFeed.error || scoreFeed.error;
  const feedStatusKey = feedLoading
    ? 'feedLoading'
    : providerUnavailable
      ? 'feedUnavailable'
      : providerConfigured
        ? 'feedConnected'
        : 'feedSetupNeeded';

  const filteredChannels = useMemo(() => {
    let list = allChannels;
    if (view === 'saved') list = list.filter((channel) => favorites.includes(channel.id));
    if (view === 'live') list = list.filter((channel) => Boolean(channel.streamUrl));
    if (category !== 'All sports' && (view === 'home' || view === 'channels')) {
      list = list.filter((channel) => channel.category === category);
    }
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      list = list.filter((channel) => (
        `${channel.name} ${channel.category} ${channel.subtitle || ''}`.toLowerCase().includes(query)
      ));
    }
    if (view === 'home' && !query) return list.slice(0, 4);
    return list;
  }, [allChannels, favorites, category, view, searchTerm]);

  const filteredScores = useMemo(() => {
    let list = scoreFeed.items;
    if (category !== 'All sports') list = list.filter((score) => score.sport === category);
    const query = searchTerm.trim().toLowerCase();
    if (query) {
      list = list.filter((score) => (
        `${score.home} ${score.away} ${score.competition || ''} ${score.sport} ${score.status || ''}`.toLowerCase().includes(query)
      ));
    }
    return list;
  }, [scoreFeed.items, category, searchTerm]);

  const pageMeta = contentKeys[view] || contentKeys.home;
  const pageTitle = t(pageMeta.title);
  const pageSubtitle = t(pageMeta.subtitle);
  const readyCount = allChannels.filter((channel) => Boolean(channel.streamUrl)).length;
  const dateLabel = new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  const navGroups = [
    {
      heading: t('explore'),
      items: [
        { id: 'home', label: t('discover'), Icon: Compass },
        { id: 'live', label: t('ready'), Icon: Signal, count: readyCount || null },
        { id: 'channels', label: t('channels'), Icon: Tv },
        { id: 'fixtures', label: t('fixtures'), Icon: CalendarDays },
        { id: 'scores', label: t('scores'), Icon: Activity, count: scoreFeed.items.length || null },
      ],
    },
    {
      heading: t('library'),
      items: [
        { id: 'saved', label: t('saved'), Icon: Bookmark, count: favorites.length || null },
        { id: 'manage', label: t('manage'), Icon: Settings2 },
      ],
    },
  ];

  return (
    <div className="app-shell">
      {mobileNavOpen && (
        <button
          type="button"
          className="mobile-scrim"
          aria-label={t('close')}
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileNavOpen ? 'sidebar-open' : ''}`}>
        <button type="button" className="brand" onClick={() => changeView('home')} aria-label="CRICFy TV home">
          <span className="brand-mark"><span>c</span><i /></span>
          <span className="brand-copy"><strong>CRICFy<span>TV</span></strong><small>{t('tagline')}</small></span>
        </button>

        <div className="sidebar-preview"><span className="preview-dot" />{t('localPreview')}</div>

        <nav className="side-nav" aria-label="Main navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.heading}>
              <p className="nav-heading">{group.heading}</p>
              {group.items.map(({ id, label, Icon, count }) => (
                <button
                  type="button"
                  key={id}
                  className={`nav-link ${view === id ? 'nav-link-active' : ''}`}
                  onClick={() => changeView(id)}
                  aria-current={view === id ? 'page' : undefined}
                  title={label}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{label}</span>
                  {count ? <em>{count}</em> : null}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-rights">
          <div className="rights-icon"><ShieldCheck size={17} /></div>
          <div><strong>{t('builtForFans')}</strong><span>{t('licensedOnly')}</span></div>
        </div>
        <button type="button" className="profile-row" onClick={() => changeView('manage')}>
          <span className="profile-avatar">CF</span>
          <span className="profile-copy"><strong>{t('guestProfile')}</strong><small>{t('localOnly')}</small></span>
          <ChevronDown size={15} />
        </button>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <div className="topbar-left">
            <button
              type="button"
              className="icon-button mobile-menu-button"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="breadcrumb"><span>CRICFy TV</span><ChevronRight size={13} /><strong>{t(view === 'home' ? 'discover' : view === 'live' ? 'ready' : view === 'channels' ? 'channels' : view === 'fixtures' ? 'fixtures' : view === 'scores' ? 'scores' : view === 'saved' ? 'saved' : 'manage')}</strong></div>
          </div>
          <div className="topbar-actions">
            {searchOpen ? (
              <div className="search-box">
                <Search size={17} />
                <input
                  ref={searchRef}
                  type="search"
                  value={searchTerm}
                  placeholder={t('searchPlaceholder')}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  onKeyDown={(event) => event.key === 'Escape' && closeSearch()}
                  aria-label={t('searchPlaceholder')}
                />
                <button type="button" className="search-close" onClick={closeSearch} aria-label={t('close')}><X size={15} /></button>
              </div>
            ) : (
              <button type="button" className="icon-button" onClick={openSearch} aria-label="Search channels" title="Search">
                <Search size={18} />
              </button>
            )}

            <button
              type="button"
              className="language-button"
              onClick={() => setLanguage((current) => current === 'en' ? 'bn' : 'en')}
              aria-label={t('languageLabel')}
              title={t('languageLabel')}
            >
              <Globe2 size={16} /><span>{language === 'en' ? 'EN' : 'বাং'}</span>
            </button>

            <div className="notification-wrap">
              <button
                type="button"
                className={`icon-button ${notificationsOpen ? 'icon-button-selected' : ''}`}
                onClick={() => { setNotificationsOpen((current) => !current); setSearchOpen(false); }}
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell size={18} /><i className="notification-dot" />
              </button>
              {notificationsOpen && (
                <div className="notification-popover">
                  <div className="popover-heading"><span>{t('notificationTitle')}</span><span className="popover-icon"><Bell size={15} /></span></div>
                  <p>{t('notificationText')}</p>
                  <button type="button" onClick={() => changeView('manage')}>{t('setupSources')} <ArrowRight size={14} /></button>
                </div>
              )}
            </div>

            <button type="button" className="top-avatar" onClick={() => changeView('manage')} aria-label={t('manage')}>CF</button>
          </div>
        </header>

        <div className="page-content">
          <div className="page-intro">
            <div>
              <p className="eyebrow">{view === 'home' ? dateLabel.toUpperCase() : t('localPreview').toUpperCase()}</p>
              <h1>{pageTitle}</h1>
              <p className="page-subtitle">{pageSubtitle}</p>
            </div>
            <div className="intro-actions">
              <div className={`feed-status ${providerUnavailable ? 'feed-status-error' : providerConfigured ? 'feed-status-connected' : ''}`} aria-live="polite">
                <span className="feed-status-label"><span className="status-dot" />{t(feedStatusKey)}</span>
                <button type="button" className="feed-refresh-button" onClick={() => setFeedRefreshKey((key) => key + 1)} aria-label={t('refreshData')} title={t('refreshData')} disabled={feedLoading}>
                  <RefreshCw size={14} className={feedLoading ? 'is-spinning' : ''} />
                </button>
              </div>
              <button type="button" className="button button-outline" onClick={() => openConfig()}>
                <Plus size={16} />{t('addChannel')}
              </button>
            </div>
          </div>

          {view === 'home' && (
            <>
              <Hero
                t={t}
                onBrowse={() => changeView('channels')}
                onManage={() => changeView('manage')}
                featuredMatch={featuredMatch}
                isSample={featuredMatchIsSample}
                language={language}
              />
              <div className="stats-grid">
                <StatCard Icon={Tv} label={t('channelsStat')} value={allChannels.length.toString().padStart(2, '0')} note="In your lineup" tone="lime" />
                <StatCard Icon={MonitorPlay} label={t('sourcesStat')} value={readyCount.toString().padStart(2, '0')} note="Authorized sources" tone="blue" />
                <StatCard Icon={Bookmark} label={t('savedStat')} value={favorites.length.toString().padStart(2, '0')} note="On this device" tone="orange" />
              </div>
              <div className="dashboard-grid">
                <div className="dashboard-main">
                  <section className="surface-section">
                    <SectionHeading title={t('featured')} note={t('featuredNote')} actionLabel={t('seeAll')} onAction={() => changeView('channels')} />
                    <CategoryFilters active={category} onChange={setCategory} t={t} />
                    <ChannelGrid
                      channels={filteredChannels}
                      favorites={favorites}
                      onFavorite={toggleFavorite}
                      onWatch={setPlayerChannel}
                      onConfigure={openConfig}
                      emptyTitle={t('noChannels')}
                      emptyText={t('noChannelsText')}
                      t={t}
                    />
                  </section>
                  <section className="surface-section fixture-section-home">
                    <SectionHeading
                      title={t('upcoming')}
                      note={t(fixtureFeed.error ? 'fixtureFeedUnavailableText' : fixtureFeed.configured ? 'providerEventsNote' : 'upcomingNote')}
                      actionLabel={t('seeAll')}
                      onAction={() => changeView('fixtures')}
                    />
                    <FixtureList t={t} fixtures={fixturesForDisplay.slice(0, 3)} sample={!fixtureFeed.configured} compact language={language} />
                  </section>
                </div>
                <aside className="right-rail">
                  <div className="setup-card">
                    <div className="setup-card-icon"><Sparkles size={19} /></div>
                    <p className="eyebrow">{t('manage').toUpperCase()}</p>
                    <h2>Bring your own broadcast.</h2>
                    <p>Add a direct HLS or video URL from a provider you trust. Your lineup stays on this device.</p>
                    <button type="button" className="button button-bright" onClick={() => openConfig()}>
                      <Plus size={16} />{t('addChannel')}
                    </button>
                    <div className="setup-card-foot"><ShieldCheck size={14} />{t('licensedOnly')}</div>
                  </div>
                  <div className="rights-card">
                    <div className="rights-card-title"><Info size={16} /><span>{t('sourceInfoTitle')}</span></div>
                    <p>{t('sourceInfoText')}</p>
                    <button type="button" onClick={() => changeView('manage')}>{t('openManage')} <ArrowUpRight size={14} /></button>
                  </div>
                  <MiniMatchCard t={t} fixture={featuredMatch} isSample={featuredMatchIsSample} language={language} />
                </aside>
              </div>
            </>
          )}

          {view === 'channels' && (
            <section className="surface-section full-page-section">
              <div className="catalog-toolbar">
                <CategoryFilters active={category} onChange={setCategory} t={t} />
                <span className="result-count">{filteredChannels.length} {t('channels').toLowerCase()}</span>
              </div>
              <ChannelGrid
                channels={filteredChannels}
                favorites={favorites}
                onFavorite={toggleFavorite}
                onWatch={setPlayerChannel}
                onConfigure={openConfig}
                emptyTitle={t('noChannels')}
                emptyText={t('noChannelsText')}
                t={t}
              />
            </section>
          )}

          {view === 'live' && (
            <section className="surface-section full-page-section">
              <div className="catalog-toolbar"><div className="ready-caption"><span className="status-dot" />{t('localOnly')}</div><span className="result-count">{filteredChannels.length} {t('channels').toLowerCase()}</span></div>
              {filteredChannels.length ? (
                <ChannelGrid channels={filteredChannels} favorites={favorites} onFavorite={toggleFavorite} onWatch={setPlayerChannel} onConfigure={openConfig} t={t} />
              ) : (
                <EmptyState Icon={MonitorPlay} title={t('readyEmpty')} text={t('readyEmptyText')} actionLabel={t('configureStream')} onAction={() => openConfig()} />
              )}
            </section>
          )}

          {view === 'saved' && (
            <section className="surface-section full-page-section">
              {filteredChannels.length ? (
                <ChannelGrid channels={filteredChannels} favorites={favorites} onFavorite={toggleFavorite} onWatch={setPlayerChannel} onConfigure={openConfig} t={t} />
              ) : (
                <EmptyState Icon={Bookmark} title={t('savedEmpty')} text={t('savedEmptyText')} actionLabel={t('browseChannels')} onAction={() => changeView('channels')} />
              )}
            </section>
          )}

          {view === 'fixtures' && (
            <FixturesPage
              t={t}
              fixtures={fixturesForDisplay}
              sample={!fixtureFeed.configured}
              unavailable={fixtureFeed.error}
              language={language}
              onManage={() => changeView('manage')}
            />
          )}

          {view === 'scores' && (
            <ScoresPage
              t={t}
              scores={filteredScores}
              category={category}
              onCategoryChange={setCategory}
              configured={scoreFeed.configured}
              unavailable={scoreFeed.error}
              loading={feedLoading}
              language={language}
              onRefresh={() => setFeedRefreshKey((key) => key + 1)}
            />
          )}

          {view === 'manage' && (
            <ManagePage
              channels={channels}
              t={t}
              onAdd={() => openConfig()}
              onEdit={openConfig}
              onRemove={removeChannel}
              onRestore={restoreDemo}
            />
          )}

          <footer className="page-footer">
            <span>CRICFy TV <span className="footer-separator">·</span> {t('localPreview')}</span>
            <span><ShieldCheck size={13} />{t('licensedOnly')}</span>
          </footer>
        </div>
      </main>

      {configOpen && (
        <SourceDialog
          key={configChannel?.id || 'new-channel'}
          channel={configChannel || undefined}
          t={t}
          onClose={() => { setConfigOpen(false); setConfigChannel(null); }}
          onSave={saveChannel}
        />
      )}

      {playerChannel && (
        <PlayerDialog
          channel={playerChannel}
          t={t}
          onClose={() => setPlayerChannel(null)}
          onConfigure={() => { openConfig(playerChannel); setPlayerChannel(null); }}
        />
      )}

      {toast && <div className="toast" role="status"><CheckCircle2 size={17} />{toast}</div>}
    </div>
  );
}

function Hero({ t, onBrowse, onManage, featuredMatch, isSample, language }) {
  const homeCode = featuredMatch?.homeCode || featuredMatch?.home?.slice(0, 3).toUpperCase() || 'HOME';
  const awayCode = featuredMatch?.awayCode || featuredMatch?.away?.slice(0, 3).toUpperCase() || 'AWAY';
  const hasScore = Boolean(featuredMatch?.homeScore || featuredMatch?.awayScore);
  const matchStatus = isSample
    ? t('scheduleFeed')
    : featuredMatch?.status || formatMatchDate(featuredMatch?.startsAt, language) || featuredMatch?.competition || t('liveData');

  return (
    <section className="hero-card">
      <div className="hero-copy">
        <div className="hero-kicker"><span className="hero-kicker-mark"><Signal size={13} /></span>{t('heroKicker')}</div>
        <h2>{t('heroLineOne')}<br /><span>{t('heroLineTwo')}</span></h2>
        <p>{t('heroDescription')}</p>
        <div className="hero-actions">
          <button type="button" className="button button-bright" onClick={onBrowse}>{t('browseChannels')}<ArrowRight size={16} /></button>
          <button type="button" className="button button-ghost" onClick={onManage}>{t('configureStream')}<Settings2 size={16} /></button>
        </div>
        <div className="hero-trust"><ShieldCheck size={14} /><span>{t('licensedOnly')}</span></div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="stadium-light stadium-light-one" />
        <div className="stadium-light stadium-light-two" />
        <div className="stadium-arc stadium-arc-one" />
        <div className="stadium-arc stadium-arc-two" />
        <div className="hero-orb"><span className="orb-seam orb-seam-one" /><span className="orb-seam orb-seam-two" /><span className="orb-seam orb-seam-three" /><b>CF</b></div>
        <div className="hero-orbit hero-orbit-one" />
        <div className="hero-orbit hero-orbit-two" />
        <div className="hero-scoreboard">
          <div className="scoreboard-head"><span className="score-preview"><span className={isSample ? '' : 'score-live-dot'} />{isSample ? t('sampleEvent') : t('liveData')}</span><span className="scoreboard-menu">•••</span></div>
          <div className="scoreboard-match">
            <div className="score-team"><span className="score-flag">{featuredMatch?.homeFlag || '🏟️'}</span><strong>{homeCode}</strong><small>{featuredMatch?.home || 'Home'}</small></div>
            <div className="score-versus">{hasScore ? `${featuredMatch.homeScore || '–'} : ${featuredMatch.awayScore || '–'}` : 'VS'}</div>
            <div className="score-team"><span className="score-flag">{featuredMatch?.awayFlag || '🏟️'}</span><strong>{awayCode}</strong><small>{featuredMatch?.away || 'Away'}</small></div>
          </div>
          <div className="scoreboard-bottom"><Clock3 size={13} /><span>{matchStatus}</span><ArrowUpRight size={13} /></div>
        </div>
        <div className="hero-art-label"><span className="art-label-icon"><Activity size={14} /></span><span><b>SPORTS</b><small>{t('previewData')}</small></span></div>
      </div>
    </section>
  );
}

function formatMatchDate(value, language) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'bn' ? 'bn-BD' : 'en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function MiniMatchCard({ t, fixture, isSample, language }) {
  const hasScore = Boolean(fixture?.homeScore || fixture?.awayScore);
  const homeCode = fixture?.homeCode || fixture?.home?.slice(0, 3).toUpperCase() || 'HOME';
  const awayCode = fixture?.awayCode || fixture?.away?.slice(0, 3).toUpperCase() || 'AWAY';
  const caption = isSample ? t('sampleFixture') : fixture?.competition || fixture?.status || t('liveData');
  return (
    <div className="mini-fixture-card">
      <div className="mini-fixture-top"><span className={`live-mini-dot ${isSample ? '' : 'connected-mini-dot'}`} />{caption}</div>
      <div className="mini-team-row">
        <span>{fixture?.homeFlag || '🏟️'}</span><strong>{homeCode}</strong>
        <small>{hasScore ? `${fixture.homeScore || '–'} : ${fixture.awayScore || '–'}` : 'VS'}</small>
        <strong>{awayCode}</strong><span>{fixture?.awayFlag || '🏟️'}</span>
      </div>
      <p>{isSample ? t('scheduleFeed') : fixture?.status || formatMatchDate(fixture?.startsAt, language) || `${fixture?.home || ''} vs ${fixture?.away || ''}`}</p>
    </div>
  );
}

function StatCard({ Icon, label, value, note, tone }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon stat-icon-${tone}`}><Icon size={17} /></div>
      <div className="stat-content"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
      <span className="stat-sparkline" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></span>
    </div>
  );
}

function SectionHeading({ title, note, actionLabel, onAction }) {
  return (
    <div className="section-heading">
      <div><h2>{title}</h2>{note && <p>{note}</p>}</div>
      {actionLabel && onAction && <button type="button" className="text-action" onClick={onAction}>{actionLabel}<ChevronRight size={15} /></button>}
    </div>
  );
}

function CategoryFilters({ active, onChange, t }) {
  return (
    <div className="category-filters" role="group" aria-label="Filter by sport">
      {categories.map((item) => {
        const label = item === 'All sports' ? t('allSports') : item;
        return (
          <button type="button" key={item} className={active === item ? 'filter-chip filter-chip-active' : 'filter-chip'} onClick={() => onChange(item)} aria-pressed={active === item}>
            {item === 'All sports' && <Sparkles size={13} />}{label}
          </button>
        );
      })}
    </div>
  );
}

function ChannelGrid({ channels, favorites, onFavorite, onWatch, onConfigure, emptyTitle, emptyText, t }) {
  if (!channels.length) return <EmptyState Icon={Tv} title={emptyTitle || t('noChannels')} text={emptyText || t('noChannelsText')} actionLabel={t('addChannel')} onAction={() => onConfigure(null)} />;
  return (
    <div className="channel-grid">
      {channels.map((channel, index) => (
        <ChannelCard
          key={channel.id}
          channel={channel}
          index={index}
          isFavorite={favorites.includes(channel.id)}
          onFavorite={() => onFavorite(channel.id)}
          onWatch={() => onWatch(channel)}
          onConfigure={() => onConfigure(channel)}
          t={t}
        />
      ))}
    </div>
  );
}

function ChannelCard({ channel, index, isFavorite, onFavorite, onWatch, onConfigure, t }) {
  const art = channel.art || ['cricket', 'stadium', 'football', 'extra'][index % 4];
  const emoji = channel.category === 'Cricket' ? '🏏' : channel.category === 'Football' ? '⚽' : channel.category === 'News' ? '◉' : '🏆';
  const hasSource = Boolean(channel.streamUrl);
  return (
    <article className="channel-card">
      <div className={`channel-art art-${art}`}>
        <div className="art-grid-lines" />
        <div className="art-rings art-rings-a" />
        <div className="art-rings art-rings-b" />
        <div className="channel-art-top"><span className="art-category"><span className="art-category-dot" />{channel.category}</span>
          <button type="button" className={`favorite-button ${isFavorite ? 'favorite-active' : ''}`} onClick={onFavorite} aria-label={isFavorite ? 'Remove from saved list' : 'Save channel'} aria-pressed={isFavorite}>
            <Star size={15} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
        <div className="channel-art-emblem"><span>{emoji}</span></div>
        <div className="channel-art-caption"><small>CRICFy · CHANNEL</small><strong>{channel.name}</strong></div>
        <span className="art-index">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="channel-card-body">
        <div className="channel-info">
          <div className="channel-source-row">
            <span className={`channel-state ${hasSource ? 'channel-state-ready' : ''}`}><i />{hasSource ? t('sourceReady') : t('setupRequired')}</span>
            {Array.isArray(channel.streamOptions) && channel.streamOptions.length > 1 && <span className="multi-source-tag"><ListVideo size={11} />{t('multipleLinks')}</span>}
          </div>
          <p>{channel.subtitle || t('builtForFans')}</p>
        </div>
        <div className="channel-card-actions">
          {!hasSource && <button type="button" className="configure-link" onClick={onConfigure}>{t('addSource')}<ArrowUpRight size={13} /></button>}
          <button type="button" className={`watch-button ${hasSource ? 'watch-button-ready' : ''}`} onClick={onWatch} aria-label={`${t('watch')} ${channel.name}`}>
            <Play size={15} fill="currentColor" /><span>{t('watch')}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function FixtureList({ t, fixtures = [], sample = false, compact = false, scoreMode = false, language = 'en' }) {
  if (!fixtures.length) return <div className="fixture-empty-inline">{t('fixtureEmpty')}</div>;

  return (
    <div className={`fixture-list ${compact ? 'fixture-list-compact' : ''}`}>
      {fixtures.map((fixture, index) => {
        const hasScore = Boolean(fixture.homeScore || fixture.awayScore);
        const dateLabel = formatMatchDate(fixture.startsAt, language);
        const rightLabel = sample ? 'TBD' : fixture.status || dateLabel || '—';
        const note = fixture.note || dateLabel || fixture.competition || (sample ? t('fixtureRightsNote') : t('liveData'));
        return (
          <article className="fixture-row" key={fixture.id || `${fixture.home}-${fixture.away}-${index}`}>
            <div className={`fixture-sport-icon ${fixture.sport === 'Football' ? 'football-icon' : ''}`}>
              {fixture.sport === 'Cricket' ? '🏏' : fixture.sport === 'Football' ? '⚽' : '🏟️'}
            </div>
            <div className="fixture-row-main">
              <div className="fixture-row-top">
                <span>{fixture.sport}</span>
                {sample
                  ? <span className="preview-tag">{t('sampleOnly')}</span>
                  : fixture.competition && <span className="provider-tag">{fixture.competition}</span>}
              </div>
              <div className="fixture-team-line">
                <span className="fixture-team"><i>{fixture.homeFlag || '🏟️'}</i><b>{fixture.homeCode || fixture.home?.slice(0, 3).toUpperCase()}</b></span>
                <span className={scoreMode || hasScore ? 'fixture-score' : 'fixture-vs'}>
                  {scoreMode || hasScore ? `${fixture.homeScore || '–'} : ${fixture.awayScore || '–'}` : 'VS'}
                </span>
                <span className="fixture-team"><i>{fixture.awayFlag || '🏟️'}</i><b>{fixture.awayCode || fixture.away?.slice(0, 3).toUpperCase()}</b></span>
              </div>
              {!compact && <p>{fixture.home} vs {fixture.away}</p>}
              <small>{note}</small>
            </div>
            <div className="fixture-row-more"><span>{rightLabel}</span><ArrowUpRight size={14} /></div>
            {index === 0 && <span className="fixture-row-glow" />}
          </article>
        );
      })}
    </div>
  );
}

function EmptyState({ Icon, title, text, actionLabel, onAction }) {
  return (
    <div className="empty-state">
      <div className="empty-icon"><Icon size={22} /></div>
      <h3>{title}</h3>
      <p>{text}</p>
      {actionLabel && onAction && <button type="button" className="button button-outline" onClick={onAction}>{actionLabel}<ArrowRight size={15} /></button>}
    </div>
  );
}

function FixturesPage({ t, fixtures, sample, unavailable, language, onManage }) {
  const bannerTitle = unavailable ? 'feedUnavailable' : sample ? 'scheduleEmpty' : 'fixtureFeedConnected';
  const bannerText = unavailable ? 'fixtureFeedUnavailableText' : sample ? 'scheduleEmptyText' : 'fixtureFeedConnectedText';
  return (
    <section className="surface-section full-page-section fixtures-page">
      <div className="fixtures-page-banner">
        <div className="fixtures-banner-icon"><CalendarDays size={19} /></div>
        <div>
          <span className="eyebrow">{t(unavailable ? 'feedUnavailable' : sample ? 'previewData' : 'liveData').toUpperCase()}</span>
          <h2>{t(bannerTitle)}</h2>
          <p>{t(bannerText)}</p>
        </div>
        <button type="button" className="button button-outline" onClick={onManage}><Settings2 size={15} />{t('manage')}</button>
      </div>
      <div className="fixture-grid-layout">
        <div className="fixture-grid-heading">
          <div><h3>{t('upcoming')}</h3><p>{t(sample ? 'fixtureRightsNote' : 'providerEventsNote')}</p></div>
          <span className={sample || unavailable ? 'preview-tag' : 'provider-tag'}>{t(unavailable ? 'feedUnavailable' : sample ? 'sampleOnly' : 'liveData')}</span>
        </div>
        {fixtures.length
          ? <FixtureList t={t} fixtures={fixtures} sample={sample} language={language} />
          : <EmptyState Icon={CalendarDays} title={t(unavailable ? 'feedUnavailable' : 'fixtureEmpty')} text={t(unavailable ? 'fixtureFeedUnavailableText' : 'fixtureEmptyText')} actionLabel={unavailable ? undefined : t('manage')} onAction={unavailable ? undefined : onManage} />}
      </div>
      <div className="fixture-rights-note"><Info size={16} /><span>{t(unavailable ? 'fixtureFeedUnavailableText' : sample ? 'fixtureRightsNote' : 'providerEventsNote')}</span></div>
    </section>
  );
}

function ScoresPage({ t, scores, category, onCategoryChange, configured, unavailable, loading, language, onRefresh }) {
  return (
    <section className="surface-section full-page-section scores-page">
      <div className="scores-page-heading">
        <div>
          <span className="eyebrow">{t(unavailable ? 'feedUnavailable' : configured ? 'liveData' : 'feedSetupNeeded').toUpperCase()}</span>
          <h2>{t('pageScoresTitle')}</h2>
          <p>{t('pageScoresSubtitle')}</p>
        </div>
        <button type="button" className="button button-outline" onClick={onRefresh} disabled={loading} aria-label={t('refreshData')}>
          <RefreshCw size={14} className={loading ? 'is-spinning' : ''} />{t('refreshData')}
        </button>
      </div>
      <div className="catalog-toolbar">
        <CategoryFilters active={category} onChange={onCategoryChange} t={t} />
        <span className="result-count">{scores.length} {t('scores').toLowerCase()}</span>
      </div>
      {scores.length
        ? <FixtureList t={t} fixtures={scores} scoreMode language={language} />
        : <EmptyState
          Icon={Activity}
          title={unavailable ? t('feedUnavailable') : configured ? t('fixtureEmpty') : t('scoreEmpty')}
          text={unavailable ? t('scoreFeedUnavailableText') : configured ? t('fixtureEmptyText') : t('scoreEmptyText')}
        />}
    </section>
  );
}

function ManagePage({ channels, t, onAdd, onEdit, onRemove, onRestore }) {
  const configuredCount = channels.filter((channel) => Boolean(channel.streamUrl)).length;
  return (
    <div className="manage-layout">
      <section className="surface-section manage-list-section">
        <div className="manage-section-heading">
          <div><span className="eyebrow">{t('localPreview').toUpperCase()}</span><h2>{t('channelsStat')} <span className="inline-count">{String(channels.length).padStart(2, '0')}</span></h2><p>{t('localStorageNote')}</p></div>
          <button type="button" className="button button-bright" onClick={onAdd}><Plus size={16} />{t('addChannel')}</button>
        </div>
        {channels.length ? (
          <div className="manage-list">
            {channels.map((channel, index) => (
              <div className="manage-row" key={channel.id}>
                <div className={`manage-channel-mark art-${channel.art || ['cricket', 'stadium', 'football', 'extra'][index % 4]}`}><span>{channel.category === 'Cricket' ? '🏏' : channel.category === 'Football' ? '⚽' : '🏆'}</span></div>
                <div className="manage-channel-copy"><strong>{channel.name}</strong><span>{channel.category} · {channel.subtitle || t('builtForFans')}</span></div>
                <div className={`manage-source-status ${channel.streamUrl ? 'manage-source-ready' : ''}`}><i />{channel.streamUrl ? t('sourceReady') : t('setupRequired')}</div>
                <div className="manage-row-actions">
                  <button type="button" className="button button-small button-outline" onClick={() => onEdit(channel)}><Settings2 size={14} />{t('edit')}</button>
                  <button type="button" className="manage-delete" onClick={() => onRemove(channel.id)} aria-label={`${t('remove')} ${channel.name}`} title={t('remove')}><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState Icon={Tv} title={t('setupEmptySource')} text={t('setupEmptySourceText')} actionLabel={t('addFirstChannel')} onAction={onAdd} />
        )}
        <div className="manage-list-footer"><span><span className="status-dot" />{configuredCount} {t('sourcesStat').toLowerCase()}</span><button type="button" className="text-action text-action-muted" onClick={onRestore}>{t('clearDemo')}<ArrowRight size={14} /></button></div>
      </section>

      <aside className="manage-side-column">
        <div className="rights-card rights-card-large">
          <div className="rights-illustration"><ShieldCheck size={25} /></div>
          <span className="eyebrow">{t('moreInfo').toUpperCase()}</span>
          <h2>{t('rightsTitle')}</h2>
          <p>{t('rightsText')}</p>
          <div className="rights-card-rule" />
          <div className="rights-format"><span><Check size={14} /> HLS</span><span><Check size={14} /> MP4</span><span><Check size={14} /> WebM</span></div>
        </div>
        <div className="local-storage-card"><div className="local-storage-icon"><Info size={17} /></div><div><strong>{t('localOnly')}</strong><p>{t('localStorageNote')}</p></div></div>
      </aside>
    </div>
  );
}

function SourceDialog({ channel, t, onClose, onSave }) {
  const [name, setName] = useState(channel?.name || '');
  const [category, setCategory] = useState(channel?.category || 'Cricket');
  const [subtitle, setSubtitle] = useState(channel?.subtitle || '');
  const [streamUrl, setStreamUrl] = useState(channel?.streamUrl || '');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
    const handleKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const submit = (event) => {
    event.preventDefault();
    setError('');
    if (!name.trim()) {
      setError(t('missingName'));
      return;
    }
    const trimmedUrl = streamUrl.trim();
    if (trimmedUrl) {
      let parsed;
      try {
        parsed = new URL(trimmedUrl);
      } catch {
        setError(t('invalidUrl'));
        return;
      }
      if (!['https:', 'http:'].includes(parsed.protocol)) {
        setError(t('invalidUrl'));
        return;
      }
      if (!/\.(m3u8|mp4|webm)$/i.test(parsed.pathname)) {
        setError(t('unsupportedUrl'));
        return;
      }
      if (!rightsConfirmed) {
        setError(t('rightsRequired'));
        return;
      }
    }
    onSave({
      ...channel,
      id: channel?.id,
      name: name.trim(),
      category,
      subtitle: subtitle.trim() || t('builtForFans'),
      streamUrl: trimmedUrl,
      streamOptions: trimmedUrl ? [{ id: 'primary', label: 'Primary stream', url: trimmedUrl }] : [],
      art: channel?.art || (category === 'Cricket' ? 'cricket' : category === 'Football' ? 'football' : 'custom'),
      isCustom: channel?.isCustom ?? true,
    });
  };

  return (
    <div className="modal-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="source-dialog" role="dialog" aria-modal="true" aria-labelledby="source-dialog-title">
        <div className="dialog-topline"><span className="dialog-kicker"><Settings2 size={14} />{t('localPreview')}</span><button type="button" className="icon-button" onClick={onClose} aria-label={t('close')}><X size={18} /></button></div>
        <div className="dialog-heading"><div className="dialog-icon"><Tv size={19} /></div><div><h2 id="source-dialog-title">{channel ? `${t('edit')} ${channel.name}` : t('setupSourceTitle')}</h2><p>{t('setupSourceDescription')}</p></div></div>
        <form onSubmit={submit} noValidate>
          <label className="form-field"><span>{t('channelName')} <i>*</i></span><input ref={nameRef} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Cricket Hub" maxLength={48} /></label>
          <div className="form-grid-two">
            <label className="form-field"><span>{t('category')}</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option>Cricket</option><option>Football</option><option>Sports</option><option>News</option></select></label>
            <label className="form-field"><span>{t('shortDescription')}</span><input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="e.g. Matchday coverage" maxLength={72} /></label>
          </div>
          <label className="form-field"><span>{t('playbackUrl')}</span><input value={streamUrl} onChange={(event) => { setStreamUrl(event.target.value); setRightsConfirmed(false); }} placeholder="https://provider.example/live.m3u8" inputMode="url" autoComplete="off" /></label>
          <p className="field-hint"><Info size={14} />{t('urlHint')}</p>
          {streamUrl.trim() && (
            <label className="rights-checkbox"><input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} /><span className="checkmark"><Check size={12} /></span><span>{t('rightsNotice')}</span></label>
          )}
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="dialog-safe-note"><ShieldCheck size={15} /><span>{t('localOnly')} · {t('licensedOnly')}</span></div>
          <div className="dialog-actions"><button type="button" className="button button-ghost" onClick={onClose}>{t('cancel')}</button><button type="submit" className="button button-bright"><Check size={15} />{t('saveChannel')}</button></div>
        </form>
      </section>
    </div>
  );
}

function PlayerDialog({ channel, t, onClose, onConfigure }) {
  const videoRef = useRef(null);
  const [playbackError, setPlaybackError] = useState('');
  const [activeStreamUrl, setActiveStreamUrl] = useState(() => channel.streamUrl || channel.streamOptions?.[0]?.url || '');
  const [pictureInPictureSupported, setPictureInPictureSupported] = useState(false);
  const [pictureInPictureActive, setPictureInPictureActive] = useState(false);
  const streamOptions = Array.isArray(channel.streamOptions) && channel.streamOptions.length
    ? channel.streamOptions
    : channel.streamUrl
      ? [{ id: 'primary', label: 'Primary stream', url: channel.streamUrl }]
      : [];
  const currentStreamUrl = streamOptions.find((option) => option.url === activeStreamUrl)?.url || streamOptions[0]?.url || '';
  const hasSource = Boolean(currentStreamUrl);

  useEffect(() => {
    setActiveStreamUrl(channel.streamUrl || channel.streamOptions?.[0]?.url || '');
  }, [channel.id, channel.streamUrl, channel.streamOptions]);

  useEffect(() => {
    setPlaybackError('');
    if (!hasSource || !videoRef.current) return undefined;
    const video = videoRef.current;
    const url = currentStreamUrl;
    const isHls = /\.m3u8$/i.test(new URL(url).pathname);
    let hls;
    let disposed = false;
    const onVideoError = () => setPlaybackError(t('playbackError'));
    video.addEventListener('error', onVideoError);

    const attachSource = async () => {
      if (isHls && !video.canPlayType('application/vnd.apple.mpegurl')) {
        const { default: HlsPlayer } = await import('hls.js/light');
        if (disposed) return;
        if (HlsPlayer.isSupported()) {
          hls = new HlsPlayer({ enableWorker: true, lowLatencyMode: true });
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(HlsPlayer.Events.ERROR, (_event, data) => {
            if (data.fatal) setPlaybackError(t('playbackError'));
          });
        } else {
          setPlaybackError(t('playbackError'));
        }
      } else {
        video.src = url;
      }
    };

    attachSource().catch(() => {
      if (!disposed) setPlaybackError(t('playbackError'));
    });

    return () => {
      disposed = true;
      video.removeEventListener('error', onVideoError);
      if (hls) hls.destroy();
      video.pause();
      video.removeAttribute('src');
      video.load();
    };
  }, [channel.id, currentStreamUrl, hasSource, t]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    setPictureInPictureSupported(Boolean(document.pictureInPictureEnabled && video.requestPictureInPicture));
    const syncPipState = () => setPictureInPictureActive(document.pictureInPictureElement === video);
    video.addEventListener('enterpictureinpicture', syncPipState);
    video.addEventListener('leavepictureinpicture', syncPipState);
    syncPipState();
    return () => {
      video.removeEventListener('enterpictureinpicture', syncPipState);
      video.removeEventListener('leavepictureinpicture', syncPipState);
    };
  }, [channel.id, hasSource]);

  const togglePictureInPicture = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement === video) await document.exitPictureInPicture();
      else await video.requestPictureInPicture();
    } catch {
      setPlaybackError(t('floatingPlayerUnavailable'));
    }
  };

  useEffect(() => {
    const handleKey = (event) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="modal-scrim player-scrim" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="player-dialog" role="dialog" aria-modal="true" aria-labelledby="player-dialog-title">
        <div className="player-dialog-head"><div className="player-head-copy"><span className="eyebrow">{t('playerTitle').toUpperCase()}</span><h2 id="player-dialog-title">{channel.name}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label={t('close')}><X size={19} /></button></div>
        {hasSource ? (
          <>
            <div className="video-frame"><video ref={videoRef} controls playsInline preload="metadata" aria-label={`${t('playerTitle')}: ${channel.name}`} />{playbackError && <div className="video-error"><Info size={17} /><span>{playbackError}</span></div>}</div>
            <div className="player-footer">
              <span><span className="status-dot" />{channel.category} · {t('sourceReady')}</span>
              {streamOptions.length > 1 && (
                <label className="stream-select">
                  <span>{t('chooseStream')}</span>
                  <select value={currentStreamUrl} onChange={(event) => setActiveStreamUrl(event.target.value)}>
                    {streamOptions.map((option) => <option key={option.id || option.url} value={option.url}>{option.label}</option>)}
                  </select>
                </label>
              )}
              <p>{t('playbackHelp')}</p>
              <div className="player-footer-actions">
                {pictureInPictureSupported && (
                  <button type="button" className={`button button-small ${pictureInPictureActive ? 'button-bright' : 'button-outline'}`} onClick={togglePictureInPicture}>
                    <MonitorPlay size={14} />{t('floatingPlayer')}
                  </button>
                )}
                <button type="button" className="button button-ghost button-small" onClick={onConfigure}><Settings2 size={14} />{t('streamSetup')}</button>
              </div>
            </div>
          </>
        ) : (
          <div className="player-empty">
            <div className="player-empty-orbit"><span /><Play size={26} fill="currentColor" /></div>
            <span className="eyebrow">{t('setupRequired').toUpperCase()}</span>
            <h3>{t('noSourceTitle')}</h3>
            <p>{t('noSourceText')}</p>
            <button type="button" className="button button-bright" onClick={onConfigure}><Plus size={16} />{t('streamSetup')}</button>
          </div>
        )}
        <div className="player-compliance"><ShieldCheck size={14} />{t('rightsText')}</div>
      </section>
    </div>
  );
}

export default App;
