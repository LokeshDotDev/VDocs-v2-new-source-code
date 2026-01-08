import type { NextConfig } from "next";

// Use NEXT_PUBLIC_API_URL from .env.local or fallback to localhost:4000
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

const nextConfig: NextConfig = {
	// Ensure CKEditor packages are transpiled correctly for Next/Turbopack
	transpilePackages: [
		"@ckeditor/ckeditor5-react",
		"@ckeditor/ckeditor5-build-classic",
		"@ckeditor/ckeditor5-build-decoupled-document",
	],
	// Optional: turn off reactStrictMode if CKEditor has timing issues
	reactStrictMode: false,
	async rewrites() {
		return [
			// Keep NextAuth local to the Next.js app (do NOT proxy to backend)
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

export default nextConfig;
