import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Simple in-memory rate limiter for signup
const signupAttempts = new Map<string, { count: number; resetAt: number }>();
const SIGNUP_LIMIT = 5;
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;

export async function proxy(request: NextRequest) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll();
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) =>
                        request.cookies.set(name, value)
                    );
                    supabaseResponse = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        supabaseResponse.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session — required for @supabase/ssr
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const { pathname } = request.nextUrl;

    // Rate limit /api/signup
    if (pathname === "/api/signup" && request.method === "POST") {
        const ip =
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            request.headers.get("x-real-ip") ??
            "unknown";
        const now = Date.now();
        const entry = signupAttempts.get(ip);
        if (entry && now < entry.resetAt) {
            if (entry.count >= SIGNUP_LIMIT) {
                return new NextResponse(
                    JSON.stringify({ error: "Too many signup attempts. Try again later." }),
                    { status: 429, headers: { "Content-Type": "application/json" } }
                );
            }
            entry.count++;
        } else {
            signupAttempts.set(ip, { count: 1, resetAt: now + SIGNUP_WINDOW_MS });
        }
    }

    // Protect /dashboard
    if (pathname.startsWith("/dashboard") && !user) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("callbackUrl", pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Redirect logged-in users away from auth pages
    if ((pathname === "/login" || pathname === "/signup") && user) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return supabaseResponse;
}

export const proxyConfig = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    ],
};
