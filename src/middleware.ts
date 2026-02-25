import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
    const { pathname } = req.nextUrl;

    // Protected routes
    const isProtectedRoute =
        pathname.startsWith("/dashboard") || pathname.startsWith("/admin");
    const isAdminRoute = pathname.startsWith("/admin");
    const isAuthRoute =
        pathname.startsWith("/iniciar-sesion") ||
        pathname.startsWith("/registrarse");

    if (isProtectedRoute && !req.auth) {
        const signInUrl = new URL("/iniciar-sesion", req.url);
        signInUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(signInUrl);
    }

    if (isAdminRoute && req.auth?.user?.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (isAuthRoute && req.auth) {
        return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    return NextResponse.next();
});

export const config = {
    matcher: [
        "/dashboard/:path*",
        "/admin/:path*",
        "/iniciar-sesion",
        "/registrarse",
    ],
};
