import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
    createClient: vi.fn(),
}));
vi.mock("@/lib/supabase-admin", () => ({
    supabaseAdmin: {
        from: vi.fn(),
    },
}));

import { GET } from "@/app/api/bot/status/route";
import { createClient } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

function mockAuth(user: { id: string } | null, error: unknown = null) {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: async () => ({ data: { user }, error }) },
    } as any);
}

function mockProfile(data: Record<string, unknown> | null, error: unknown = null) {
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data, error }),
            }),
        }),
    });
}

describe("GET /api/bot/status", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const res = await GET();
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe("unauthorized");
    });

    it("returns 404 when profile not found", async () => {
        mockAuth({ id: "user-123" });
        mockProfile(null, { message: "No rows found" });
        const res = await GET();
        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toBe("profile_not_found");
    });

    it("returns linked=true when telegram_chat_id present", async () => {
        mockAuth({ id: "user-123" });
        mockProfile({
            telegram_chat_id: 12345678,
            is_active: true,
            bot_linked_at: new Date().toISOString(),
            onboarding_step: 4,
        });
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.isLinked).toBe(true);
        expect(body.isActive).toBe(true);
        expect(body.linkHealth).toBe("healthy");
        expect(body.onboardingStep).toBe(4);
    });

    it("returns linked=false and linkHealth=unlinked when no telegram_chat_id", async () => {
        mockAuth({ id: "user-123" });
        mockProfile({
            telegram_chat_id: null,
            is_active: true,
            bot_linked_at: null,
            onboarding_step: 1,
        });
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.isLinked).toBe(false);
        expect(body.linkHealth).toBe("unlinked");
    });

    it("marks linkHealth=stale when linked >90 days ago", async () => {
        mockAuth({ id: "user-123" });
        const oldDate = new Date();
        oldDate.setDate(oldDate.getDate() - 100);
        mockProfile({
            telegram_chat_id: 99999,
            is_active: true,
            bot_linked_at: oldDate.toISOString(),
            onboarding_step: 4,
        });
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.linkHealth).toBe("stale");
    });

    it("returns 500 on unexpected error", async () => {
        vi.mocked(createClient).mockRejectedValue(new Error("DB crash"));
        const res = await GET();
        expect(res.status).toBe(500);
    });
});
