import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const botApiUrl = process.env.BOT_BACKEND_API_URL || "http://127.0.0.1:8000";
    const botApiKey = process.env.BOT_BACKEND_API_KEY;
    
    const targetUrl = `${botApiUrl}/api/dashboard/brain/${userId}`;
    console.log(`[Proxy] Fetching brain data from: ${targetUrl}`);

    try {
        const res = await fetch(targetUrl, {
            headers: {
                // If backend requires auth
                'Authorization': `Bearer ${botApiKey}`
            },
            next: { revalidate: 0 } // No cache for debugging
        });

        if (!res.ok) {
            return NextResponse.json({ error: 'Backend error' }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Brain proxy error:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
