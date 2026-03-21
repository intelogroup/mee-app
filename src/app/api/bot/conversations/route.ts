import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function GET(request: Request) {
    // Verify authenticated user and scope to their own data
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const botApiUrl = (
        process.env.BOT_BACKEND_API_URL ||
        "https://mee-app-backend.onrender.com"
    ).replace(/\/$/, "");
    const botApiKey = process.env.BOT_BACKEND_API_KEY;

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
