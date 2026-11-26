import { fetchProviderResource, sanitizeFixtures, sendJson } from '../lib/provider.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'method_not_allowed', items: [] });
  }

  try {
    const provider = await fetchProviderResource('fixtures');
    if (!provider.configured) return sendJson(res, 200, { configured: false, items: [] });
    return sendJson(
      res,
      200,
      { configured: true, items: sanitizeFixtures(provider.data) },
      'public, s-maxage=30, stale-while-revalidate=120',
    );
  } catch {
    console.error('[api/fixtures] authorized provider request failed');
    return sendJson(res, 502, { configured: true, error: 'provider_unavailable', items: [] });
  }
}
