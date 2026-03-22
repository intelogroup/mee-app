import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

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

/**
 * GET /api/user/privacy
 * Returns a summary of what data the AI has stored about the user.
 */
export async function GET() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { botApiUrl, botApiKey } = getBackendConfig();

    // Fetch profile preferences
    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("data_collection_enabled, nudge_enabled, created_at")
        .eq("id", user.id)
        .single();

    // Fetch brain data summary from backend
    let brainSummary = { trait_count: 0, pattern_count: 0 };
    if (botApiKey) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(
                `${botApiUrl}/api/dashboard/brain/${user.id}`,
                {
                    headers: {
                        Authorization: `Bearer ${botApiKey}`,
                        "User-Agent": "Mee-App-Proxy/1.0",
                    },
                    signal: controller.signal,
                }
            );
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                brainSummary = {
                    trait_count: data.traits?.length ?? 0,
                    pattern_count: data.patterns?.length ?? 0,
                };
            }
        } catch {
            // Backend unavailable — return zeros
        }
    }

    // Fetch conversation count from backend
    let conversationCount = 0;
    if (botApiKey) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            const res = await fetch(
                `${botApiUrl}/api/dashboard/conversations/${user.id}?limit=1&offset=0`,
                {
                    headers: {
                        Authorization: `Bearer ${botApiKey}`,
                        "User-Agent": "Mee-App-Proxy/1.0",
                    },
                    signal: controller.signal,
                }
            );
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                conversationCount = data.total ?? data.conversations?.length ?? 0;
            }
        } catch {
            // Backend unavailable
        }
    }

    return NextResponse.json({
        data_collection_enabled: profile?.data_collection_enabled ?? true,
        nudge_enabled: profile?.nudge_enabled ?? true,
        account_created: profile?.created_at ?? user.created_at,
        stored_data: {
            trait_count: brainSummary.trait_count,
            pattern_count: brainSummary.pattern_count,
            conversation_count: conversationCount,
        },
    });
}

/**
 * PUT /api/user/privacy
 * Updates data collection preferences.
 */
export async function PUT(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { data_collection_enabled, nudge_enabled } = body;

    if (
        typeof data_collection_enabled !== "boolean" ||
        typeof nudge_enabled !== "boolean"
    ) {
        return NextResponse.json(
            { error: "data_collection_enabled and nudge_enabled must be booleans" },
            { status: 400 }
        );
    }

    const { error } = await supabaseAdmin
        .from("profiles")
        .update({ data_collection_enabled, nudge_enabled })
        .eq("id", user.id);

    if (error) {
        return NextResponse.json(
            { error: "Failed to save privacy preferences" },
            { status: 500 }
        );
    }

    return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/user/privacy
 * Resets all AI memory: clears conversations, brain traits/patterns, and Pinecone vectors.
 */
export async function DELETE() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { botApiUrl, botApiKey } = getBackendConfig();

    if (!botApiKey) {
        return NextResponse.json(
            { error: "Server misconfiguration" },
            { status: 500 }
        );
    }

    const errors: string[] = [];

    // 1. Clear brain data (traits + patterns) via backend
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(
            `${botApiUrl}/api/dashboard/brain/${user.id}/reset`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${botApiKey}`,
                    "User-Agent": "Mee-App-Proxy/1.0",
                    "Content-Type": "application/json",
                },
                signal: controller.signal,
            }
        );
        clearTimeout(timeoutId);
        if (!res.ok) {
            errors.push("Failed to clear brain data");
        }
    } catch {
        errors.push("Brain data service unavailable");
    }

    // 2. Clear conversation history via backend
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(
            `${botApiUrl}/api/dashboard/conversations/${user.id}/reset`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${botApiKey}`,
                    "User-Agent": "Mee-App-Proxy/1.0",
                    "Content-Type": "application/json",
                },
                signal: controller.signal,
            }
        );
        clearTimeout(timeoutId);
        if (!res.ok) {
            errors.push("Failed to clear conversation history");
        }
    } catch {
        errors.push("Conversation service unavailable");
    }

    // 3. Clear Pinecone vectors via backend
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const res = await fetch(
            `${botApiUrl}/api/dashboard/vectors/${user.id}/reset`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${botApiKey}`,
                    "User-Agent": "Mee-App-Proxy/1.0",
                    "Content-Type": "application/json",
                },
                signal: controller.signal,
            }
        );
        clearTimeout(timeoutId);
        if (!res.ok) {
            errors.push("Failed to clear vector embeddings");
        }
    } catch {
        errors.push("Vector service unavailable");
    }

    if (errors.length > 0) {
        return NextResponse.json(
            {
                partial: true,
                message: "Some data could not be cleared",
                errors,
            },
            { status: 207 }
        );
    }

    return NextResponse.json({
        ok: true,
        message: "All AI memory has been cleared",
    });
}
