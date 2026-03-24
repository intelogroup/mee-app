import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase", () => ({
    createClient: vi.fn(),
}));
vi.mock("@/lib/supabase-admin", () => ({
    supabaseAdmin: {
        from: vi.fn(),
    },
}));

import { GET, POST, inferTags } from "@/app/api/bot/conversations/tags/route";
import { createClient } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";

function mockAuth(user: { id: string } | null) {
    vi.mocked(createClient).mockResolvedValue({
        auth: { getUser: async () => ({ data: { user } }) },
    } as any);
}

function mockTagsSelect(data: any[] | null, error: any = null) {
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValue({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data, error }),
        }),
    });
}

function mockTagsDelete(mockInsert?: ReturnType<typeof vi.fn>) {
    const deleteChain = {
        eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
        }),
    };
    (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
        delete: vi.fn().mockReturnValue(deleteChain),
    });
    if (mockInsert) {
        (supabaseAdmin.from as ReturnType<typeof vi.fn>).mockReturnValueOnce({
            insert: mockInsert,
        });
    }
}

// -----------------------------------------------
// inferTags unit tests
// -----------------------------------------------
describe("inferTags()", () => {
    it("detects career keywords", () => {
        const tags = inferTags("I got a promotion at work today");
        expect(tags).toContain("career");
    });

    it("detects relationships keywords", () => {
        const tags = inferTags("my partner and I had an argument");
        expect(tags).toContain("relationships");
    });

    it("detects habits keywords", () => {
        const tags = inferTags("I want to build a morning exercise routine");
        expect(tags).toContain("habits");
    });

    it("detects emotions keywords", () => {
        const tags = inferTags("I feel anxious about everything lately");
        expect(tags).toContain("emotions");
    });

    it("detects goals keywords", () => {
        const tags = inferTags("I have a big goal I want to achieve this year");
        expect(tags).toContain("goals");
    });

    it("detects communication keywords", () => {
        const tags = inferTags("I need to be more assertive and communicate better");
        expect(tags).toContain("communication");
    });

    it("detects health keywords", () => {
        const tags = inferTags("I've been focused on mental health and fitness");
        expect(tags).toContain("health");
    });

    it("detects finance keywords", () => {
        const tags = inferTags("Trying to get my budget under control and save money");
        expect(tags).toContain("finance");
    });

    it("caps results at 3 tags", () => {
        const tags = inferTags(
            "my career job work fitness health wellness goal dream partner relationship money budget"
        );
        expect(tags.length).toBeLessThanOrEqual(3);
    });

    it("returns empty array for unrecognised text", () => {
        const tags = inferTags("The weather is nice today");
        expect(tags).toEqual([]);
    });

    it("is case-insensitive", () => {
        const tags = inferTags("CAREER JOB PROMOTION");
        expect(tags).toContain("career");
    });
});

// -----------------------------------------------
// GET /api/bot/conversations/tags
// -----------------------------------------------
describe("GET /api/bot/conversations/tags", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const res = await GET();
        expect(res.status).toBe(401);
    });

    it("returns unique sorted tags for user", async () => {
        mockAuth({ id: "user-1" });
        mockTagsSelect([
            { tag: "career" },
            { tag: "habits" },
            { tag: "career" }, // duplicate
            { tag: "emotions" },
        ]);
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tags).toEqual(["career", "emotions", "habits"]); // sorted, unique
    });

    it("returns empty tags when DB error occurs", async () => {
        mockAuth({ id: "user-1" });
        mockTagsSelect(null, { message: "Table does not exist" });
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tags).toEqual([]);
    });

    it("returns empty array when no tags exist", async () => {
        mockAuth({ id: "user-1" });
        mockTagsSelect([]);
        const res = await GET();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tags).toEqual([]);
    });
});

// -----------------------------------------------
// POST /api/bot/conversations/tags
// -----------------------------------------------
describe("POST /api/bot/conversations/tags", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        mockAuth(null);
        const req = new Request("http://localhost/api/bot/conversations/tags", {
            method: "POST",
            body: JSON.stringify({ session_key: "2026-01-01T00:00:00Z", text: "hello" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 when session_key is missing", async () => {
        mockAuth({ id: "user-1" });
        const req = new Request("http://localhost/api/bot/conversations/tags", {
            method: "POST",
            body: JSON.stringify({ text: "I want a promotion at work" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it("returns 400 when text is missing", async () => {
        mockAuth({ id: "user-1" });
        const req = new Request("http://localhost/api/bot/conversations/tags", {
            method: "POST",
            body: JSON.stringify({ session_key: "2026-01-01T00:00:00Z" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(400);
    });

    it("returns empty tags when no keywords match", async () => {
        mockAuth({ id: "user-1" });
        const req = new Request("http://localhost/api/bot/conversations/tags", {
            method: "POST",
            body: JSON.stringify({
                session_key: "2026-01-01T00:00:00Z",
                text: "The sky is blue today",
            }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tags).toEqual([]);
    });

    it("infers, saves, and returns tags", async () => {
        mockAuth({ id: "user-1" });
        const insertFn = vi.fn().mockResolvedValue({ error: null });
        mockTagsDelete(insertFn);

        const req = new Request("http://localhost/api/bot/conversations/tags", {
            method: "POST",
            body: JSON.stringify({
                session_key: "2026-03-01T10:00:00Z",
                text: "I got a promotion at work and I feel so anxious about it",
            }),
        });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.tags).toContain("career");
        expect(body.tags).toContain("emotions");
        expect(body.tags.length).toBeLessThanOrEqual(3);
    });

    it("returns 500 when insert fails", async () => {
        mockAuth({ id: "user-1" });
        const insertFn = vi.fn().mockResolvedValue({ error: { message: "DB error" } });
        mockTagsDelete(insertFn);

        const req = new Request("http://localhost/api/bot/conversations/tags", {
            method: "POST",
            body: JSON.stringify({
                session_key: "2026-03-01T10:00:00Z",
                text: "I feel anxious about my career job",
            }),
        });
        const res = await POST(req);
        expect(res.status).toBe(500);
    });
});
