import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

function generateReferralCode(userId: string): string {
    // Deterministic short code: first 8 chars of user UUID (no dashes) + 4 random chars
    const base = userId.replace(/-/g, "").slice(0, 8).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${base}${rand}`;
}

async function getAuthenticatedUser() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return user;
}

/**
 * GET /api/user/referral
 * Returns the user's referral code (creating one if absent) and referral count.
 */
export async function GET() {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Fetch existing profile
    const { data: profile, error: fetchError } = await supabaseAdmin
        .from("profiles")
        .select("referral_code")
        .eq("id", user.id)
        .single();

    if (fetchError) {
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }

    let referralCode = profile?.referral_code as string | null;

    // Generate a code if the user doesn't have one yet
    if (!referralCode) {
        let attempts = 0;
        while (!referralCode && attempts < 5) {
            const candidate = generateReferralCode(user.id);
            const { error: updateError } = await supabaseAdmin
                .from("profiles")
                .update({ referral_code: candidate })
                .eq("id", user.id)
                .is("referral_code", null); // only set if still null (avoids race)

            if (!updateError) {
                referralCode = candidate;
            }
            attempts++;
        }

        if (!referralCode) {
            return NextResponse.json({ error: "Could not generate referral code" }, { status: 500 });
        }
    }

    // Count how many users were referred by this user
    const { count, error: countError } = await supabaseAdmin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("referred_by", user.id);

    if (countError) {
        // Non-fatal — return 0 count
        return NextResponse.json({ referral_code: referralCode, referral_count: 0 });
    }

    return NextResponse.json({
        referral_code: referralCode,
        referral_count: count ?? 0,
    });
}
