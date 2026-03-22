import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
    createClient: vi.fn(),
}));

import { GET, POST } from "@/app/api/bot/conversations/route";
import { createClient } from "@/lib/supabase";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockAuth(user: { id: string } | null) {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: async () => ({ data: { user } }) },
    } as any);
}

describe("GET /api/bot/conversations", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("BOT_BACKEND_API_KEY", "test-key");
        vi.stubEnv("BOT_BACKEND_API_URL", "http://localhost:8000");
    });

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const req = new Request("http://localhost/api/bot/conversations");
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it("returns 500 when API key is missing", async () => {
        mockAuth({ id: "user-1" });
        vi.stubEnv("BOT_BACKEND_API_KEY", "");
        const req = new Request("http://localhost/api/bot/conversations");
        const res = await GET(req);
        expect(res.status).toBe(500);
    });

    it("returns conversations from backend", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ conversations: [{ id: "c1" }], total: 1 }),
        });
        const req = new Request("http://localhost/api/bot/conversations");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.total).toBe(1);
        expect(body.conversations).toHaveLength(1);
    });

    it("passes limit and offset to backend", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ conversations: [], total: 0 }),
        });
        const req = new Request("http://localhost/api/bot/conversations?limit=10&offset=20");
        await GET(req);
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("limit=10"),
            expect.any(Object)
        );
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("offset=20"),
            expect.any(Object)
        );
    });

    it("returns 502 when backend is unavailable", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockRejectedValueOnce(new Error("fail"));
        const req = new Request("http://localhost/api/bot/conversations");
        const res = await GET(req);
        expect(res.status).toBe(502);
    });

    it("returns 502 on timeout", async () => {
        mockAuth({ id: "user-1" });
        const abortError = new Error("AbortError");
        abortError.name = "AbortError";
        mockFetch.mockRejectedValueOnce(abortError);
        const req = new Request("http://localhost/api/bot/conversations");
        const res = await GET(req);
        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.message).toBe("Timeout");
    });

    it("forwards backend error status", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
            json: async () => ({ detail: "Overloaded" }),
        });
        const req = new Request("http://localhost/api/bot/conversations");
        const res = await GET(req);
        expect(res.status).toBe(503);
    });
});

describe("POST /api/bot/conversations", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("BOT_BACKEND_API_KEY", "test-key");
        vi.stubEnv("BOT_BACKEND_API_URL", "http://localhost:8000");
    });

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const req = new Request("http://localhost/api/bot/conversations", {
            method: "POST",
            body: JSON.stringify({ sessionIndex: 0 }),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("returns 500 when API key is missing", async () => {
        mockAuth({ id: "user-1" });
        vi.stubEnv("BOT_BACKEND_API_KEY", "");
        const req = new Request("http://localhost/api/bot/conversations", {
            method: "POST",
            body: JSON.stringify({ sessionIndex: 0 }),
        });
        const res = await POST(req);
        expect(res.status).toBe(500);
    });

    it("generates a session summary", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ summary: "Great session" }),
        });
        const req = new Request("http://localhost/api/bot/conversations", {
            method: "POST",
            body: JSON.stringify({ sessionIndex: 2 }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.summary).toBe("Great session");
    });

    it("returns 502 when backend is unavailable", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockRejectedValueOnce(new Error("fail"));
        const req = new Request("http://localhost/api/bot/conversations", {
            method: "POST",
            body: JSON.stringify({ sessionIndex: 0 }),
        });
        const res = await POST(req);
        expect(res.status).toBe(502);
    });
});
