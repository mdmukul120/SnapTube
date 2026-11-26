export const STORAGE_KEYS = {
  channels: 'cricfy.web.channels.v1',
  favorites: 'cricfy.web.favorites.v1',
};

// These starter cards are intentionally examples. No stream URLs or third-party
// channel endpoints from the decompiled Android package are bundled here.
export const starterChannels = [
  {
    id: 'cricket-hub',
    name: 'Cricket Hub',
    category: 'Cricket',
    subtitle: 'Your home for every over',
    streamUrl: '',
    art: 'cricket',
    isCustom: false,
  },
  {
    id: 'stadium-sports',
    name: 'Stadium Sports',
    category: 'Sports',
    subtitle: 'A little bit of everything',
    streamUrl: '',
    art: 'stadium',
    isCustom: false,
  },
  {
    id: 'football-night',
    name: 'Football Night',
    category: 'Football',
    subtitle: 'Make room for matchday',
    streamUrl: '',
    art: 'football',
    isCustom: false,
  },
  {
    id: 'matchday-extra',
    name: 'Matchday Extra',
    category: 'Cricket',
    subtitle: 'Your second-screen companion',
    streamUrl: '',
    art: 'extra',
    isCustom: false,
  },
];

// Preview-only fixtures: times and scores are deliberately not fabricated.
export const fixturePreviews = [
  {
    id: 'fixture-ban-ind',
    sport: 'Cricket',
    home: 'Bangladesh',
    away: 'India',
    homeCode: 'BAN',
    awayCode: 'IND',
    homeFlag: '🇧🇩',
    awayFlag: '🇮🇳',
    note: 'Connect a fixture feed for confirmed match details',
  },
  {
    id: 'fixture-pak-sl',
    sport: 'Cricket',
    home: 'Pakistan',
    away: 'Sri Lanka',
    homeCode: 'PAK',
    awayCode: 'SL',
    homeFlag: '🇵🇰',
    awayFlag: '🇱🇰',
    note: 'Sample fixture · schedule provider not connected',
  },
  {
    id: 'fixture-club',
    sport: 'Football',
    home: 'Home side',
    away: 'Away side',
    homeCode: 'HOME',
    awayCode: 'AWAY',
    homeFlag: '⚽',
    awayFlag: '⚽',
    note: 'Example event · add your own schedule feed',
  },
];

export const categories = ['All sports', 'Cricket', 'Football', 'Sports', 'News'];
