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
                'Authorization': `Bearer ${botApiKey}`
            },
            next: { revalidate: 0 }
        });

        if (!res.ok) {
            console.error(`[Proxy] Backend returned error: ${res.status} ${res.statusText} at ${targetUrl}`);
            return NextResponse.json({ error: `Backend error: ${res.status}` }, { status: res.status });
        }

        const data = await res.json();
        console.log(`[Proxy] Successfully proxied brain data for ${userId} (${res.status} OK)`);
        return NextResponse.json(data);
    } catch (error) {
        console.error("[Proxy] Unexpected error in brain proxy:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
