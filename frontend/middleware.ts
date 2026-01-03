import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
	const isAuthenticated = !!req.auth;
	const isAuthPage = req.nextUrl.pathname.startsWith("/auth");
	const isPublicPage = req.nextUrl.pathname === "/";

	// Allow public pages
	if (isPublicPage) {
		return NextResponse.next();
	}

	// Redirect authenticated users away from auth pages
	if (isAuthPage && isAuthenticated) {
		return NextResponse.redirect(new URL("/one-click", req.url));
	}

	// Redirect unauthenticated users to login
	if (!isAuthPage && !isAuthenticated) {
		const callbackUrl = encodeURIComponent(req.nextUrl.pathname);
		return NextResponse.redirect(
			new URL(`/auth/login?callbackUrl=${callbackUrl}`, req.url)
		);
	}

	return NextResponse.next();
});

export const config = {
	matcher: [
		/*
		 * Match all request paths except:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 * - public folder
		 * - api routes
		 */
		"/((?!_next/static|_next/image|favicon.ico|api|public).*)",
	],
};
