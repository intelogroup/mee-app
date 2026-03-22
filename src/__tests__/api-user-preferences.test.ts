import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
    createClient: vi.fn(),
}));
vi.mock("@/lib/supabase-admin", () => ({
    supabaseAdmin: {
        from: vi.fn(),
    },
}));

import { GET, PUT } from "@/app/api/user/preferences/route";
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

describe("GET /api/user/preferences", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const res = await GET();
        expect(res.status).toBe(401);
    });

    it("returns preferences for authenticated user", async () => {
        mockAuth({ id: "user-1" });
        mockProfileSelect({
            weekly_checkin_enabled: true,
            weekly_checkin_day: 2,
            weekly_checkin_hour: 10,
        });
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.weekly_checkin_enabled).toBe(true);
        expect(body.weekly_checkin_day).toBe(2);
        expect(body.weekly_checkin_hour).toBe(10);
    });

    it("returns defaults when profile row has an error", async () => {
        mockAuth({ id: "user-1" });
        mockProfileSelect(null, { message: "not found" });
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.weekly_checkin_enabled).toBe(false);
        expect(body.weekly_checkin_day).toBe(1);
        expect(body.weekly_checkin_hour).toBe(9);
    });

    it("returns defaults when columns are null", async () => {
        mockAuth({ id: "user-1" });
        mockProfileSelect({
            weekly_checkin_enabled: null,
            weekly_checkin_day: null,
            weekly_checkin_hour: null,
        });
        const res = await GET();
        const body = await res.json();
        expect(body.weekly_checkin_enabled).toBe(false);
        expect(body.weekly_checkin_day).toBe(1);
        expect(body.weekly_checkin_hour).toBe(9);
    });
});

describe("PUT /api/user/preferences", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const req = new Request("http://localhost/api/user/preferences", {
            method: "PUT",
            body: JSON.stringify({
                weekly_checkin_enabled: true,
                weekly_checkin_day: 1,
                weekly_checkin_hour: 9,
            }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 when weekly_checkin_enabled is not boolean", async () => {
        mockAuth({ id: "user-1" });
        const req = new Request("http://localhost/api/user/preferences", {
            method: "PUT",
            body: JSON.stringify({
                weekly_checkin_enabled: "yes",
                weekly_checkin_day: 1,
                weekly_checkin_hour: 9,
            }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(400);
    });

    it("returns 400 when weekly_checkin_day is out of range", async () => {
        mockAuth({ id: "user-1" });
        const req = new Request("http://localhost/api/user/preferences", {
            method: "PUT",
            body: JSON.stringify({
                weekly_checkin_enabled: true,
                weekly_checkin_day: 7,
                weekly_checkin_hour: 9,
            }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(400);
    });

    it("returns 400 when weekly_checkin_hour is out of range", async () => {
        mockAuth({ id: "user-1" });
        const req = new Request("http://localhost/api/user/preferences", {
            method: "PUT",
            body: JSON.stringify({
                weekly_checkin_enabled: false,
                weekly_checkin_day: 3,
                weekly_checkin_hour: 24,
            }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(400);
    });

    it("saves preferences successfully", async () => {
        mockAuth({ id: "user-1" });
        mockProfileUpdate(null);
        const req = new Request("http://localhost/api/user/preferences", {
            method: "PUT",
            body: JSON.stringify({
                weekly_checkin_enabled: true,
                weekly_checkin_day: 5,
                weekly_checkin_hour: 18,
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
        const req = new Request("http://localhost/api/user/preferences", {
            method: "PUT",
            body: JSON.stringify({
                weekly_checkin_enabled: false,
                weekly_checkin_day: 0,
                weekly_checkin_hour: 8,
            }),
        });
        const res = await PUT(req);
        expect(res.status).toBe(500);
    });
});
