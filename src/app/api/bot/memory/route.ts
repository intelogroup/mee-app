import { NextRequest, NextResponse } from "next/server";
import { saveMemory } from "@/lib/pinecone";

export async function POST(req: NextRequest) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.BOT_WEBHOOK_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { user_id, text, role } = await req.json();

        if (!user_id || !text || !role) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const result = await saveMemory(user_id, text, role);

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error processing memory request:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
