import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase-admin", () => ({
    supabaseAdmin: {
        from: vi.fn(),
        auth: {
            admin: {
                getUserById: vi.fn(),
            },
        },
    },
}));

import { POST } from "@/app/api/bot/link/route";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest } from "next/server";

const VALID_SECRET = "test-webhook-secret";

function makeRequest(body: unknown, authHeader?: string) {
    return new NextRequest("http://localhost/api/bot/link", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { authorization: authHeader } : {}),
        },
    });
}

function mockGetUser(user: { user: { id: string } } | null, error: unknown = null) {
    (supabaseAdmin.auth.admin.getUserById as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: user,
        error,
    });
}

function mockUpsert(error: unknown = null) {
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error }),
    });
}

describe("POST /api/bot/link", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.BOT_WEBHOOK_SECRET = VALID_SECRET;
    });

    it("returns 401 when no auth header", async () => {
        const res = await POST(makeRequest({ user_id: "u1", telegram_chat_id: 123 }));
        expect(res.status).toBe(401);
    });

    it("returns 401 when auth header is wrong", async () => {
        const res = await POST(makeRequest({ user_id: "u1", telegram_chat_id: 123 }, "Bearer wrong"));
        expect(res.status).toBe(401);
    });

    it("returns 400 when user_id missing", async () => {
        const res = await POST(makeRequest({ telegram_chat_id: 123 }, `Bearer ${VALID_SECRET}`));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain("required");
    });

    it("returns 400 when telegram_chat_id missing", async () => {
        const res = await POST(makeRequest({ user_id: "u1" }, `Bearer ${VALID_SECRET}`));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain("required");
    });

    it("returns 404 when user not found in Supabase Auth", async () => {
        mockGetUser(null, { message: "not found" });
        const res = await POST(makeRequest({ user_id: "missing", telegram_chat_id: 123 }, `Bearer ${VALID_SECRET}`));
        expect(res.status).toBe(404);
    });

    it("returns 200 on successful link", async () => {
        mockGetUser({ user: { id: "u1" } });
        mockUpsert(null);
        const res = await POST(
            makeRequest({ user_id: "u1", telegram_chat_id: 999999, telegram_username: "testuser" }, `Bearer ${VALID_SECRET}`)
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.message).toContain("999999");
    });

    it("returns 500 when upsert fails", async () => {
        mockGetUser({ user: { id: "u1" } });
        mockUpsert({ message: "DB error" });
        const res = await POST(makeRequest({ user_id: "u1", telegram_chat_id: 123 }, `Bearer ${VALID_SECRET}`));
        expect(res.status).toBe(500);
    });

    it("returns 400 on invalid JSON body", async () => {
        const req = new NextRequest("http://localhost/api/bot/link", {
            method: "POST",
            body: "not json",
            headers: { "Content-Type": "application/json", authorization: `Bearer ${VALID_SECRET}` },
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });
});
