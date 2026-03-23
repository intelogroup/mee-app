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
 * GET /api/user/profile
 * Returns the user's profile preferences: communication style, coaching focus areas, language.
 */
export async function GET() {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("communication_style, coaching_focus, display_name, language")
        .eq("id", user.id)
        .single();

    if (error) {
        // Return defaults if profile row doesn't have these columns yet
        return NextResponse.json({
            communication_style: "balanced",
            coaching_focus: [],
            display_name: "",
            language: "en",
        });
    }

    return NextResponse.json({
        communication_style: data.communication_style ?? "balanced",
        coaching_focus: data.coaching_focus ?? [],
        display_name: data.display_name ?? "",
        language: data.language ?? "en",
    });
}

/**
 * PUT /api/user/profile
 * Updates communication style, coaching focus areas, display name, and language.
 */
export async function PUT(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { communication_style, coaching_focus, display_name, language } = body;

    // Validate communication_style
    const validStyles = ["direct", "gentle", "balanced", "socratic"];
    if (communication_style && !validStyles.includes(communication_style)) {
        return NextResponse.json(
            { error: `communication_style must be one of: ${validStyles.join(", ")}` },
            { status: 400 }
        );
    }

    // Validate coaching_focus is an array of strings
    if (coaching_focus && (!Array.isArray(coaching_focus) || coaching_focus.some((f: unknown) => typeof f !== "string"))) {
        return NextResponse.json(
            { error: "coaching_focus must be an array of strings" },
            { status: 400 }
        );
    }

    // Cap coaching focus areas at 5
    if (coaching_focus && coaching_focus.length > 5) {
        return NextResponse.json(
            { error: "Maximum 5 coaching focus areas allowed" },
            { status: 400 }
        );
    }

    // Validate display_name length
    if (display_name && (typeof display_name !== "string" || display_name.length > 50)) {
        return NextResponse.json(
            { error: "display_name must be a string of max 50 characters" },
            { status: 400 }
        );
    }

    // Validate language code (ISO 639-1, 2-letter)
    const validLanguages = ["en", "es", "fr", "de", "pt", "it", "ru", "zh", "ja", "ko", "ar", "hi"];
    if (language !== undefined && !validLanguages.includes(language)) {
        return NextResponse.json(
            { error: `language must be one of: ${validLanguages.join(", ")}` },
            { status: 400 }
        );
    }

    const updateData: Record<string, unknown> = {};
    if (communication_style !== undefined) updateData.communication_style = communication_style;
    if (coaching_focus !== undefined) updateData.coaching_focus = coaching_focus;
    if (display_name !== undefined) updateData.display_name = display_name;
    if (language !== undefined) updateData.language = language;

    const { error } = await supabaseAdmin
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

    if (error) {
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
