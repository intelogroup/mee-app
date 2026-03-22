import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
    createClient: vi.fn(),
}));

import { GET } from "@/app/api/bot/progress/route";
import { createClient } from "@/lib/supabase";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockAuth(user: { id: string } | null) {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: async () => ({ data: { user } }) },
    } as any);
}

function makeReq(url: string) {
    return new NextRequest(url);
}

describe("GET /api/bot/progress", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("BOT_BACKEND_API_KEY", "test-key");
        vi.stubEnv("BOT_BACKEND_API_URL", "http://localhost:8000");
    });

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const res = await GET(makeReq("http://localhost/api/bot/progress"));
        expect(res.status).toBe(401);
    });

    it("returns 500 when API key is missing", async () => {
        mockAuth({ id: "user-1" });
        vi.stubEnv("BOT_BACKEND_API_KEY", "");
        const res = await GET(makeReq("http://localhost/api/bot/progress"));
        expect(res.status).toBe(500);
    });

    it("returns progress data from backend", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ periods: [], summary: "No data yet" }),
        });
        const res = await GET(makeReq("http://localhost/api/bot/progress?period=weekly"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.summary).toBe("No data yet");
    });

    it("passes period query param to backend", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ periods: [] }),
        });
        await GET(makeReq("http://localhost/api/bot/progress?period=monthly"));
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("period=monthly"),
            expect.any(Object)
        );
    });

    it("defaults to weekly period when not specified", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ periods: [] }),
        });
        await GET(makeReq("http://localhost/api/bot/progress"));
        expect(mockFetch).toHaveBeenCalledWith(
            expect.stringContaining("period=weekly"),
            expect.any(Object)
        );
    });

    it("returns 502 when backend is unavailable", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockRejectedValueOnce(new Error("Connection refused"));
        const res = await GET(makeReq("http://localhost/api/bot/progress"));
        expect(res.status).toBe(502);
    });

    it("returns 502 on timeout", async () => {
        mockAuth({ id: "user-1" });
        const abortError = new Error("AbortError");
        abortError.name = "AbortError";
        mockFetch.mockRejectedValueOnce(abortError);
        const res = await GET(makeReq("http://localhost/api/bot/progress"));
        expect(res.status).toBe(502);
        const body = await res.json();
        expect(body.message).toBe("Timeout");
    });

    it("forwards backend error status", async () => {
        mockAuth({ id: "user-1" });
        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: "Not Found",
            json: async () => ({ detail: "User not found" }),
        });
        const res = await GET(makeReq("http://localhost/api/bot/progress"));
        expect(res.status).toBe(404);
    });
});
