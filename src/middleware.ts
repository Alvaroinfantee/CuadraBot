import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Check for next-auth session cookie (works in Edge Runtime without crypto)
    const sessionToken =
        req.cookies.get("next-auth.session-token")?.value ||
        req.cookies.get("__Secure-next-auth.session-token")?.value ||
        req.cookies.get("authjs.session-token")?.value ||
        req.cookies.get("__Secure-authjs.session-token")?.value;
    const isAuthenticated = !!sessionToken;

    // Protected routes
    const isProtectedRoute =
        pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
    const isAuthRoute =
        pathname.startsWith("/iniciar-sesion") ||
        pathname.startsWith("/registrarse");

    if (isProtectedRoute && !isAuthenticated) {
        const signInUrl = new URL("/iniciar-sesion", req.url);
        signInUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(signInUrl);
    }

    if (isAuthRoute && isAuthenticated) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/admin/:path*",
        "/iniciar-sesion",
        "/registrarse",
    ],
};
