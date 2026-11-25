import { NextRequest, NextResponse } from 'next/server';
import { hasServerOutboundAccess } from '@/lib/server-network';
import { searchWithYtDlp } from '@/lib/server-ytdlp';
import { searchUniversalMedia } from '@/lib/universal-resolvers';

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') || '').trim();
  const source = (req.nextUrl.searchParams.get('source') || 'all') as
    | 'all'
    | 'youtube'
    | 'tiktok'
    | 'dailymotion'
    | 'music'
    | 'direct';

  if (!q) {
    return NextResponse.json({ ok: true, items: [] });
  }

  const outboundOk = await hasServerOutboundAccess();
  if (!outboundOk) {
    return NextResponse.json({
      ok: false,
      fallbackToClient: true,
    });
  }

  try {
    if (source === 'youtube') {
      const ytItems = await searchWithYtDlp(q, 12);
      if (ytItems && ytItems.length > 0) {
        return NextResponse.json({ ok: true, items: ytItems });
      }
    }

    const [ytDlpItems, universalItems] = await Promise.all([
      source === 'all' ? searchWithYtDlp(q, 6) : Promise.resolve(null),
      searchUniversalMedia(q, source),
    ]);

    const combined = [...(ytDlpItems || []), ...universalItems];
    // Deduplicate by URL
    const seen = new Set<string>();
    const unique = combined.filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });

    return NextResponse.json({ ok: true, items: unique });
  } catch {
    return NextResponse.json({ ok: false, fallbackToClient: true });
  }
}
