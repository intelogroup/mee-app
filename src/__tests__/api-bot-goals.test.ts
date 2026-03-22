import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
    createClient: vi.fn(),
}));

import { GET, POST, PATCH, DELETE } from "@/app/api/bot/goals/route";
import { createClient } from "@/lib/supabase";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockAuth(user: { id: string } | null) {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: async () => ({ data: { user } }) },
    } as any);
}

describe("GET /api/bot/goals", () => {
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

    it("returns goals from backend", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ goals: [{ id: "g1", title: "Be kinder" }] }),
        });
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.goals).toHaveLength(1);
    });

    it("returns 500 when API key is missing", async () => {
        mockAuth({ id: "user-1" });
        vi.stubEnv("BOT_BACKEND_API_KEY", "");
        const res = await GET();
        expect(res.status).toBe(500);
    });

    it("returns 502 when backend is unavailable", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockRejectedValueOnce(new Error("fail"));
        const res = await GET();
        expect(res.status).toBe(502);
    });
});

describe("POST /api/bot/goals", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("BOT_BACKEND_API_KEY", "test-key");
        vi.stubEnv("BOT_BACKEND_API_URL", "http://localhost:8000");
    });

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const req = new Request("http://localhost/api/bot/goals", {
            method: "POST",
            body: JSON.stringify({ title: "New goal" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("creates a goal via backend", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: "g2", title: "New goal" }),
        });
        const req = new Request("http://localhost/api/bot/goals", {
            method: "POST",
            body: JSON.stringify({ title: "New goal" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.title).toBe("New goal");
    });
});

describe("PATCH /api/bot/goals", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("BOT_BACKEND_API_KEY", "test-key");
        vi.stubEnv("BOT_BACKEND_API_URL", "http://localhost:8000");
    });

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const req = new Request("http://localhost/api/bot/goals", {
            method: "PATCH",
            body: JSON.stringify({ goalId: "g1", title: "Updated" }),
        });
        const res = await PATCH(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 when goalId is missing", async () => {
        mockAuth({ id: "user-1" });
        const req = new Request("http://localhost/api/bot/goals", {
            method: "PATCH",
            body: JSON.stringify({ title: "Updated" }),
        });
        const res = await PATCH(req);
        expect(res.status).toBe(400);
    });

    it("updates a goal via backend", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ id: "g1", title: "Updated" }),
        });
        const req = new Request("http://localhost/api/bot/goals", {
            method: "PATCH",
            body: JSON.stringify({ goalId: "g1", title: "Updated" }),
        });
        const res = await PATCH(req);
        expect(res.status).toBe(200);
    });
});

describe("DELETE /api/bot/goals", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("BOT_BACKEND_API_KEY", "test-key");
        vi.stubEnv("BOT_BACKEND_API_URL", "http://localhost:8000");
    });

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const req = new Request("http://localhost/api/bot/goals", {
            method: "DELETE",
            body: JSON.stringify({ goalId: "g1" }),
        });
        const res = await DELETE(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 when goalId is missing", async () => {
        mockAuth({ id: "user-1" });
        const req = new Request("http://localhost/api/bot/goals", {
            method: "DELETE",
            body: JSON.stringify({}),
        });
        const res = await DELETE(req);
        expect(res.status).toBe(400);
    });

    it("deletes a goal via backend", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ok: true }),
        });
        const req = new Request("http://localhost/api/bot/goals", {
            method: "DELETE",
            body: JSON.stringify({ goalId: "g1" }),
        });
        const res = await DELETE(req);
        expect(res.status).toBe(200);
    });
});
