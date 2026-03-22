import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase-admin", () => ({
    supabaseAdmin: {
        from: vi.fn(),
    },
}));

import { POST } from "@/app/api/bot/nudge/route";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest } from "next/server";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeRequest(apiKey?: string) {
    const headers: Record<string, string> = {};
    if (apiKey) headers["authorization"] = `Bearer ${apiKey}`;
    return new NextRequest("http://localhost/api/bot/nudge", {
        method: "POST",
        headers,
    });
}

function mockProfilesQuery(profiles: any[], error: any = null) {
    const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockResolvedValue({ data: profiles, error }),
    };
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    return chain;
}

describe("POST /api/bot/nudge", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("BOT_BACKEND_API_KEY", "test-key");
        vi.stubEnv("BOT_BACKEND_API_URL", "http://localhost:8000");
    });

    it("returns 401 without valid API key", async () => {
        const res = await POST(makeRequest("wrong-key"));
        expect(res.status).toBe(401);
    });

    it("returns 401 without authorization header", async () => {
        const res = await POST(makeRequest());
        expect(res.status).toBe(401);
    });

    it("returns 0 nudges when no eligible users", async () => {
        mockProfilesQuery([]);
        const res = await POST(makeRequest("test-key"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.nudges_sent).toBe(0);
    });

    it("sends nudge to inactive user", async () => {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

        // First call: from("profiles").select().eq().eq().not() for the query
        const selectChain = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: "user-1",
                        telegram_chat_id: "chat-123",
                        last_interaction: tenDaysAgo.toISOString(),
                        nudge_enabled: true,
                        is_active: true,
                    },
                ],
                error: null,
            }),
        };

        // Second call: from("profiles").update().eq() for updating last_nudge_sent
        const updateChain = {
            update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ error: null }),
            }),
        };

        let callCount = 0;
        (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
            callCount++;
            return callCount === 1 ? selectChain : updateChain;
        });

        // Mock the send-message backend call
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ sent: true }),
        });

        const res = await POST(makeRequest("test-key"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.nudges_sent).toBe(1);
    });

    it("skips recently active users", async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        mockProfilesQuery([
            {
                id: "user-1",
                telegram_chat_id: "chat-123",
                last_interaction: yesterday.toISOString(),
                nudge_enabled: true,
                is_active: true,
            },
        ]);

        const res = await POST(makeRequest("test-key"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.nudges_sent).toBe(0);
    });

    it("returns 500 when database query fails", async () => {
        mockProfilesQuery(null, { message: "DB error" });
        const res = await POST(makeRequest("test-key"));
        expect(res.status).toBe(500);
    });

    it("handles send failure gracefully", async () => {
        const tenDaysAgo = new Date();
        tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

        mockProfilesQuery([
            {
                id: "user-1",
                telegram_chat_id: "chat-123",
                last_interaction: tenDaysAgo.toISOString(),
                nudge_enabled: true,
                is_active: true,
            },
        ]);

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
            json: async () => ({}),
        });

        const res = await POST(makeRequest("test-key"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.nudges_sent).toBe(0);
        expect(body.results[0].sent).toBe(false);
    });
});
