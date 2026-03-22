import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useBotStatus } from "@/hooks/useBotStatus";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockSuccessResponse(data: Record<string, unknown>) {
    mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => data,
    });
}

function mockErrorResponse(status: number, body: Record<string, unknown>) {
    mockFetch.mockResolvedValueOnce({
        ok: false,
        status,
        json: async () => body,
    });
}

describe("useBotStatus", () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("fetches bot status on mount", async () => {
        mockSuccessResponse({
            isLinked: true,
            isActive: true,
            linkHealth: "healthy",
            onboardingStep: 4,
            botLinkedAt: "2026-01-01T00:00:00Z",
        });

        const { result } = renderHook(() =>
            useBotStatus({ pollInterval: 0, enabled: true })
        );

        await waitFor(() => {
            expect(result.current.status).not.toBeNull();
        });

        expect(result.current.status?.isLinked).toBe(true);
        expect(result.current.status?.linkHealth).toBe("healthy");
        expect(result.current.error).toBeNull();
        expect(result.current.failureCount).toBe(0);
    });

    it("sets error on 401 unauthorized", async () => {
        mockErrorResponse(401, {
            error: "unauthorized",
            message: "Session expired. Please log in again.",
        });

        const { result } = renderHook(() =>
            useBotStatus({ pollInterval: 0 })
        );

        await waitFor(() => {
            expect(result.current.error).not.toBeNull();
        });

        expect(result.current.error?.code).toBe("unauthorized");
        expect(result.current.failureCount).toBe(1);
        expect(result.current.status).toBeNull();
    });

    it("sets error on network failure", async () => {
        mockFetch.mockRejectedValueOnce(new Error("Failed to fetch"));

        const { result } = renderHook(() =>
            useBotStatus({ pollInterval: 0 })
        );

        await waitFor(() => {
            expect(result.current.error).not.toBeNull();
        });

        expect(result.current.error?.code).toBe("network_error");
        expect(result.current.error?.message).toBe("Failed to fetch");
        expect(result.current.failureCount).toBe(1);
    });

    it("clears error on successful retry", async () => {
        // First call fails
        mockErrorResponse(500, { error: "server_error", message: "Internal error" });

        const { result } = renderHook(() =>
            useBotStatus({ pollInterval: 0 })
        );

        await waitFor(() => {
            expect(result.current.error?.code).toBe("server_error");
        });

        // Manual refresh succeeds
        mockSuccessResponse({
            isLinked: true,
            isActive: true,
            linkHealth: "healthy",
            onboardingStep: 4,
            botLinkedAt: null,
        });

        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.error).toBeNull();
        expect(result.current.failureCount).toBe(0);
        expect(result.current.status?.isLinked).toBe(true);
    });

    it("clearError resets error and failure count", async () => {
        mockErrorResponse(500, { error: "server_error", message: "Fail" });

        const { result } = renderHook(() =>
            useBotStatus({ pollInterval: 0 })
        );

        await waitFor(() => {
            expect(result.current.failureCount).toBe(1);
        });

        act(() => {
            result.current.clearError();
        });

        expect(result.current.error).toBeNull();
        expect(result.current.failureCount).toBe(0);
    });

    it("does not fetch when disabled", async () => {
        renderHook(() => useBotStatus({ enabled: false }));

        // Small wait to let any potential effect fire
        await new Promise((r) => setTimeout(r, 50));

        expect(mockFetch).not.toHaveBeenCalled();
    });

    it("calls /api/bot/status with correct options", async () => {
        mockSuccessResponse({ isLinked: false, isActive: true, linkHealth: "unlinked", onboardingStep: 0, botLinkedAt: null });

        renderHook(() => useBotStatus({ pollInterval: 0 }));

        await waitFor(() => {
            expect(mockFetch).toHaveBeenCalledWith("/api/bot/status", {
                credentials: "same-origin",
                headers: { "Cache-Control": "no-cache" },
            });
        });
    });

    it("detects stale link health", async () => {
        mockSuccessResponse({
            isLinked: true,
            isActive: true,
            linkHealth: "stale",
            onboardingStep: 4,
            botLinkedAt: "2025-06-01T00:00:00Z",
        });

        const { result } = renderHook(() =>
            useBotStatus({ pollInterval: 0 })
        );

        await waitFor(() => {
            expect(result.current.status?.linkHealth).toBe("stale");
        });

        expect(result.current.error).toBeNull();
    });
});
