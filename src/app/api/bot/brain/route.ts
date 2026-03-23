import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';

function getBackendConfig() {
    const botApiUrl = (process.env.BOT_BACKEND_API_URL || "https://mee-app-backend.onrender.com").replace(/\/$/, "");
    const botApiKey = process.env.BOT_BACKEND_API_KEY;
    return { botApiUrl, botApiKey };
}

async function getAuthenticatedUser() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

async function proxyToBackend(url: string, options: RequestInit = {}) {
    const { botApiKey } = getBackendConfig();

    if (!botApiKey) {
        return NextResponse.json({ error: 'Service unavailable: backend API key not configured' }, { status: 503 });
    }

    const timeout = parseInt(process.env.BOT_BRAIN_TIMEOUT_MS || '10000', 10);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${botApiKey}`,
                'User-Agent': 'Mee-App-Proxy/1.0',
                'Content-Type': 'application/json',
                ...(options.headers || {}),
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            return NextResponse.json(
                { error: 'Backend error', detail: body.detail || res.statusText },
                { status: res.status }
            );
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        clearTimeout(timeoutId);
        return NextResponse.json({
            error: 'Connection failed',
            message: error.name === 'AbortError' ? 'Timeout' : 'Backend unavailable',
        }, { status: 502 });
    }
}

export async function GET() {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { botApiUrl } = getBackendConfig();
    return proxyToBackend(`${botApiUrl}/api/dashboard/brain/${user.id}`);
}

// POST /api/bot/brain — Add a new trait
export async function POST(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { botApiUrl } = getBackendConfig();
    return proxyToBackend(`${botApiUrl}/api/dashboard/brain/${user.id}/traits`, {
        method: 'POST',
        body: JSON.stringify(body),
    });
}

// PUT /api/bot/brain — Update a trait (traitId in body)
export async function PUT(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { traitId, ...traitData } = body;
    if (!traitId) return NextResponse.json({ error: 'traitId required' }, { status: 400 });

    const { botApiUrl } = getBackendConfig();
    return proxyToBackend(`${botApiUrl}/api/dashboard/brain/${user.id}/traits/${traitId}`, {
        method: 'PUT',
        body: JSON.stringify(traitData),
    });
}

// DELETE /api/bot/brain — Delete a trait (traitId in body)
export async function DELETE(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { traitId } = body;
    if (!traitId) return NextResponse.json({ error: 'traitId required' }, { status: 400 });

    const { botApiUrl } = getBackendConfig();
    return proxyToBackend(`${botApiUrl}/api/dashboard/brain/${user.id}/traits/${traitId}`, {
        method: 'DELETE',
    });
}
