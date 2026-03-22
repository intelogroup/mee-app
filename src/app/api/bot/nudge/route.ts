import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
    shouldSendNudge,
    pickNudgeTemplate,
    INACTIVITY_THRESHOLD_DAYS,
} from "@/lib/nudge";

function getBackendConfig() {
    const botApiUrl = (
        process.env.BOT_BACKEND_API_URL ||
        "https://mee-app-backend.onrender.com"
    ).replace(/\/$/, "");
    const botApiKey = process.env.BOT_BACKEND_API_KEY;
    return { botApiUrl, botApiKey };
}

/**
 * POST /api/bot/nudge
 *
 * Triggered by a cron job or manual invocation.
 * Finds users who have been inactive for INACTIVITY_THRESHOLD_DAYS and sends
 * them a re-engagement nudge via the backend Telegram bot.
 *
 * Requires BOT_BACKEND_API_KEY in the Authorization header or as env var.
 */
export async function POST(request: NextRequest) {
    // Authenticate: require the backend API key
    const authHeader = request.headers.get("authorization");
    const expectedKey = process.env.BOT_BACKEND_API_KEY;

    if (!expectedKey) {
        return NextResponse.json(
            { error: "Server misconfiguration" },
            { status: 500 }
        );
    }

    const providedKey = authHeader?.replace("Bearer ", "");
    if (providedKey !== expectedKey) {
        return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
        );
    }

    // Find users with nudge_enabled who haven't interacted recently
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - INACTIVITY_THRESHOLD_DAYS);

    const { data: profiles, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("id, telegram_chat_id, last_interaction, nudge_enabled, is_active")
        .eq("is_active", true)
        .eq("nudge_enabled", true)
        .not("telegram_chat_id", "is", null);

    if (profileError) {
        return NextResponse.json(
            { error: "Failed to query profiles", detail: profileError.message },
            { status: 500 }
        );
    }

    if (!profiles || profiles.length === 0) {
        return NextResponse.json({
            nudges_sent: 0,
            message: "No eligible users found",
        });
    }

    const { botApiUrl, botApiKey } = getBackendConfig();
    const results: Array<{
        user_id: string;
        sent: boolean;
        error?: string;
    }> = [];

    for (const profile of profiles) {
        if (!shouldSendNudge(profile.last_interaction, true)) {
            continue;
        }

        const message = pickNudgeTemplate();

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const res = await fetch(
                `${botApiUrl}/api/bot/send-message`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${botApiKey}`,
                        "Content-Type": "application/json",
                        "User-Agent": "Mee-App-Nudge/1.0",
                    },
                    body: JSON.stringify({
                        chat_id: profile.telegram_chat_id,
                        message,
                    }),
                    signal: controller.signal,
                }
            );

            clearTimeout(timeoutId);

            if (res.ok) {
                results.push({ user_id: profile.id, sent: true });

                // Update last_nudge_sent timestamp
                await supabaseAdmin
                    .from("profiles")
                    .update({ last_nudge_sent: new Date().toISOString() })
                    .eq("id", profile.id);
            } else {
                results.push({
                    user_id: profile.id,
                    sent: false,
                    error: `Backend returned ${res.status}`,
                });
            }
        } catch (err: unknown) {
            const e = err as Error;
            results.push({
                user_id: profile.id,
                sent: false,
                error: e.name === "AbortError" ? "Timeout" : "Send failed",
            });
        }
    }

    const sentCount = results.filter((r) => r.sent).length;
    return NextResponse.json({
        nudges_sent: sentCount,
        total_eligible: results.length,
        results,
    });
}
