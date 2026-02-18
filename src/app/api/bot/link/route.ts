import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// This endpoint is called by the Telegram bot when a user sends /start {user_id}
// The bot must include the BOT_WEBHOOK_SECRET in the Authorization header
export async function POST(req: NextRequest) {
    // Verify the request comes from our bot
    const authHeader = req.headers.get("authorization");
    const expectedSecret = process.env.BOT_WEBHOOK_SECRET;

    if (!expectedSecret || authHeader !== `Bearer ${expectedSecret}`) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    let body: { user_id: string; telegram_chat_id: number; telegram_username?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
    }

    const { user_id, telegram_chat_id, telegram_username } = body;

    if (!user_id || !telegram_chat_id) {
        return NextResponse.json({ error: "user_id and telegram_chat_id are required." }, { status: 400 });
    }

    // Verify the user exists in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (authError || !authUser.user) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Upsert the profile with telegram_chat_id
    const { error: upsertError } = await supabaseAdmin
        .from("profiles")
        .upsert(
            {
                id: user_id,
                telegram_chat_id,
                telegram_username: telegram_username ?? null,
                is_active: true,
                bot_linked_at: new Date().toISOString(),
            },
            { onConflict: "id" }
        );

    if (upsertError) {
        console.error("Profile upsert error:", upsertError);
        return NextResponse.json({ error: "Failed to link account." }, { status: 500 });
    }

    console.log(`✅ Bot linked: user=${user_id} telegram_chat_id=${telegram_chat_id}`);

    return NextResponse.json({
        success: true,
        message: `Linked Telegram ${telegram_chat_id} to user ${user_id}`,
    });
}
