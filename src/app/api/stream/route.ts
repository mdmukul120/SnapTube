import { NextRequest, NextResponse } from 'next/server';
import { hasServerOutboundAccess } from '@/lib/server-network';
import { isSafePublicUrl, sanitizeFilename } from '@/lib/url-matcher';

export async function GET(req: NextRequest) {
  const targetUrl = (req.nextUrl.searchParams.get('url') || '').trim();
  const title = req.nextUrl.searchParams.get('title') || 'MetaTube_Media';
  const ext = req.nextUrl.searchParams.get('ext') || 'mp4';

  const safety = isSafePublicUrl(targetUrl);
  if (!safety.ok) {
    return NextResponse.json({ error: safety.reason || 'Blocked URL' }, { status: 400 });
  }

  const outboundOk = await hasServerOutboundAccess();
  if (!outboundOk) {
    // Redirect browser directly to media stream when running in preview sandbox
    return NextResponse.redirect(targetUrl, 302);
  }

  try {
    const upstreamHeaders: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36',
    };
    const range = req.headers.get('range');
    if (range) upstreamHeaders['Range'] = range;

    const upstream = await fetch(targetUrl, {
      headers: upstreamHeaders,
      redirect: 'follow',
    });

    if (!upstream.ok || !upstream.body) {
      return NextResponse.redirect(targetUrl, 302);
    }

    const safeName = sanitizeFilename(title, ext);
    const headers = new Headers();
    headers.set(
      'Content-Type',
      upstream.headers.get('content-type') || 'application/octet-stream'
    );
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) headers.set('Content-Length', contentLength);
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) headers.set('Content-Range', contentRange);
    headers.set(
      'Content-Disposition',
      `attachment; filename="${safeName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(safeName)}`
    );

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch {
    return NextResponse.redirect(targetUrl, 302);
  }
}
