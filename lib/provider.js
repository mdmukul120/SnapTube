const RESOURCE_CONFIG = {
  channels: { pathEnv: 'CRICFY_CHANNELS_PATH', defaultPath: 'channels' },
  fixtures: { pathEnv: 'CRICFY_FIXTURES_PATH', defaultPath: 'fixtures' },
  scores: { pathEnv: 'CRICFY_SCORES_PATH', defaultPath: 'scores' },
};

const MEDIA_EXTENSION = /\.(m3u8|mp4|webm)$/i;
const MAX_TEXT_LENGTH = 180;

export function setJsonHeaders(res, cacheControl = 'private, no-store, max-age=0') {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl);
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

export function sendJson(res, status, payload, cacheControl) {
  setJsonHeaders(res, cacheControl);
  return res.status(status).json(payload);
}

function makeProviderUrl(resource) {
  const baseValue = process.env.CRICFY_API_BASE_URL;
  const config = RESOURCE_CONFIG[resource];
  if (!baseValue || !config) return null;

  let base;
  try {
    base = new URL(baseValue);
  } catch {
    throw new Error('provider_config_invalid');
  }

  const isLocal = ['localhost', '127.0.0.1'].includes(base.hostname);
  if ((base.protocol !== 'https:' && !(isLocal && base.protocol === 'http:')) || base.username || base.password || base.search || base.hash) {
    throw new Error('provider_config_invalid');
  }

  const path = (process.env[config.pathEnv] || config.defaultPath).trim();
  if (!path || /^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(path)) {
    throw new Error('provider_path_invalid');
  }

  base.pathname = `${base.pathname.replace(/\/+$/, '')}/`;
  return new URL(path.replace(/^\/+/, ''), base);
}

async function readProviderJson(response) {
  const maxBytes = 1_000_000;
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new Error('provider_response_too_large');

  let body = '';
  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytesRead = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytesRead += value.byteLength;
        if (bytesRead > maxBytes) {
          await reader.cancel();
          throw new Error('provider_response_too_large');
        }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      reader.releaseLock();
    }
  } else {
    body = await response.text();
    if (new TextEncoder().encode(body).byteLength > maxBytes) throw new Error('provider_response_too_large');
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error('provider_response_invalid');
  }
}

export async function fetchProviderResource(resource) {
  const apiKey = (process.env.CRICFY_API_KEY || '').trim();
  if (!apiKey) return { configured: false, items: [] };

  const url = makeProviderUrl(resource);
  if (!url) return { configured: false, items: [] };

  const headerName = (process.env.CRICFY_API_KEY_HEADER || 'Authorization').trim();
  if (!/^[A-Za-z0-9-]{1,64}$/.test(headerName)) throw new Error('provider_header_invalid');
  const defaultPrefix = headerName.toLowerCase() === 'authorization' ? 'Bearer' : '';
  const prefix = (process.env.CRICFY_API_KEY_PREFIX ?? defaultPrefix).trim();
  const headerValue = prefix ? `${prefix} ${apiKey}` : apiKey;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        [headerName]: headerValue,
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) throw new Error('provider_request_failed');
    const contentType = (response.headers.get('content-type') || '').toLowerCase().split(';', 1)[0].trim();
    if (!contentType.endsWith('/json') && !contentType.endsWith('+json')) throw new Error('provider_response_invalid');
    return { configured: true, data: await readProviderJson(response) };
  } finally {
    clearTimeout(timer);
  }
}

export function extractRecords(value, collectionNames) {
  let current = value;
  for (let depth = 0; depth < 5; depth += 1) {
    if (Array.isArray(current)) return current;
    if (!current || typeof current !== 'object') return [];
    const next = collectionNames.map((key) => current[key]).find((candidate) => (
      Array.isArray(candidate) || (candidate && typeof candidate === 'object')
    ));
    if (next === undefined) return [];
    current = next;
  }
  return [];
}

function textValue(value, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value === 'number') return String(value);
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function firstText(value, keys, maxLength = MAX_TEXT_LENGTH) {
  for (const key of keys) {
    const candidate = textValue(value?.[key], maxLength);
    if (candidate) return candidate;
  }
  return '';
}

function normalizedCategory(value) {
  const category = textValue(value, 40).toLowerCase();
  if (category.includes('cricket')) return 'Cricket';
  if (category.includes('football') || category.includes('soccer')) return 'Football';
  if (category.includes('news')) return 'News';
  return 'Sports';
}

function safePlaybackUrl(value) {
  const raw = textValue(value, 2048);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || !MEDIA_EXTENSION.test(url.pathname)) return '';
    return url.href;
  } catch {
    return '';
  }
}

function streamOptions(item) {
  const rawOptions = item.streams ?? item.streamLinks ?? item.stream_links ?? item.links;
  const options = Array.isArray(rawOptions) ? rawOptions : [];
  const cleaned = options.map((option, index) => {
    const url = safePlaybackUrl(typeof option === 'string'
      ? option
      : option?.url ?? option?.streamUrl ?? option?.stream_url ?? option?.playbackUrl);
    if (!url) return null;
    return {
      id: `stream-${index + 1}`,
      label: firstText(option, ['name', 'label', 'title', 'quality'], 60) || `Stream ${index + 1}`,
      url,
    };
  }).filter(Boolean);

  const primaryUrl = safePlaybackUrl(item.streamUrl ?? item.stream_url ?? item.playbackUrl ?? item.playback_url ?? item.url);
  if (primaryUrl && !cleaned.some((option) => option.url === primaryUrl)) {
    cleaned.unshift({
      id: 'stream-primary',
      label: firstText(item, ['streamName', 'stream_name', 'sourceName', 'source_name'], 60) || 'Primary stream',
      url: primaryUrl,
    });
  }

  return cleaned;
}

