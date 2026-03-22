import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function getAuthenticatedUser() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return user;
}

/**
 * GET /api/user/preferences
 * Returns the user's notification preferences from the profiles table.
 */
export async function GET() {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("weekly_checkin_enabled, weekly_checkin_day, weekly_checkin_hour")
        .eq("id", user.id)
        .single();

    if (error) {
        return NextResponse.json(
            {
                weekly_checkin_enabled: false,
                weekly_checkin_day: 1,
                weekly_checkin_hour: 9,
            },
            { status: 200 }
        );
    }

    return NextResponse.json({
        weekly_checkin_enabled: data.weekly_checkin_enabled ?? false,
        weekly_checkin_day: data.weekly_checkin_day ?? 1,
        weekly_checkin_hour: data.weekly_checkin_hour ?? 9,
    });
}

/**
 * PUT /api/user/preferences
 * Updates notification preferences in the profiles table.
 */
export async function PUT(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { weekly_checkin_enabled, weekly_checkin_day, weekly_checkin_hour } = body;

    // Validate inputs
    if (typeof weekly_checkin_enabled !== "boolean") {
        return NextResponse.json({ error: "weekly_checkin_enabled must be a boolean" }, { status: 400 });
    }
    if (typeof weekly_checkin_day !== "number" || weekly_checkin_day < 0 || weekly_checkin_day > 6) {
        return NextResponse.json({ error: "weekly_checkin_day must be 0-6 (Sun-Sat)" }, { status: 400 });
    }
    if (typeof weekly_checkin_hour !== "number" || weekly_checkin_hour < 0 || weekly_checkin_hour > 23) {
        return NextResponse.json({ error: "weekly_checkin_hour must be 0-23" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
        .from("profiles")
        .update({
            weekly_checkin_enabled,
            weekly_checkin_day,
            weekly_checkin_hour,
        })
        .eq("id", user.id);

    if (error) {
        return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
