import { fetchProviderResource, sanitizeChannels, sendJson } from '../lib/provider.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'method_not_allowed', items: [] });
  }

  try {
    const provider = await fetchProviderResource('channels');
    if (!provider.configured) return sendJson(res, 200, { configured: false, items: [] });
    const items = sanitizeChannels(provider.data);
    return sendJson(res, 200, { configured: true, items });
  } catch {
    console.error('[api/channels] authorized provider request failed');
    return sendJson(res, 502, { configured: true, error: 'provider_unavailable', items: [] });
  }
}
