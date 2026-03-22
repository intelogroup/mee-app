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
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return user;
}

async function proxyToBackend(url: string, options: RequestInit = {}) {
    const { botApiKey } = getBackendConfig();

    if (!botApiKey) {
        return NextResponse.json(
            { error: "Server misconfiguration" },
            { status: 500 }
        );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const res = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${botApiKey}`,
                "User-Agent": "Mee-App-Proxy/1.0",
                "Content-Type": "application/json",
                ...(options.headers || {}),
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return NextResponse.json(
                {
                    error: "Backend error",
                    detail: body.detail || res.statusText,
                },
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

// GET /api/bot/goals — Fetch all goals
export async function GET() {
    const user = await getAuthenticatedUser();
    if (!user)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { botApiUrl } = getBackendConfig();
    return proxyToBackend(`${botApiUrl}/api/dashboard/goals/${user.id}`);
}

// POST /api/bot/goals — Create a new goal
export async function POST(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { botApiUrl } = getBackendConfig();
    return proxyToBackend(`${botApiUrl}/api/dashboard/goals/${user.id}`, {
        method: "POST",
        body: JSON.stringify(body),
    });
}

// PATCH /api/bot/goals — Update a goal (goalId in body)
export async function PATCH(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { goalId, ...updateData } = body;
    if (!goalId)
        return NextResponse.json(
            { error: "goalId required" },
            { status: 400 }
        );

    const { botApiUrl } = getBackendConfig();
    return proxyToBackend(
        `${botApiUrl}/api/dashboard/goals/${user.id}/${goalId}`,
        {
            method: "PATCH",
            body: JSON.stringify(updateData),
        }
    );
}

// DELETE /api/bot/goals — Delete a goal (goalId in body)
export async function DELETE(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { goalId } = body;
    if (!goalId)
        return NextResponse.json(
            { error: "goalId required" },
            { status: 400 }
        );

    const { botApiUrl } = getBackendConfig();
    return proxyToBackend(
        `${botApiUrl}/api/dashboard/goals/${user.id}/${goalId}`,
        {
            method: "DELETE",
        }
    );
}
