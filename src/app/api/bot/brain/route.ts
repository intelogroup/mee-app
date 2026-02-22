import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
        return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
    }

    const botApiKey = process.env.BOT_BACKEND_API_KEY;
    const botApiUrl = process.env.BOT_BACKEND_API_URL || "http://127.0.0.1:8000";
    const targetUrl = `${botApiUrl}/api/dashboard/brain/${userId}`;

    console.log(`[Proxy] Fetching brain data for ${userId} from: ${targetUrl}`);
    if (!botApiKey) {
        console.warn("[Proxy] Missing BOT_BACKEND_API_KEY in environment");
    }

    try {
        const res = await fetch(targetUrl, {
            headers: {
                // If backend requires auth
                // 'Authorization': `Bearer ${botApiKey}`
            },
            next: { revalidate: 0 } // No cache for debugging
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`[Proxy] Backend returned error ${res.status}: ${errorText}`);
            return NextResponse.json({ 
                error: 'Backend error', 
                status: res.status,
                url: targetUrl,
                detail: errorText.slice(0, 100) 
            }, { status: res.status });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error("Brain proxy error:", error);
        return NextResponse.json({ 
            error: 'Connection failed', 
            message: error.message,
            url: targetUrl 
        }, { status: 502 });
    }
}
