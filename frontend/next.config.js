// next.config.js

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@ckeditor/ckeditor5-react",
    "@ckeditor/ckeditor5-build-classic",
    "@ckeditor/ckeditor5-build-decoupled-document",
  ],
  reactStrictMode: false,
  async rewrites() {
    return [
      {
        source: "/api/auth/:path*",
        destination: "/api/auth/:path*",
      },
      {
        source: "/api/upload/:path*",
        destination: "/api/upload/:path*",
      },
      {
        source: "/api/jobs/:path*",
        destination: "/api/jobs/:path*",
      },
      {
        source: "/api/editor/:path*",
        destination: "/api/editor/:path*",
      },
      {
        source: "/api/:path*",
        destination: `${API_BASE}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
