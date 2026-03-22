import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CoachingGoals from "@/components/CoachingGoals";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockGoalsResponse(goals: Array<{ id: string; title: string; status: string; created_at: string; updated_at: string }>) {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ goals }),
    });
}

describe("CoachingGoals", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("renders loading state initially", () => {
        mockFetch.mockReturnValueOnce(new Promise(() => {})); // never resolves
        render(<CoachingGoals />);
        // Loading skeleton should be visible (animate-pulse class)
        const container = document.querySelector(".animate-pulse");
        expect(container).toBeTruthy();
    });

    it("renders empty state when no goals exist", async () => {
        mockGoalsResponse([]);
        render(<CoachingGoals />);
        await waitFor(() => {
            expect(screen.getByText(/No goals set yet/)).toBeTruthy();
        });
    });

    it("displays active goals", async () => {
        mockGoalsResponse([
            { id: "1", title: "Be more confident", status: "active", created_at: "2026-03-01", updated_at: "2026-03-01" },
            { id: "2", title: "Better small talk", status: "active", created_at: "2026-03-02", updated_at: "2026-03-02" },
        ]);
        render(<CoachingGoals />);
        await waitFor(() => {
            expect(screen.getByText("Be more confident")).toBeTruthy();
            expect(screen.getByText("Better small talk")).toBeTruthy();
        });
    });

    it("shows 2/3 Active counter", async () => {
        mockGoalsResponse([
            { id: "1", title: "Goal A", status: "active", created_at: "2026-03-01", updated_at: "2026-03-01" },
            { id: "2", title: "Goal B", status: "active", created_at: "2026-03-02", updated_at: "2026-03-02" },
        ]);
        render(<CoachingGoals />);
        await waitFor(() => {
            expect(screen.getByText("2/3 Active")).toBeTruthy();
        });
    });

    it("hides add form when 3 active goals exist", async () => {
        mockGoalsResponse([
            { id: "1", title: "Goal A", status: "active", created_at: "2026-03-01", updated_at: "2026-03-01" },
            { id: "2", title: "Goal B", status: "active", created_at: "2026-03-02", updated_at: "2026-03-02" },
            { id: "3", title: "Goal C", status: "active", created_at: "2026-03-03", updated_at: "2026-03-03" },
        ]);
        render(<CoachingGoals />);
        await waitFor(() => {
            expect(screen.getByText("3/3 Active")).toBeTruthy();
        });
        // The input should not be present
        const input = document.querySelector('input[placeholder*="confident"]');
        expect(input).toBeNull();
    });

    it("shows completed goals section", async () => {
        mockGoalsResponse([
            { id: "1", title: "Old Goal", status: "completed", created_at: "2026-03-01", updated_at: "2026-03-01" },
        ]);
        render(<CoachingGoals />);
        await waitFor(() => {
            expect(screen.getByText("Completed")).toBeTruthy();
            expect(screen.getByText("Old Goal")).toBeTruthy();
        });
    });

    it("calls POST when adding a goal", async () => {
        const user = userEvent.setup();
        mockGoalsResponse([]); // initial load
        render(<CoachingGoals />);

        await waitFor(() => {
            expect(screen.getByText(/No goals set yet/)).toBeTruthy();
        });

        // Mock the POST response and the subsequent refetch
        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ status: "created", goal: { id: "new-1", title: "Test Goal" } }),
        });
        mockGoalsResponse([
            { id: "new-1", title: "Test Goal", status: "active", created_at: "2026-03-22", updated_at: "2026-03-22" },
        ]);

        const input = screen.getByPlaceholderText(/confident/);
        await user.type(input, "Test Goal");
        await user.click(screen.getByText("Add"));

        await waitFor(() => {
            // POST should have been called
            const postCall = mockFetch.mock.calls.find(
                (c: [string, RequestInit?]) => c[1]?.method === "POST"
            );
            expect(postCall).toBeTruthy();
        });
    });

    it("shows error on fetch failure", async () => {
        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: "Server error" }),
        });
        render(<CoachingGoals />);
        await waitFor(() => {
            expect(screen.getByText(/Could not load goals/)).toBeTruthy();
        });
    });
});
