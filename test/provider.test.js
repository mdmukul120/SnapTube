import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchProviderResource,
  sanitizeChannels,
  sanitizeFixtures,
  sanitizeScores,
} from '../lib/provider.js';
import fixturesHandler from '../api/fixtures.js';

const ENV_KEYS = [
  'CRICFY_API_BASE_URL',
  'CRICFY_API_KEY',
  'CRICFY_API_KEY_HEADER',
  'CRICFY_API_KEY_PREFIX',
  'CRICFY_CHANNELS_PATH',
  'CRICFY_FIXTURES_PATH',
  'CRICFY_SCORES_PATH',
];

function withEnv(values, run) {
  const before = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  return Promise.resolve()
    .then(run)
    .finally(() => {
      for (const key of ENV_KEYS) {
        if (before[key] === undefined) delete process.env[key];
        else process.env[key] = before[key];
      }
    });
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function mockVercelResponse() {
  const headers = {};
  return {
    headers,
    statusCode: 200,
    payload: undefined,
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
  };
}

test('sanitizes channel lists and refuses non-HTTPS or embed URLs', () => {
  const channels = sanitizeChannels({ data: { channels: [
    { id: 'authorized-one', title: 'Cricket One', category: 'cricket', url: 'https://media.example/live.m3u8?token=ok', streams: [{ name: 'Backup', url: 'https://media.example/backup.mp4' }, { name: 'Embed', url: 'https://media.example/watch?id=1' }] },
    { id: 'insecure', name: 'Insecure', url: 'http://media.example/live.m3u8' },
    { id: 'embed', name: 'Embed', url: 'https://media.example/watch?id=1' },
    { id: 'blank', description: 'No title' },
  ] } });

  assert.equal(channels.length, 3);
  assert.equal(channels[0].id, 'provider-authorized-one');
  assert.equal(channels[0].streamUrl, 'https://media.example/live.m3u8?token=ok');
  assert.equal(channels[0].category, 'Cricket');
  assert.equal(channels[0].streamOptions.length, 2);
  assert.equal(channels[0].streamOptions[1].label, 'Backup');
  assert.equal(channels[1].streamUrl, '');
  assert.equal(channels[2].streamUrl, '');
});

test('normalizes fixture and score envelopes without inventing scores', () => {
  const data = { data: { events: [
    { id: 4, sport: 'football', homeTeam: { name: 'North FC', code: 'NOR' }, awayTeam: { name: 'South FC', code: 'SOU' }, starts_at: '2026-12-01T17:00:00Z' },
    { id: 'partial', home: 'Only one side' },
    { id: 'empty' },
  ] } };
  const fixtures = sanitizeFixtures(data);
  const scores = sanitizeScores({ results: 2, response: [
    { fixture: { id: 8, date: '2026-12-02T19:00:00Z', status: { short: 'FT' } }, league: { name: 'Premier League', sport: 'football' }, teams: { home: { name: 'Tigers' }, away: { name: 'Lions' } }, goals: { home: 2, away: 0 } },
    { id: 'match-2', teams: [{ name: 'Bengals' }, { name: 'Kites' }], scores: { home: { total: '120/4' }, away: '98/2' }, status: 'Live' },
  ] });

  assert.equal(fixtures.length, 2);
  assert.equal(fixtures[0].home, 'North FC');
  assert.equal(fixtures[0].awayCode, 'SOU');
  assert.equal(fixtures[0].homeScore, '');
  assert.equal(scores[0].homeScore, '2');
  assert.equal(scores[0].awayScore, '0');
  assert.equal(scores[0].status, 'FT');
  assert.equal(scores[0].competition, 'Premier League');
  assert.equal(scores[0].sport, 'Football');
  assert.equal(scores[1].homeScore, '120/4');
  assert.equal(scores[1].awayScore, '98/2');
  assert.equal(scores[1].status, 'Live');
});

test('uses the server-side API key and configured relative resource path', async () => {
  await withEnv({
    CRICFY_API_BASE_URL: 'https://api.example.test/v1/',
    CRICFY_API_KEY: 'secret-for-test',
    CRICFY_API_KEY_HEADER: 'X-Api-Key',
    CRICFY_CHANNELS_PATH: 'tv/channels?locale=en',
  }, async () => {
    const originalFetch = globalThis.fetch;
    let requestedUrl;
    let requestedOptions;
    globalThis.fetch = async (url, options) => {
      requestedUrl = String(url);
      requestedOptions = options;
      return jsonResponse({ items: [] });
    };
    try {
      const result = await fetchProviderResource('channels');
      assert.equal(result.configured, true);
      assert.equal(requestedUrl, 'https://api.example.test/v1/tv/channels?locale=en');
      assert.equal(requestedOptions.headers['X-Api-Key'], 'secret-for-test');
      assert.equal(requestedOptions.headers.Accept, 'application/json');
      assert.equal(requestedOptions.method, 'GET');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

test('does not call upstream without a key and rejects insecure provider hosts', async () => {
  await withEnv({ CRICFY_API_BASE_URL: 'https://api.example.test/v1' }, async () => {
    const originalFetch = globalThis.fetch;
    let called = false;
    globalThis.fetch = async () => { called = true; return jsonResponse({ items: [] }); };
    try {
      assert.equal((await fetchProviderResource('fixtures')).configured, false);
      assert.equal(called, false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  await withEnv({ CRICFY_API_BASE_URL: 'http://api.example.test/v1', CRICFY_API_KEY: 'test-key' }, async () => {
    await assert.rejects(fetchProviderResource('fixtures'), /provider_config_invalid/);
  });
});

test('fixture endpoint returns normalized data and never serializes the API key', async () => {
  await withEnv({
    CRICFY_API_BASE_URL: 'https://api.example.test/v1',
    CRICFY_API_KEY: 'must-not-leak',
  }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => jsonResponse({ fixtures: [
      { id: 'event-1', sport: 'cricket', home: 'Comets', away: 'Rovers', status: 'Upcoming', startsAt: '2026-12-06T10:00:00Z' },
    ] });
    const response = mockVercelResponse();
    try {
      await fixturesHandler({ method: 'GET' }, response);
      assert.equal(response.statusCode, 200);
      assert.equal(response.payload.configured, true);
      assert.equal(response.payload.items[0].home, 'Comets');
      assert.equal(response.payload.items[0].homeScore, '');
      assert.equal(JSON.stringify(response.payload).includes('must-not-leak'), false);
      assert.equal(response.headers['cache-control'], 'public, s-maxage=30, stale-while-revalidate=120');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
