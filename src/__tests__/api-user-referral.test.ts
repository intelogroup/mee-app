import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
    createClient: vi.fn(),
}));
vi.mock("@/lib/supabase-admin", () => ({
    supabaseAdmin: {
        from: vi.fn(),
    },
}));

import { GET } from "@/app/api/user/referral/route";
import { createClient } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

function mockAuth(user: { id: string } | null) {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: async () => ({ data: { user } }) },
    } as any);
}

function mockProfileSelect(data: Record<string, unknown> | null, error: unknown = null) {
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data, error }),
            }),
        }),
    });
}

function mockProfileUpdate(error: unknown = null) {
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue({
        update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ error }),
            }),
        }),
    });
}

function mockChainForExistingCode(referralCode: string, count: number) {
    let callCount = 0;
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
            // First call: select referral_code
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: { referral_code: referralCode },
                            error: null,
                        }),
                    }),
                }),
            };
        }
        // Second call: count referrals
        return {
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count, error: null }),
            }),
        };
    });
}

function mockChainForNewCode(count: number) {
    let callCount = 0;
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
            // select returns null code
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: { referral_code: null }, error: null }),
                    }),
                }),
            };
        }
        if (callCount === 2) {
            // update to set code
            return {
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        is: vi.fn().mockResolvedValue({ error: null }),
                    }),
                }),
            };
        }
        // Third: count
        return {
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count, error: null }),
            }),
        };
    });
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/user/referral", () => {
    it("returns 401 when unauthenticated", async () => {
        mockAuth(null);
        const res = await GET();
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe("Unauthorized");
    });

    it("returns existing referral code and count", async () => {
        mockAuth({ id: "user-123" });
        mockChainForExistingCode("ABCD1234WXYZ", 3);

        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.referral_code).toBe("ABCD1234WXYZ");
        expect(body.referral_count).toBe(3);
    });

    it("generates a new code when profile has none", async () => {
        mockAuth({ id: "user-456" });
        mockChainForNewCode(0);

        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(typeof body.referral_code).toBe("string");
        expect(body.referral_code.length).toBeGreaterThan(4);
        expect(body.referral_count).toBe(0);
    });

    it("returns 500 when profile fetch fails", async () => {
        mockAuth({ id: "user-789" });
        mockProfileSelect(null, { message: "DB error" });

        const res = await GET();
        expect(res.status).toBe(500);
    });
});
