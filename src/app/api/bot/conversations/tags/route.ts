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
 * Infer topic tags from a session summary or messages using simple keyword rules.
 * This runs entirely in the Next.js layer — no extra LLM call needed.
 */
export function inferTags(text: string): string[] {
    const lower = text.toLowerCase();
    const tagRules: [string, string[]][] = [
        ["career", ["job", "work", "career", "promotion", "boss", "colleague", "interview", "salary", "fired", "hire", "startup", "business"]],
        ["relationships", ["friend", "relationship", "partner", "dating", "romance", "marriage", "family", "parent", "sibling", "conflict", "argument", "breakup"]],
        ["habits", ["habit", "routine", "morning", "exercise", "sleep", "meditation", "practice", "discipline", "procrastinat", "productivity"]],
        ["emotions", ["anxious", "anxiety", "stress", "overwhelm", "sad", "happy", "emotion", "feel", "mood", "depress", "fear", "worried", "anger", "frustrated"]],
        ["goals", ["goal", "dream", "ambition", "aspir", "vision", "target", "milestone", "achieve", "plan"]],
        ["communication", ["communicat", "speak", "presentation", "confidence", "assertive", "express", "listen", "conversation"]],
        ["health", ["health", "fitness", "diet", "nutrition", "weight", "mental health", "therapist", "doctor", "sick", "energy"]],
        ["finance", ["money", "financ", "debt", "budget", "saving", "invest", "spend", "income"]],
    ];

    const matched: string[] = [];
    for (const [tag, keywords] of tagRules) {
        if (keywords.some((kw) => lower.includes(kw))) {
            matched.push(tag);
        }
    }
    return matched.slice(0, 3); // cap at 3 tags per session
}

/**
 * GET /api/bot/conversations/tags
 * Returns all unique topic tags found in the user's conversation history,
 * optionally along with per-session tag data.
 */
export async function GET() {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin
        .from("session_tags")
        .select("tag")
        .eq("user_id", user.id);

    if (error) {
        // Table may not exist yet — return empty gracefully
        return NextResponse.json({ tags: [] });
    }

    const allTags = (data ?? []).map((row: { tag: string }) => row.tag);
    const uniqueTags = Array.from(new Set(allTags)).sort();

    return NextResponse.json({ tags: uniqueTags });
}

/**
 * POST /api/bot/conversations/tags
 * Body: { session_key: string, text: string }
 * Infers tags for a given session text and upserts them into session_tags.
 * session_key is a stable identifier (e.g. started_at ISO string).
 */
export async function POST(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { session_key, text } = body;

    if (!session_key || typeof session_key !== "string") {
        return NextResponse.json({ error: "session_key is required" }, { status: 400 });
    }
    if (!text || typeof text !== "string") {
        return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const tags = inferTags(text);

    if (tags.length === 0) {
        return NextResponse.json({ tags: [] });
    }

    // Delete old tags for this session first, then insert fresh ones
    await supabaseAdmin
        .from("session_tags")
        .delete()
        .eq("user_id", user.id)
        .eq("session_key", session_key);

    const rows = tags.map((tag) => ({
        user_id: user.id,
        session_key,
        tag,
    }));

    const { error } = await supabaseAdmin.from("session_tags").insert(rows);

    if (error) {
        return NextResponse.json({ error: "Failed to save tags" }, { status: 500 });
    }

    return NextResponse.json({ tags });
}
