import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

export async function GET(request: Request) {
    // Verify authenticated user and scope to their own data
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Users can only access their own brain data
    const userId = user.id;

    // Normalize URL (no trailing slash)
    const botApiUrl = (process.env.BOT_BACKEND_API_URL || "https://mee-app-backend.onrender.com").replace(/\/$/, "");
    const botApiKey = process.env.BOT_BACKEND_API_KEY;
    const targetUrl = `${botApiUrl}/api/dashboard/brain/${userId}`;

    if (!botApiKey) {
        return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const res = await fetch(targetUrl, {
            headers: {
                // Backend requires auth for these endpoints
                'Authorization': `Bearer ${botApiKey}`,
                'User-Agent': 'Mee-App-Proxy/1.0',
            },
            signal: controller.signal,
            next: { revalidate: 0 }
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            return NextResponse.json({
                error: 'Backend error',
                status: res.status,
            }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({
            error: 'Connection failed',
            message: error.name === 'AbortError' ? 'Timeout' : 'Backend unavailable',
        }, { status: 502 });
    }
}
