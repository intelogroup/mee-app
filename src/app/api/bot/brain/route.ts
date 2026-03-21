import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

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
                'Authorization': botApiKey ? `Bearer ${botApiKey}` : '',
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
