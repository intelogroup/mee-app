import { NextResponse } from "next/server";

/**
 * /api/bot/memory — stub route.
 *
 * Memory reset and privacy controls are handled by /api/user/privacy (DELETE).
 * This directory was created as a stub but has no distinct functionality.
 * All callers should use /api/user/privacy instead.
 */
export async function GET() {
    return NextResponse.json(
        { error: "Use /api/user/privacy for memory and privacy controls." },
        { status: 410 }
    );
}

export async function POST() {
    return NextResponse.json(
        { error: "Use /api/user/privacy for memory and privacy controls." },
        { status: 410 }
    );
}

export async function DELETE() {
    return NextResponse.json(
        { error: "Use /api/user/privacy for memory and privacy controls." },
        { status: 410 }
    );
}
