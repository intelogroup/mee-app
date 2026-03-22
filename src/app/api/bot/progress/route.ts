import { NextResponse, NextRequest } from "next/server";
import { createClient } from "@/lib/supabase";

function getBackendConfig() {
    const botApiUrl = (
        process.env.BOT_BACKEND_API_URL ||
        "https://mee-app-backend.onrender.com"
    ).replace(/\/$/, "");
    const botApiKey = process.env.BOT_BACKEND_API_KEY;
    return { botApiUrl, botApiKey };
}

async function getAuthenticatedUser() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return user;
}

export async function GET(request: NextRequest) {
    const user = await getAuthenticatedUser();
    if (!user)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { botApiUrl, botApiKey } = getBackendConfig();
    if (!botApiKey)
        return NextResponse.json(
            { error: "Server misconfiguration" },
            { status: 500 }
        );

    const period =
        request.nextUrl.searchParams.get("period") || "weekly";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const res = await fetch(
            `${botApiUrl}/api/dashboard/progress/${user.id}?period=${period}`,
            {
                headers: {
                    Authorization: `Bearer ${botApiKey}`,
                    "Content-Type": "application/json",
                },
                signal: controller.signal,
            }
        );

        clearTimeout(timeoutId);

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return NextResponse.json(
                { error: "Backend error", detail: body.detail || res.statusText },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: unknown) {
        clearTimeout(timeoutId);
        const isAbort =
            error instanceof Error && error.name === "AbortError";
        return NextResponse.json(
            {
                error: "Connection failed",
                message: isAbort ? "Timeout" : "Backend unavailable",
            },
            { status: 502 }
        );
    }
}
