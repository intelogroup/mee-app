import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import NotificationPreferences from "@/components/NotificationPreferences";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockPrefsResponse(prefs: {
    weekly_checkin_enabled?: boolean;
    weekly_checkin_day?: number;
    weekly_checkin_hour?: number;
}) {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            weekly_checkin_enabled: prefs.weekly_checkin_enabled ?? false,
            weekly_checkin_day: prefs.weekly_checkin_day ?? 1,
            weekly_checkin_hour: prefs.weekly_checkin_hour ?? 9,
        }),
    });
}

describe("NotificationPreferences", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("renders loading state initially", () => {
        mockFetch.mockReturnValueOnce(new Promise(() => {})); // never resolves
        const { container } = render(<NotificationPreferences />);
        const spinner = container.querySelector(".animate-spin");
        expect(spinner).toBeTruthy();
    });

    it("renders with defaults when fetch fails", async () => {
        mockFetch.mockRejectedValueOnce(new Error("fail"));
        render(<NotificationPreferences />);
        await waitFor(() => {
            expect(screen.getByText("Weekly Check-in Reminder")).toBeTruthy();
        });
    });

    it("renders toggle in off state by default", async () => {
        mockPrefsResponse({ weekly_checkin_enabled: false });
        render(<NotificationPreferences />);
        await waitFor(() => {
            const toggle = screen.getByRole("switch");
            expect(toggle.getAttribute("aria-checked")).toBe("false");
        });
    });

    it("renders toggle in on state when enabled", async () => {
        mockPrefsResponse({ weekly_checkin_enabled: true });
        render(<NotificationPreferences />);
        await waitFor(() => {
            const toggle = screen.getByRole("switch");
            expect(toggle.getAttribute("aria-checked")).toBe("true");
        });
    });

    it("shows schedule options when enabled", async () => {
        mockPrefsResponse({ weekly_checkin_enabled: true, weekly_checkin_day: 3, weekly_checkin_hour: 14 });
        render(<NotificationPreferences />);
        await waitFor(() => {
            expect(screen.getByText("Preferred day")).toBeTruthy();
            expect(screen.getByText("Preferred time")).toBeTruthy();
        });
    });

    it("hides schedule options when disabled", async () => {
        mockPrefsResponse({ weekly_checkin_enabled: false });
        render(<NotificationPreferences />);
        await waitFor(() => {
            expect(screen.getByText("Weekly Check-in Reminder")).toBeTruthy();
        });
        expect(screen.queryByText("Preferred day")).toBeNull();
    });

    it("toggles enabled state on click", async () => {
        const user = userEvent.setup();
        mockPrefsResponse({ weekly_checkin_enabled: false });
        render(<NotificationPreferences />);

        await waitFor(() => {
            expect(screen.getByRole("switch")).toBeTruthy();
        });

        await user.click(screen.getByRole("switch"));
        // After toggling, schedule options should appear
        expect(screen.getByText("Preferred day")).toBeTruthy();
    });

    it("saves preferences on button click", async () => {
        const user = userEvent.setup();
        mockPrefsResponse({ weekly_checkin_enabled: true });
        render(<NotificationPreferences />);

        await waitFor(() => {
            expect(screen.getByText("Save Preferences")).toBeTruthy();
        });

        // Mock the PUT response
        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

        await user.click(screen.getByText("Save Preferences"));

        await waitFor(() => {
            const putCall = mockFetch.mock.calls.find(
                (c: [string, RequestInit?]) => c[1]?.method === "PUT"
            );
            expect(putCall).toBeTruthy();
        });
    });

    it("shows saved confirmation after successful save", async () => {
        const user = userEvent.setup();
        mockPrefsResponse({ weekly_checkin_enabled: true });
        render(<NotificationPreferences />);

        await waitFor(() => {
            expect(screen.getByText("Save Preferences")).toBeTruthy();
        });

        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });

        await user.click(screen.getByText("Save Preferences"));
        await waitFor(() => {
            expect(screen.getByText("Preferences saved")).toBeTruthy();
        });
    });

    it("shows error on save failure", async () => {
        const user = userEvent.setup();
        mockPrefsResponse({ weekly_checkin_enabled: true });
        render(<NotificationPreferences />);

        await waitFor(() => {
            expect(screen.getByText("Save Preferences")).toBeTruthy();
        });

        mockFetch.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: "Server error" }),
        });

        await user.click(screen.getByText("Save Preferences"));
        await waitFor(() => {
            expect(screen.getByText("Server error")).toBeTruthy();
        });
    });

    it("shows next reminder preview when enabled", async () => {
        mockPrefsResponse({ weekly_checkin_enabled: true, weekly_checkin_day: 1, weekly_checkin_hour: 9 });
        render(<NotificationPreferences />);
        await waitFor(() => {
            expect(screen.getByText("Next reminder")).toBeTruthy();
        });
    });

    it("shows re-engagement nudge info", async () => {
        mockPrefsResponse({ weekly_checkin_enabled: false });
        render(<NotificationPreferences />);
        await waitFor(() => {
            expect(screen.getByText("Re-engagement Nudge")).toBeTruthy();
            expect(screen.getByText("Always On")).toBeTruthy();
        });
    });

    it("shows timezone info when enabled", async () => {
        mockPrefsResponse({ weekly_checkin_enabled: true });
        render(<NotificationPreferences />);
        await waitFor(() => {
            const tz = screen.getByText(/Timezone:/);
            expect(tz).toBeTruthy();
        });
    });
});
