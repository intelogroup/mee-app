import { NextResponse } from "next/server";
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
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function GET(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const { botApiUrl, botApiKey } = getBackendConfig();

    if (!botApiKey) {
        return NextResponse.json(
            { error: "Server misconfiguration" },
            { status: 500 }
        );
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const targetUrl = `${botApiUrl}/api/dashboard/conversations/${userId}?limit=${limit}&offset=${offset}`;
        const res = await fetch(targetUrl, {
            headers: {
                Authorization: `Bearer ${botApiKey}`,
                "User-Agent": "Mee-App-Proxy/1.0",
            },
            signal: controller.signal,
            next: { revalidate: 0 },
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            return NextResponse.json(
                { error: "Backend error", status: res.status },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: unknown) {
        const err = error as Error;
        return NextResponse.json(
            {
                error: "Connection failed",
                message:
                    err.name === "AbortError"
                        ? "Timeout"
                        : "Backend unavailable",
            },
            { status: 502 }
        );
    }
}

// POST /api/bot/conversations — Generate a session summary
export async function POST(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const sessionIndex = body.sessionIndex ?? 0;
    const { botApiUrl, botApiKey } = getBackendConfig();

    if (!botApiKey) {
        return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000); // summaries may take longer

        const targetUrl = `${botApiUrl}/api/dashboard/conversations/${user.id}/summarize?session_index=${sessionIndex}`;
        const res = await fetch(targetUrl, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${botApiKey}`,
                "User-Agent": "Mee-App-Proxy/1.0",
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            return NextResponse.json(
                { error: "Backend error", status: res.status },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: unknown) {
        const err = error as Error;
        return NextResponse.json(
            {
                error: "Connection failed",
                message: err.name === "AbortError" ? "Timeout" : "Backend unavailable",
            },
            { status: 502 }
        );
    }
}
