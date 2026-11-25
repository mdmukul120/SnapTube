let cachedOutboundAvailable: boolean | null = null;
let lastCheckedAt = 0;

/**
 * Fast 1.5s check to detect whether the Node server has general outbound internet access
 * (e.g. Vercel / Docker / Local) or is running in an egress-restricted sandbox (e.g. E2B preview).
 */
export async function hasServerOutboundAccess(): Promise<boolean> {
  const now = Date.now();
  if (cachedOutboundAvailable !== null && now - lastCheckedAt < 60_000) {
    return cachedOutboundAvailable;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1500);
  try {
    const res = await fetch('https://api.dailymotion.com/videos?limit=1', {
      method: 'GET',
      signal: controller.signal,
    });
    cachedOutboundAvailable = res.ok;
  } catch {
    cachedOutboundAvailable = false;
  } finally {
    clearTimeout(timer);
    lastCheckedAt = now;
  }
  return cachedOutboundAvailable;
}
