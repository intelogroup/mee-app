import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
    createClient: vi.fn(),
}));

import { GET } from "@/app/api/bot/conversations/export/route";
import { createClient } from "@/lib/supabase";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockAuth(user: { id: string; email?: string } | null) {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: async () => ({ data: { user } }) },
    } as any);
}

const MOCK_SESSIONS = [
    {
        started_at: "2026-03-01T10:00:00Z",
        ended_at: "2026-03-01T10:30:00Z",
        message_count: 4,
        summary: "Discussed career goals and communication skills.",
        tags: ["career", "communication"],
        messages: [
            { id: "1", role: "user", content: "Hello", created_at: "2026-03-01T10:00:00Z" },
            { id: "2", role: "assistant", content: "Hi! How can I help?", created_at: "2026-03-01T10:01:00Z" },
        ],
    },
];

describe("GET /api/bot/conversations/export", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("BOT_BACKEND_API_KEY", "test-key");
        vi.stubEnv("BOT_BACKEND_API_URL", "http://localhost:8000");
    });

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const req = new Request("http://localhost/api/bot/conversations/export");
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 for unknown format param", async () => {
        mockAuth({ id: "user-1", email: "test@example.com" });
        const req = new Request(
            "http://localhost/api/bot/conversations/export?format=pdf"
        );
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    it("returns 500 when BOT_BACKEND_API_KEY is missing", async () => {
        mockAuth({ id: "user-1", email: "test@example.com" });
        vi.stubEnv("BOT_BACKEND_API_KEY", "");
        const req = new Request("http://localhost/api/bot/conversations/export");
        const res = await GET(req);
        expect(res.status).toBe(500);
    });

    it("returns markdown file with correct headers", async () => {
        mockAuth({ id: "user-1", email: "test@example.com" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                sessions: MOCK_SESSIONS,
                total_messages: 4,
                limit: 200,
                offset: 0,
            }),
        });

        const req = new Request("http://localhost/api/bot/conversations/export");
        const res = await GET(req);
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toContain("text/markdown");
        expect(res.headers.get("Content-Disposition")).toContain(".md");
        const text = await res.text();
        expect(text).toContain("# Mee Coaching History");
        expect(text).toContain("Session 1");
        expect(text).toContain("Discussed career goals");
    });

    it("returns json file when format=json", async () => {
        mockAuth({ id: "user-1", email: "test@example.com" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                sessions: MOCK_SESSIONS,
                total_messages: 4,
                limit: 200,
                offset: 0,
            }),
        });

        const req = new Request(
            "http://localhost/api/bot/conversations/export?format=json"
        );
        const res = await GET(req);
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toContain("application/json");
        expect(res.headers.get("Content-Disposition")).toContain(".json");
    });

    it("returns 502 on backend timeout", async () => {
        mockAuth({ id: "user-1", email: "test@example.com" });
        mockFetch.mockRejectedValueOnce(
            Object.assign(new Error("Timeout"), { name: "AbortError" })
        );
        const req = new Request("http://localhost/api/bot/conversations/export");
        const res = await GET(req);
        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.message).toBe("Timeout");
    });

    it("returns 502 on backend unavailable", async () => {
        mockAuth({ id: "user-1", email: "test@example.com" });
        mockFetch.mockRejectedValueOnce(new Error("ECONNREFUSED"));
        const req = new Request("http://localhost/api/bot/conversations/export");
        const res = await GET(req);
        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.message).toBe("Backend unavailable");
    });

    it("propagates non-ok backend status", async () => {
        mockAuth({ id: "user-1", email: "test@example.com" });
        mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });
        const req = new Request("http://localhost/api/bot/conversations/export");
        const res = await GET(req);
        expect(res.status).toBe(503);
    });

    it("markdown includes topic tags from session data", async () => {
        mockAuth({ id: "user-1", email: "user@example.com" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                sessions: MOCK_SESSIONS,
                total_messages: 4,
                limit: 200,
                offset: 0,
            }),
        });
        const req = new Request("http://localhost/api/bot/conversations/export");
        const res = await GET(req);
        const text = await res.text();
        expect(text).toContain("career");
        expect(text).toContain("communication");
    });

    it("handles empty sessions gracefully", async () => {
        mockAuth({ id: "user-1", email: "user@example.com" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                sessions: [],
                total_messages: 0,
                limit: 200,
                offset: 0,
            }),
        });
        const req = new Request("http://localhost/api/bot/conversations/export");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain("No conversation history found.");
    });
});
