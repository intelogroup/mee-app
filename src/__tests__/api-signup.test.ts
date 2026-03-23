import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
    createClient: vi.fn(),
}));

import { POST } from "@/app/api/signup/route";
import { createClient } from "@/lib/supabase";
import { NextRequest } from "next/server";

function makeRequest(body: unknown) {
    return new NextRequest("http://localhost/api/signup", {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json", origin: "http://localhost:3000" },
    });
}

function mockSupabase(signUpResult: { data?: unknown; error?: { message: string } | null }) {
    vi.mocked(createClient).mockResolvedValue({
        auth: {
            signUp: vi.fn().mockResolvedValue(signUpResult),
        },
    } as any);
}

describe("POST /api/signup", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 400 when email is missing", async () => {
        mockSupabase({ data: {}, error: null });
        const res = await POST(makeRequest({ password: "password123" }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain("Email");
    });

    it("returns 400 when password is missing", async () => {
        mockSupabase({ data: {}, error: null });
        const res = await POST(makeRequest({ email: "test@example.com" }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain("password");
    });

    it("returns 400 when email format is invalid", async () => {
        mockSupabase({ data: {}, error: null });
        const res = await POST(makeRequest({ email: "not-an-email", password: "password123" }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain("Invalid email format");
    });

    it("returns 400 when password is too short", async () => {
        mockSupabase({ data: {}, error: null });
        const res = await POST(makeRequest({ email: "test@example.com", password: "short" }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toContain("8 characters");
    });

    it("returns 201 with user on success", async () => {
        mockSupabase({
            data: { user: { id: "user-123", email: "test@example.com" } },
            error: null,
        });
        const res = await POST(makeRequest({ email: "test@example.com", password: "password123" }));
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body.user.email).toBe("test@example.com");
        expect(body.user.id).toBe("user-123");
    });

    it("returns 400 when Supabase returns an error", async () => {
        mockSupabase({ data: {}, error: { message: "Email already registered" } });
        const res = await POST(makeRequest({ email: "taken@example.com", password: "password123" }));
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error).toBe("Email already registered");
    });

    it("includes emailRedirectTo from origin header", async () => {
        const signUpMock = vi.fn().mockResolvedValue({ data: { user: { id: "u1", email: "a@b.com" } }, error: null });
        vi.mocked(createClient).mockResolvedValue({ auth: { signUp: signUpMock } } as any);

        await POST(makeRequest({ email: "a@b.com", password: "password123" }));

        expect(signUpMock).toHaveBeenCalledWith(
            expect.objectContaining({
                options: expect.objectContaining({
                    emailRedirectTo: expect.stringContaining("/auth/callback"),
                }),
            })
        );
    });

    it("returns 500 on unexpected error", async () => {
        vi.mocked(createClient).mockRejectedValue(new Error("DB down"));
        const res = await POST(makeRequest({ email: "x@y.com", password: "password123" }));
        expect(res.status).toBe(500);
    });
});
