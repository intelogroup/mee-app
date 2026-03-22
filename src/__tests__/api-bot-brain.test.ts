import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
    createClient: vi.fn(),
}));

import { GET, POST, PUT, DELETE } from "@/app/api/bot/brain/route";
import { createClient } from "@/lib/supabase";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockAuth(user: { id: string } | null) {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: async () => ({ data: { user } }) },
    } as any);
}

describe("GET /api/bot/brain", () => {
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

    it("returns 503 when API key is missing", async () => {
        mockAuth({ id: "user-1" });
        vi.stubEnv("BOT_BACKEND_API_KEY", "");
        const res = await GET();
        expect(res.status).toBe(503);
        const body = await res.json();
        expect(body.error).toContain("backend API key not configured");
    });

    it("returns brain data from backend", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                traits: [{ id: "t1", name: "Empathetic" }],
                patterns: [{ id: "p1", description: "Avoids conflict" }],
            }),
        });
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.traits).toHaveLength(1);
        expect(body.patterns).toHaveLength(1);
    });

    it("returns 502 when backend is unavailable", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockRejectedValueOnce(new Error("fail"));
        const res = await GET();
        expect(res.status).toBe(502);
    });

    it("returns 502 on timeout", async () => {
        mockAuth({ id: "user-1" });
        const abortError = new Error("AbortError");
        abortError.name = "AbortError";
        mockFetch.mockRejectedValueOnce(abortError);
        const res = await GET();
        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.message).toBe("Timeout");
    });
});

describe("POST /api/bot/brain", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("BOT_BACKEND_API_KEY", "test-key");
        vi.stubEnv("BOT_BACKEND_API_URL", "http://localhost:8000");
    });

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const req = new Request("http://localhost/api/bot/brain", {
            method: "POST",
            body: JSON.stringify({ name: "Curious" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("adds a new trait via backend", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: "t2", name: "Curious" }),
        });
        const req = new Request("http://localhost/api/bot/brain", {
            method: "POST",
            body: JSON.stringify({ name: "Curious" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.name).toBe("Curious");
    });
});

describe("PUT /api/bot/brain", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("BOT_BACKEND_API_KEY", "test-key");
        vi.stubEnv("BOT_BACKEND_API_URL", "http://localhost:8000");
    });

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const req = new Request("http://localhost/api/bot/brain", {
            method: "PUT",
            body: JSON.stringify({ traitId: "t1", name: "Updated" }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 when traitId is missing", async () => {
        mockAuth({ id: "user-1" });
        const req = new Request("http://localhost/api/bot/brain", {
            method: "PUT",
            body: JSON.stringify({ name: "Updated" }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(400);
    });

    it("updates a trait via backend", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: "t1", name: "Updated" }),
        });
        const req = new Request("http://localhost/api/bot/brain", {
            method: "PUT",
            body: JSON.stringify({ traitId: "t1", name: "Updated" }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(200);
    });
});

describe("DELETE /api/bot/brain", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("BOT_BACKEND_API_KEY", "test-key");
        vi.stubEnv("BOT_BACKEND_API_URL", "http://localhost:8000");
    });

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const req = new Request("http://localhost/api/bot/brain", {
            method: "DELETE",
            body: JSON.stringify({ traitId: "t1" }),
        });
        const res = await DELETE(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 when traitId is missing", async () => {
        mockAuth({ id: "user-1" });
        const req = new Request("http://localhost/api/bot/brain", {
            method: "DELETE",
            body: JSON.stringify({}),
        });
        const res = await DELETE(req);
        expect(res.status).toBe(400);
    });

    it("deletes a trait via backend", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ok: true }),
        });
        const req = new Request("http://localhost/api/bot/brain", {
            method: "DELETE",
            body: JSON.stringify({ traitId: "t1" }),
        });
        const res = await DELETE(req);
        expect(res.status).toBe(200);
    });
});
