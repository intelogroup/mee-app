import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
    createClient: vi.fn(),
}));
vi.mock("@/lib/supabase-admin", () => ({
    supabaseAdmin: {
        from: vi.fn(),
    },
}));

import { GET, PUT, DELETE } from "@/app/api/user/privacy/route";
import { createClient } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockAuth(user: { id: string; created_at?: string } | null) {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: async () => ({ data: { user } }) },
    } as any);
}

function mockProfileSelect(data: any, error: any = null) {
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data, error }),
            }),
        }),
    });
}

function mockProfileUpdate(error: any = null) {
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue({
        update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error }),
        }),
    });
}

describe("GET /api/user/privacy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("BOT_BACKEND_API_KEY", "test-key");
        vi.stubEnv("BOT_BACKEND_API_URL", "http://localhost:8000");
    });

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const res = await GET();
        expect(res.status).toBe(401);
    });

    it("returns privacy data for authenticated user", async () => {
        mockAuth({ id: "user-1", created_at: "2024-01-01" });
        mockProfileSelect({
            data_collection_enabled: true,
            nudge_enabled: false,
            created_at: "2024-01-01",
        });

        // Mock brain fetch
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ traits: [1, 2], patterns: [1] }),
        });
        // Mock conversations fetch
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ total: 5 }),
        });

        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.data_collection_enabled).toBe(true);
        expect(body.nudge_enabled).toBe(false);
        expect(body.stored_data.trait_count).toBe(2);
        expect(body.stored_data.conversation_count).toBe(5);
    });

    it("returns defaults when backend is unavailable", async () => {
        mockAuth({ id: "user-1" });
        mockProfileSelect(null, { message: "not found" });
        mockFetch.mockRejectedValue(new Error("fail"));

        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.stored_data.trait_count).toBe(0);
        expect(body.stored_data.conversation_count).toBe(0);
    });
});

describe("PUT /api/user/privacy", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const req = new Request("http://localhost/api/user/privacy", {
            method: "PUT",
            body: JSON.stringify({
                data_collection_enabled: true,
                nudge_enabled: true,
            }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 for invalid input", async () => {
        mockAuth({ id: "user-1" });
        const req = new Request("http://localhost/api/user/privacy", {
            method: "PUT",
            body: JSON.stringify({ data_collection_enabled: "yes", nudge_enabled: true }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(400);
    });

    it("saves preferences successfully", async () => {
        mockAuth({ id: "user-1" });
        mockProfileUpdate(null);
        const req = new Request("http://localhost/api/user/privacy", {
            method: "PUT",
            body: JSON.stringify({
                data_collection_enabled: false,
                nudge_enabled: true,
            }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });

    it("returns 500 when database update fails", async () => {
        mockAuth({ id: "user-1" });
        mockProfileUpdate({ message: "DB error" });
        const req = new Request("http://localhost/api/user/privacy", {
            method: "PUT",
            body: JSON.stringify({
                data_collection_enabled: true,
                nudge_enabled: false,
            }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(500);
    });
});

describe("DELETE /api/user/privacy", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("BOT_BACKEND_API_KEY", "test-key");
        vi.stubEnv("BOT_BACKEND_API_URL", "http://localhost:8000");
    });

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const res = await DELETE();
        expect(res.status).toBe(401);
    });

    it("returns success when all resets succeed", async () => {
        mockAuth({ id: "user-1" });
        // brain reset, conversations reset, vectors reset
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        const res = await DELETE();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ok).toBe(true);
    });

    it("returns 207 on partial failure", async () => {
        mockAuth({ id: "user-1" });
        // brain reset succeeds, conversations fails, vectors succeeds
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
        mockFetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

        const res = await DELETE();
        expect(res.status).toBe(207);
        const body = await res.json();
        expect(body.partial).toBe(true);
        expect(body.errors.length).toBeGreaterThan(0);
    });

    it("returns 500 when API key is missing", async () => {
        mockAuth({ id: "user-1" });
        vi.stubEnv("BOT_BACKEND_API_KEY", "");

        const res = await DELETE();
        expect(res.status).toBe(500);
    });
});
