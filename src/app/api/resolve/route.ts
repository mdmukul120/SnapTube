import { NextRequest, NextResponse } from 'next/server';
import { hasServerOutboundAccess } from '@/lib/server-network';
import { resolveWithYtDlp } from '@/lib/server-ytdlp';
import { resolveUniversalUrl } from '@/lib/universal-resolvers';
import { matchInputUrl } from '@/lib/url-matcher';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';
    const cobaltApiUrl = typeof body?.cobaltApiUrl === 'string' ? body.cobaltApiUrl.trim() : undefined;

    if (!rawUrl) {
      return NextResponse.json({ ok: false, error: 'লিংক প্রদান করুন।' }, { status: 400 });
    }

    const matched = matchInputUrl(rawUrl);
    if (!matched.isUrl || !matched.extractedUrl) {
      return NextResponse.json(
        { ok: false, error: 'বৈধ কোনো ভিডিও লিংক পাওয়া যায়নি।' },
        { status: 400 }
      );
    }

    if (matched.isBlockedCategory) {
      return NextResponse.json(
        { ok: false, error: matched.blockReason || 'এই ডোমেইনটি নিরাপত্তার কারণে ব্লক করা হয়েছে।' },
        { status: 403 }
      );
    }

    const outboundOk = await hasServerOutboundAccess();
    if (!outboundOk) {
      // Instruct frontend to run Browser-Direct Hybrid Engine seamlessly
      return NextResponse.json({
        ok: false,
        fallbackToClient: true,
        matched,
      });
    }

    // 1. Try yt-dlp on server when installed (supports 1000+ sites in full HD)
    const ytdlpMedia = await resolveWithYtDlp(matched.extractedUrl);
    if (ytdlpMedia && ytdlpMedia.formats.length > 0) {
      return NextResponse.json({ ok: true, media: ytdlpMedia });
    }

    // 2. Fallback to universal HTTP resolvers on server
    const universalMedia = await resolveUniversalUrl(rawUrl, { cobaltApiUrl });
    universalMedia.resolvedBy =
      universalMedia.resolvedBy === 'browser-direct' ? 'server-api' : universalMedia.resolvedBy;

    return NextResponse.json({ ok: true, media: universalMedia });
  } catch (err: any) {
    return NextResponse.json({
      ok: false,
      fallbackToClient: true,
      error: err?.message || 'Extraction error',
    });
  }
}
