import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();

        if (!email || !password) {
            return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
        }
        if (password.length < 8) {
            return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
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

        return NextResponse.json({ user: { id: data.user?.id, email: data.user?.email } }, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
}
