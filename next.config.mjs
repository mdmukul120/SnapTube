/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    '*.e2b.app',
    '*.vercel.app',
    'localhost',
    '127.0.0.1',
  ],
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/MetaTube.apk',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/vnd.android.package-archive',
          },
          {
            key: 'Content-Disposition',
            value: 'attachment; filename="MetaTube.apk"',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, must-revalidate',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
