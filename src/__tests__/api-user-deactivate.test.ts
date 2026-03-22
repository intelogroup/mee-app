import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
    createClient: vi.fn(),
}));
vi.mock("@/lib/supabase-admin", () => ({
    supabaseAdmin: {
        from: vi.fn(),
    },
}));

import { POST } from "@/app/api/user/deactivate/route";
import { createClient } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { NextRequest } from "next/server";

function makeRequest() {
    return new NextRequest("http://localhost/api/user/deactivate", { method: "POST" });
}

function mockAuth(user: { id: string } | null) {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: async () => ({ data: { user } }) },
    } as any);
}

function mockProfileUpsert(error: unknown = null) {
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error }),
    });
}

describe("POST /api/user/deactivate", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const res = await POST(makeRequest());
        expect(res.status).toBe(401);
        const body = await res.json();
        expect(body.error).toBe("Unauthorized.");
    });

    it("returns 200 on successful deactivation", async () => {
        mockAuth({ id: "user-123" });
        mockProfileUpsert(null);
        const res = await POST(makeRequest());
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
    });

    it("returns 500 when upsert fails", async () => {
        mockAuth({ id: "user-123" });
        mockProfileUpsert({ message: "DB error" });
        const res = await POST(makeRequest());
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toContain("deactivate");
    });

    it("calls upsert with is_active=false for the correct user", async () => {
        mockAuth({ id: "user-xyz" });
        const upsertMock = vi.fn().mockResolvedValue({ error: null });
        (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue({ upsert: upsertMock });

        await POST(makeRequest());

        expect(upsertMock).toHaveBeenCalledWith(
            expect.objectContaining({ id: "user-xyz", is_active: false }),
            expect.objectContaining({ onConflict: "id" })
        );
    });
});
