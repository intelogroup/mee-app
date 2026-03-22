import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware handles:
 * 1. Supabase session refresh on every request
 * 2. Auth gate — redirect unauthenticated users from /dashboard/* to /login
 * 3. Onboarding gate — redirect incomplete users from /dashboard/history, /dashboard/brain, etc. back to /dashboard
 */

// Dashboard sub-routes that require completed onboarding
const GATED_SUBROUTES = ["/dashboard/history", "/dashboard/brain", "/dashboard/settings"];
const ONBOARDING_REQUIRED_STEP = 4;

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: { headers: request.headers },
    });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll: () => request.cookies.getAll(),
                setAll: (cookiesToSet) => {
                    cookiesToSet.forEach(({ name, value }) => {
                        request.cookies.set(name, value);
                    });
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options);
                    });
                },
            },
        }
    );

    const {
        data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    // 1. Auth gate: unauthenticated users can't access /dashboard
    if (!user && pathname.startsWith("/dashboard")) {
        return NextResponse.redirect(new URL("/login", request.url));
    }

    // 2. Onboarding gate: check sub-routes that require completed onboarding
    if (user && GATED_SUBROUTES.some((route) => pathname.startsWith(route))) {
        // Use service key to read profile (RLS won't work with anon key in middleware context)
        const serviceKey = process.env.SUPABASE_SERVICE_KEY;
        if (serviceKey) {
            const adminClient = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                serviceKey,
                {
                    cookies: {
                        getAll: () => [],
                        setAll: () => {},
                    },
                }
            );

            const { data: profile } = await adminClient
                .from("profiles")
                .select("onboarding_step")
                .eq("id", user.id)
                .single();

            const step = profile?.onboarding_step || 0;
            if (step < ONBOARDING_REQUIRED_STEP) {
                return NextResponse.redirect(new URL("/dashboard", request.url));
            }
        }
    }

    return response;
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization)
         * - favicon.ico (favicon)
         * - public folder assets
         * - API routes (handled by their own auth)
         */
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/).*)",
    ],
};
