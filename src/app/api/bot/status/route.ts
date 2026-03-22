import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * GET /api/bot/status
 * Returns the current user's bot connection status.
 * Used by BotStatusWatcher to check connection health and detect token expiry.
 */
export async function GET() {
    try {
        const supabase = await createClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "unauthorized", message: "Session expired. Please log in again." },
                { status: 401 }
            );
        }

        const { data: profile, error: profileError } = await supabaseAdmin
            .from("profiles")
            .select("telegram_chat_id, is_active, bot_linked_at, onboarding_step")
            .eq("id", user.id)
            .single();

        if (profileError) {
            return NextResponse.json(
                { error: "profile_not_found", message: "Profile not found. Please complete signup." },
                { status: 404 }
            );
        }

        const isLinked = !!profile.telegram_chat_id;
        const isActive = profile.is_active !== false;

        // Check if the link token might be stale (linked > 30 days ago with no recent activity)
        let linkHealth: "healthy" | "stale" | "unlinked" = "unlinked";
        if (isLinked && isActive) {
            linkHealth = "healthy";
            if (profile.bot_linked_at) {
                const linkedDate = new Date(profile.bot_linked_at);
                const daysSinceLink = (Date.now() - linkedDate.getTime()) / (1000 * 60 * 60 * 24);
                // If linked more than 90 days ago, mark as potentially stale
                if (daysSinceLink > 90) {
                    linkHealth = "stale";
                }
            }
        }

        return NextResponse.json({
            isLinked,
            isActive,
            linkHealth,
            onboardingStep: profile.onboarding_step || 0,
            botLinkedAt: profile.bot_linked_at,
        });
    } catch (error) {
        console.error("Bot status check error:", error);
        return NextResponse.json(
            { error: "server_error", message: "Failed to check bot status." },
            { status: 500 }
        );
    }
}
