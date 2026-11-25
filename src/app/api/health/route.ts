import { NextResponse } from 'next/server';
import { hasServerOutboundAccess } from '@/lib/server-network';
import { getYtDlpVersion } from '@/lib/server-ytdlp';

export async function GET() {
  const [ytdlpVersion, serverOutbound] = await Promise.all([
    getYtDlpVersion(),
    hasServerOutboundAccess(),
  ]);

  return NextResponse.json({
    ok: true,
    app: 'Meta Tube',
    ytdlpInstalled: Boolean(ytdlpVersion),
    ytdlpVersion,
    serverOutbound,
    engineMode: serverOutbound
      ? ytdlpVersion
        ? 'server-ytdlp-full'
        : 'server-api-full'
      : 'browser-hybrid-direct',
  });
}
