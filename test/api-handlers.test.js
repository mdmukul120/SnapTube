import test from 'node:test';
import assert from 'node:assert/strict';
import channelsHandler from '../api/channels.js';
import scoresHandler from '../api/scores.js';

const ENV_KEYS = ['CRICFY_API_BASE_URL', 'CRICFY_API_KEY', 'CRICFY_API_KEY_HEADER', 'CRICFY_API_KEY_PREFIX'];

function withEnv(values, run) {
  const before = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  return Promise.resolve().then(run).finally(() => {
    for (const key of ENV_KEYS) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  });
}

function responseStub() {
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

test('channels and score routes expose sanitized public fields only', async () => {
  await withEnv({
    CRICFY_API_BASE_URL: 'https://provider.example/v1',
    CRICFY_API_KEY: 'route-test-secret',
  }, async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (url) => {
      if (String(url).endsWith('/channels')) {
        return new Response(JSON.stringify({ items: [{ id: 13, name: 'Licensed channel', sport: 'cricket', streams: [
          { name: 'HD', url: 'https://media.example/live.m3u8' },
          { name: 'Embed', url: 'https://media.example/watch' },
        ] }] }), { headers: { 'content-type': 'application/json' } });
      }
      return new Response(JSON.stringify({ response: [{ id: 'score-1', sport: 'football', home: { name: 'AFC', code: 'AFC' }, away: { name: 'BFC', code: 'BFC' }, score: { home: 1, away: 0 }, status: 'Live' }] }), {
        headers: { 'content-type': 'application/json' },
      });
    };

    try {
      const channelResponse = responseStub();
      await channelsHandler({ method: 'GET' }, channelResponse);
      assert.equal(channelResponse.payload.items[0].name, 'Licensed channel');
      assert.equal(channelResponse.payload.items[0].streamOptions.length, 1);
      assert.equal(JSON.stringify(channelResponse.payload).includes('route-test-secret'), false);
      assert.equal(channelResponse.headers['cache-control'], 'private, no-store, max-age=0');

      const scoreResponse = responseStub();
      await scoresHandler({ method: 'GET' }, scoreResponse);
      assert.equal(scoreResponse.payload.items[0].homeScore, '1');
      assert.equal(scoreResponse.payload.items[0].awayScore, '0');
      assert.equal(scoreResponse.headers['cache-control'], 'public, s-maxage=30, stale-while-revalidate=120');
      assert.equal(JSON.stringify(scoreResponse.payload).includes('route-test-secret'), false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
