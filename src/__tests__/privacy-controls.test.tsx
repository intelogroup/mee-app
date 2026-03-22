import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PrivacyControls from "@/components/PrivacyControls";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockPrivacyResponse(data?: Partial<{
    data_collection_enabled: boolean;
    nudge_enabled: boolean;
    account_created: string;
    stored_data: {
        trait_count: number;
        pattern_count: number;
        conversation_count: number;
    };
}>) {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
            data_collection_enabled: true,
            nudge_enabled: true,
            account_created: "2024-01-15T00:00:00Z",
            stored_data: {
                trait_count: 5,
                pattern_count: 3,
                conversation_count: 12,
            },
            ...data,
        }),
    });
}

describe("PrivacyControls", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("renders loading state initially", () => {
        mockFetch.mockReturnValueOnce(new Promise(() => {}));
        const { container } = render(<PrivacyControls />);
        const spinner = container.querySelector(".animate-spin");
        expect(spinner).toBeTruthy();
    });

    it("renders stored data summary", async () => {
        mockPrivacyResponse();
        render(<PrivacyControls />);
        await waitFor(() => {
            expect(screen.getByText("Your Stored Data")).toBeTruthy();
            expect(screen.getByText("12")).toBeTruthy(); // conversation count
            expect(screen.getByText("5")).toBeTruthy(); // trait count
            expect(screen.getByText("3")).toBeTruthy(); // pattern count
        });
    });

    it("renders data collection toggles", async () => {
        mockPrivacyResponse();
        render(<PrivacyControls />);
        await waitFor(() => {
            expect(screen.getByText("Learning from conversations")).toBeTruthy();
            expect(screen.getByText("Re-engagement nudges")).toBeTruthy();
        });
    });

    it("toggles data collection off", async () => {
        const user = userEvent.setup();
        mockPrivacyResponse({ data_collection_enabled: true });
        render(<PrivacyControls />);

        await waitFor(() => {
            expect(screen.getByLabelText("Toggle data collection")).toBeTruthy();
        });

        const toggle = screen.getByLabelText("Toggle data collection");
        expect(toggle.getAttribute("aria-checked")).toBe("true");

        await user.click(toggle);
        expect(toggle.getAttribute("aria-checked")).toBe("false");
    });

    it("toggles nudge off", async () => {
        const user = userEvent.setup();
        mockPrivacyResponse({ nudge_enabled: true });
        render(<PrivacyControls />);

        await waitFor(() => {
            expect(screen.getByLabelText("Toggle nudge notifications")).toBeTruthy();
        });

        const toggle = screen.getByLabelText("Toggle nudge notifications");
        expect(toggle.getAttribute("aria-checked")).toBe("true");

        await user.click(toggle);
        expect(toggle.getAttribute("aria-checked")).toBe("false");
    });

    it("saves preferences on button click", async () => {
        const user = userEvent.setup();
        mockPrivacyResponse();
        render(<PrivacyControls />);

        await waitFor(() => {
            expect(screen.getByText("Save Preferences")).toBeTruthy();
        });

        mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
        await user.click(screen.getByText("Save Preferences"));

        await waitFor(() => {
            const putCall = mockFetch.mock.calls.find(
                (c: [string, RequestInit?]) => c[1]?.method === "PUT"
            );
            expect(putCall).toBeTruthy();
        });
    });

    it("shows saved confirmation", async () => {
        const user = userEvent.setup();
        mockPrivacyResponse();
        render(<PrivacyControls />);

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
        mockPrivacyResponse();
        render(<PrivacyControls />);

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

    it("shows reset confirmation dialog", async () => {
        const user = userEvent.setup();
        mockPrivacyResponse();
        render(<PrivacyControls />);

        await waitFor(() => {
            expect(screen.getByText("Reset All Data")).toBeTruthy();
        });

        await user.click(screen.getByText("Reset All Data"));
        expect(screen.getByText("Are you sure?")).toBeTruthy();
        expect(screen.getByText("Yes, Delete Everything")).toBeTruthy();
        expect(screen.getByText("Cancel")).toBeTruthy();
    });

    it("cancels reset when Cancel is clicked", async () => {
        const user = userEvent.setup();
        mockPrivacyResponse();
        render(<PrivacyControls />);

        await waitFor(() => {
            expect(screen.getByText("Reset All Data")).toBeTruthy();
        });

        await user.click(screen.getByText("Reset All Data"));
        await user.click(screen.getByText("Cancel"));

        // Should be back to idle state
        expect(screen.getByText("Reset All Data")).toBeTruthy();
        expect(screen.queryByText("Are you sure?")).toBeNull();
    });

    it("resets memory on confirmation", async () => {
        const user = userEvent.setup();
        mockPrivacyResponse();
        render(<PrivacyControls />);

        await waitFor(() => {
            expect(screen.getByText("Reset All Data")).toBeTruthy();
        });

        await user.click(screen.getByText("Reset All Data"));

        mockFetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ ok: true, message: "All AI memory has been cleared" }),
        });

        await user.click(screen.getByText("Yes, Delete Everything"));

        await waitFor(() => {
            expect(
                screen.getByText("All AI memory has been cleared successfully.")
            ).toBeTruthy();
        });
    });

    it("shows error on reset failure", async () => {
        const user = userEvent.setup();
        mockPrivacyResponse();
        render(<PrivacyControls />);

        await waitFor(() => {
            expect(screen.getByText("Reset All Data")).toBeTruthy();
        });

        await user.click(screen.getByText("Reset All Data"));

        mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 207,
            json: async () => ({
                partial: true,
                errors: ["Failed to clear brain data"],
            }),
        });

        await user.click(screen.getByText("Yes, Delete Everything"));

        await waitFor(() => {
            expect(screen.getByText(/Failed to clear brain data/)).toBeTruthy();
        });
    });

    it("renders with defaults when fetch fails", async () => {
        mockFetch.mockRejectedValueOnce(new Error("fail"));
        render(<PrivacyControls />);
        await waitFor(() => {
            expect(screen.getByText("Your Stored Data")).toBeTruthy();
        });
    });

    it("shows account creation date", async () => {
        mockPrivacyResponse({ account_created: "2024-01-15T00:00:00Z" });
        render(<PrivacyControls />);
        await waitFor(() => {
            expect(screen.getByText(/Account created:/)).toBeTruthy();
        });
    });
});
