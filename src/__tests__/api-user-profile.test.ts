import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
    createClient: vi.fn(),
}));
vi.mock("@/lib/supabase-admin", () => ({
    supabaseAdmin: {
        from: vi.fn(),
    },
}));

import { GET, PUT } from "@/app/api/user/profile/route";
import { createClient } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

function mockAuth(user: { id: string } | null) {
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

describe("GET /api/user/profile", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const res = await GET();
        expect(res.status).toBe(401);
    });

    it("returns profile data for authenticated user", async () => {
        mockAuth({ id: "user-1" });
        mockProfileSelect({
            communication_style: "direct",
            coaching_focus: ["confidence", "communication"],
            display_name: "Alex",
        });
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.communication_style).toBe("direct");
        expect(body.coaching_focus).toEqual(["confidence", "communication"]);
        expect(body.display_name).toBe("Alex");
    });

    it("returns defaults when profile row has an error", async () => {
        mockAuth({ id: "user-1" });
        mockProfileSelect(null, { message: "not found" });
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.communication_style).toBe("balanced");
        expect(body.coaching_focus).toEqual([]);
        expect(body.display_name).toBe("");
    });

    it("returns defaults when profile columns are null", async () => {
        mockAuth({ id: "user-1" });
        mockProfileSelect({
            communication_style: null,
            coaching_focus: null,
            display_name: null,
        });
        const res = await GET();
        const body = await res.json();
        expect(body.communication_style).toBe("balanced");
        expect(body.coaching_focus).toEqual([]);
        expect(body.display_name).toBe("");
    });
});

describe("PUT /api/user/profile", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const req = new Request("http://localhost/api/user/profile", {
            method: "PUT",
            body: JSON.stringify({ communication_style: "gentle" }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 for invalid communication_style", async () => {
        mockAuth({ id: "user-1" });
        const req = new Request("http://localhost/api/user/profile", {
            method: "PUT",
            body: JSON.stringify({ communication_style: "aggressive" }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(400);
    });

    it("updates profile successfully", async () => {
        mockAuth({ id: "user-1" });
        mockProfileUpdate(null);
        const req = new Request("http://localhost/api/user/profile", {
            method: "PUT",
            body: JSON.stringify({
                communication_style: "socratic",
                coaching_focus: ["empathy"],
                display_name: "Jordan",
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
        const req = new Request("http://localhost/api/user/profile", {
            method: "PUT",
            body: JSON.stringify({ communication_style: "gentle" }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(500);
    });

    it("updates only provided fields", async () => {
        mockAuth({ id: "user-1" });
        mockProfileUpdate(null);
        const req = new Request("http://localhost/api/user/profile", {
            method: "PUT",
            body: JSON.stringify({ display_name: "Sam" }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(200);
    });
});
