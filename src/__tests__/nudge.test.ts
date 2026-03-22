import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    shouldSendNudge,
    pickNudgeTemplate,
    filterNudgeCandidates,
    NUDGE_TEMPLATES,
    INACTIVITY_THRESHOLD_DAYS,
    NudgeCandidate,
} from "@/lib/nudge";

describe("nudge utilities", () => {
    describe("INACTIVITY_THRESHOLD_DAYS", () => {
        it("is 7 days", () => {
            expect(INACTIVITY_THRESHOLD_DAYS).toBe(7);
        });
    });

    describe("NUDGE_TEMPLATES", () => {
        it("has at least 3 templates", () => {
            expect(NUDGE_TEMPLATES.length).toBeGreaterThanOrEqual(3);
        });

        it("all templates are non-empty strings", () => {
            for (const t of NUDGE_TEMPLATES) {
                expect(typeof t).toBe("string");
                expect(t.length).toBeGreaterThan(0);
            }
        });
    });

    describe("pickNudgeTemplate", () => {
        it("returns a string from NUDGE_TEMPLATES", () => {
            const template = pickNudgeTemplate();
            expect(NUDGE_TEMPLATES).toContain(template);
        });
    });

    describe("shouldSendNudge", () => {
        const now = new Date("2024-06-15T12:00:00Z");

        it("returns false when nudge is disabled", () => {
            const sevenDaysAgo = new Date("2024-06-01T12:00:00Z");
            expect(shouldSendNudge(sevenDaysAgo.toISOString(), false, now)).toBe(
                false
            );
        });

        it("returns true when last interaction is null", () => {
            expect(shouldSendNudge(null, true, now)).toBe(true);
        });

        it("returns true when user has been inactive for 7+ days", () => {
            const eightDaysAgo = new Date("2024-06-07T12:00:00Z");
            expect(shouldSendNudge(eightDaysAgo.toISOString(), true, now)).toBe(
                true
            );
        });

        it("returns true when exactly 7 days have passed", () => {
            const exactlySeven = new Date("2024-06-08T12:00:00Z");
            expect(shouldSendNudge(exactlySeven.toISOString(), true, now)).toBe(
                true
            );
        });

        it("returns false when user was active less than 7 days ago", () => {
            const threeDaysAgo = new Date("2024-06-12T12:00:00Z");
            expect(shouldSendNudge(threeDaysAgo.toISOString(), true, now)).toBe(
                false
            );
        });

        it("returns false for invalid date string", () => {
            expect(shouldSendNudge("not-a-date", true, now)).toBe(false);
        });

        it("accepts a Date object", () => {
            const eightDaysAgo = new Date("2024-06-07T12:00:00Z");
            expect(shouldSendNudge(eightDaysAgo, true, now)).toBe(true);
        });

        it("returns false when user was active yesterday", () => {
            const yesterday = new Date("2024-06-14T12:00:00Z");
            expect(shouldSendNudge(yesterday.toISOString(), true, now)).toBe(
                false
            );
        });
    });

    describe("filterNudgeCandidates", () => {
        const now = new Date("2024-06-15T12:00:00Z");

        it("returns empty array for no candidates", () => {
            expect(filterNudgeCandidates([], now)).toEqual([]);
        });

        it("filters out recently active users", () => {
            const candidates: NudgeCandidate[] = [
                {
                    user_id: "u1",
                    telegram_chat_id: "123",
                    last_interaction: "2024-06-14T12:00:00Z",
                },
                {
                    user_id: "u2",
                    telegram_chat_id: "456",
                    last_interaction: "2024-06-01T12:00:00Z",
                },
                {
                    user_id: "u3",
                    telegram_chat_id: "789",
                    last_interaction: null,
                },
            ];

            const result = filterNudgeCandidates(candidates, now);
            expect(result.length).toBe(2);
            expect(result.map((r) => r.user_id)).toEqual(["u2", "u3"]);
        });

        it("includes users with null last_interaction", () => {
            const candidates: NudgeCandidate[] = [
                {
                    user_id: "u1",
                    telegram_chat_id: "123",
                    last_interaction: null,
                },
            ];
            const result = filterNudgeCandidates(candidates, now);
            expect(result.length).toBe(1);
        });
    });
});
