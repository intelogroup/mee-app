import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { error } = await supabaseAdmin
        .from("profiles")
        .upsert({ id: user.id, is_active: false }, { onConflict: "id" });

    if (error) {
        console.error("Deactivate error:", error);
        return NextResponse.json({ error: "Failed to deactivate account." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
