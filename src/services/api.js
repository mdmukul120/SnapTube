const EMPTY_RESOURCE = Object.freeze({ configured: false, items: [], error: false });

async function getResource(path, signal) {
  try {
    const response = await fetch(path, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
      signal,
    });
    const payload = await response.json();
    if (!response.ok || !payload || typeof payload !== 'object') {
      return { ...EMPTY_RESOURCE, error: true };
    }
    return {
      configured: payload.configured === true,
      items: Array.isArray(payload.items) ? payload.items : [],
      error: Boolean(payload.error),
    };
  } catch {
    // Static previews and Vite without server-side env vars remain usable.
    return { ...EMPTY_RESOURCE, error: true };
  }
}

export const fetchProviderChannels = (signal) => getResource('/api/channels', signal);
export const fetchProviderFixtures = (signal) => getResource('/api/fixtures', signal);
export const fetchProviderScores = (signal) => getResource('/api/scores', signal);