function teamValue(item, side) {
  const nested = Array.isArray(item?.teams)
    ? item.teams[side === 'home' ? 0 : 1]
    : item?.teams && typeof item.teams === 'object'
      ? item.teams[side]
      : null;
  const keys = side === 'home'
    ? ['home', 'homeTeam', 'home_team', 'teamA', 'team_a', 'team1']
    : ['away', 'awayTeam', 'away_team', 'teamB', 'team_b', 'team2'];
  const direct = keys.map((key) => item?.[key]).find((value) => value !== undefined && value !== null);
  if (direct !== undefined) return direct;
  return nested || {};
}

function scoreText(value) {
  if (typeof value === 'string' || typeof value === 'number') return textValue(value, 40);
  return firstText(value, ['total', 'runs', 'score', 'display', 'current', 'value'], 40);
}

function sanitizeFixture(item, index) {
  if (!item || typeof item !== 'object') return null;
  const homeTeam = teamValue(item, 'home');
  const awayTeam = teamValue(item, 'away');
  const home = textValue(typeof homeTeam === 'string' ? homeTeam : firstText(homeTeam, ['name', 'title', 'team']), 80);
  const away = textValue(typeof awayTeam === 'string' ? awayTeam : firstText(awayTeam, ['name', 'title', 'team']), 80);
  if (!home && !away) return null;

  const scores = item.scores && typeof item.scores === 'object'
    ? item.scores
    : item.score && typeof item.score === 'object'
      ? item.score
      : {};
  const goals = item.goals && typeof item.goals === 'object' ? item.goals : {};
  const homeScore = scoreText(item.homeScore ?? item.home_score ?? item.teamAScore ?? goals.home ?? scores.home);
  const awayScore = scoreText(item.awayScore ?? item.away_score ?? item.teamBScore ?? goals.away ?? scores.away);
  const statusValue = item.status ?? item.state ?? item.fixture?.status;
  const status = typeof statusValue === 'object'
    ? firstText(statusValue, ['short', 'long', 'name', 'label'], 40)
    : textValue(statusValue, 40);
  const competitionValue = item.competition ?? item.league ?? item.tournament;
  const competition = typeof competitionValue === 'object'
    ? firstText(competitionValue, ['name', 'title', 'label'], 80)
    : textValue(competitionValue, 80);

  return {
    id: firstText(item, ['id', 'eventId', 'event_id', 'slug'], 100) || firstText(item.fixture, ['id'], 100) || `provider-fixture-${index}`,
    sport: normalizedCategory(item.sport ?? item.category ?? item.league?.sport),
    home,
    away,
    homeCode: firstText(item, ['homeCode', 'home_code'], 8) || firstText(homeTeam, ['code', 'shortName', 'short_name'], 8) || home.slice(0, 3).toUpperCase(),
    awayCode: firstText(item, ['awayCode', 'away_code'], 8) || firstText(awayTeam, ['code', 'shortName', 'short_name'], 8) || away.slice(0, 3).toUpperCase(),
    homeFlag: firstText(item, ['homeFlag', 'home_flag'], 8) || firstText(homeTeam, ['flag', 'emoji'], 8),
    awayFlag: firstText(item, ['awayFlag', 'away_flag'], 8) || firstText(awayTeam, ['flag', 'emoji'], 8),
    homeScore,
    awayScore,
    status,
    startsAt: firstText(item, ['startsAt', 'starts_at', 'date', 'time'], 80) || firstText(item.fixture, ['date'], 80),
    competition,
    note: firstText(item, ['note', 'description', 'round'], 160),
  };
}

export function sanitizeFixtures(data) {
  return extractRecords(data, ['items', 'fixtures', 'events', 'results', 'response', 'data'])
    .map(sanitizeFixture)
    .filter(Boolean);
}

export function sanitizeChannels(data) {
  return extractRecords(data, ['items', 'channels', 'results', 'response', 'data'])
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const name = firstText(item, ['name', 'title', 'channelName', 'channel_name'], 80);
      if (!name) return null;
      const category = normalizedCategory(item.category ?? item.sport ?? item.group);
      const sources = streamOptions(item);
      const slug = firstText(item, ['id', 'channelId', 'channel_id', 'slug'], 100);
      return {
        id: `provider-${slug || index}`,
        name,
        category,
        subtitle: firstText(item, ['subtitle', 'description', 'group', 'groupTitle', 'group_title'], 120) || 'Provider channel',
        streamUrl: sources[0]?.url || '',
        streamOptions: sources,
        art: category === 'Cricket' ? 'cricket' : category === 'Football' ? 'football' : 'custom',
        isCustom: false,
        isProvider: true,
      };
    })
    .filter(Boolean);
}

export function sanitizeScores(data) {
  return extractRecords(data, ['items', 'scores', 'matches', 'results', 'response', 'data'])
    .map(sanitizeFixture)
    .filter(Boolean);
}
