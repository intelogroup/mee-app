import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase";

const signupSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(8, "Password must be at least 8 characters."),
});

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        const { email, password, referral_code } = body;

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
        }
        if (password.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
        }

        const parsed = signupSchema.safeParse(body);
        if (!parsed.success) {
            const emailIssue = parsed.error.issues.find((i) => i.path[0] === "email");
            if (emailIssue) {
                return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
            }
        }

        const supabase = await createClient();
        
        // Determine the redirect URL
        let siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
        if (!siteUrl && process.env.VERCEL_URL) {
            siteUrl = `https://${process.env.VERCEL_URL}`;
        }
        if (!siteUrl) {
            siteUrl = req.headers.get("origin") || "http://localhost:3000";
        }
        
        const redirectTo = `${siteUrl}/auth/callback`;

        const { data, error } = await supabase.auth.signUp({ 
            email, 
            password,
            options: {
                emailRedirectTo: redirectTo
            }
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }

        // If a valid referral_code was supplied, link the new user to the referrer
        if (data.user?.id && referral_code && typeof referral_code === "string") {
            const { supabaseAdmin } = await import("@/lib/supabase-admin");
            const { data: referrerProfile } = await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq("referral_code", referral_code.toUpperCase())
                .single();

            if (referrerProfile?.id && referrerProfile.id !== data.user.id) {
                await supabaseAdmin
                    .from("profiles")
                    .update({ referred_by: referrerProfile.id })
                    .eq("id", data.user.id);
            }
        }

        return NextResponse.json({ user: { id: data.user?.id, email: data.user?.email } }, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
