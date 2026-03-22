import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase-admin before importing onboarding
vi.mock("@/lib/supabase-admin", () => ({
    supabaseAdmin: {
        from: vi.fn(),
    },
}));

import { getOnboardingStatus, ONBOARDING_REQUIRED_STEP } from "@/lib/onboarding";
import { supabaseAdmin } from "@/lib/supabase-admin";

const mockFrom = supabaseAdmin.from as ReturnType<typeof vi.fn>;

function mockProfileQuery(data: Record<string, unknown> | null, error: unknown = null) {
    mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data, error }),
            }),
        }),
    });
}

describe("getOnboardingStatus", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = "TestBot";
    });

    it("returns complete when step >= required", async () => {
        mockProfileQuery({ telegram_chat_id: 12345, onboarding_step: 4 });

        const status = await getOnboardingStatus("user-123");

        expect(status.isComplete).toBe(true);
        expect(status.currentStep).toBe(4);
        expect(status.isLinked).toBe(true);
        expect(status.deepLink).toContain("TestBot");
        expect(status.deepLink).toContain("user-123");
    });

    it("returns incomplete when step < required", async () => {
        mockProfileQuery({ telegram_chat_id: null, onboarding_step: 1 });

        const status = await getOnboardingStatus("user-456");

        expect(status.isComplete).toBe(false);
        expect(status.currentStep).toBe(1);
        expect(status.isLinked).toBe(false);
    });

    it("returns step 0 when profile has no onboarding_step", async () => {
        mockProfileQuery({ telegram_chat_id: null, onboarding_step: null });

        const status = await getOnboardingStatus("user-789");

        expect(status.isComplete).toBe(false);
        expect(status.currentStep).toBe(0);
    });

    it("returns step 0 when profile not found", async () => {
        mockProfileQuery(null);

        const status = await getOnboardingStatus("user-missing");

        expect(status.isComplete).toBe(false);
        expect(status.currentStep).toBe(0);
        expect(status.isLinked).toBe(false);
    });

    it("ONBOARDING_REQUIRED_STEP is 4", () => {
        expect(ONBOARDING_REQUIRED_STEP).toBe(4);
    });

    it("generates correct deep link format", async () => {
        mockProfileQuery({ telegram_chat_id: null, onboarding_step: 0 });

        const status = await getOnboardingStatus("abc-def");

        expect(status.deepLink).toBe("https://t.me/TestBot?start=abc-def");
    });
});
