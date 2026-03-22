"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type LinkHealth = "healthy" | "stale" | "unlinked";

export interface BotStatus {
    isLinked: boolean;
    isActive: boolean;
    linkHealth: LinkHealth;
    onboardingStep: number;
    botLinkedAt: string | null;
}

export interface BotStatusError {
    code: "unauthorized" | "profile_not_found" | "server_error" | "network_error";
    message: string;
}

export interface UseBotStatusReturn {
    /** Current bot status, null if not yet loaded */
    status: BotStatus | null;
    /** Error state, null if no error */
    error: BotStatusError | null;
    /** Whether the hook is currently fetching */
    isLoading: boolean;
    /** Number of consecutive fetch failures */
    failureCount: number;
    /** Manually trigger a refresh */
    refresh: () => Promise<void>;
    /** Clear the current error state */
    clearError: () => void;
}

interface UseBotStatusOptions {
    /** Poll interval in ms. Set to 0 to disable polling. Default: 30000 (30s) */
    pollInterval?: number;
    /** Max consecutive failures before stopping auto-poll. Default: 3 */
    maxRetries?: number;
    /** Whether to start polling immediately. Default: true */
    enabled?: boolean;
}

/**
 * Client-side hook for monitoring Telegram bot connection status.
 *
 * Provides:
 * - Automatic polling with configurable interval
 * - Error state management with typed error codes
 * - Auto-stop after max consecutive failures
 * - Manual refresh and error clearing
 *
 * Usage:
 *   const { status, error, isLoading, refresh } = useBotStatus();
 *
 *   if (error?.code === "unauthorized") {
 *       // Session expired — redirect to login
 *   }
 *   if (status?.linkHealth === "stale") {
 *       // Show re-link prompt
 *   }
 */
export function useBotStatus(options: UseBotStatusOptions = {}): UseBotStatusReturn {
    const {
        pollInterval = 30_000,
        maxRetries = 3,
        enabled = true,
    } = options;

    const [status, setStatus] = useState<BotStatus | null>(null);
    const [error, setError] = useState<BotStatusError | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [failureCount, setFailureCount] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const mountedRef = useRef(true);

    const fetchStatus = useCallback(async () => {
        if (!mountedRef.current) return;
        setIsLoading(true);

        try {
            const res = await fetch("/api/bot/status", {
                credentials: "same-origin",
                headers: { "Cache-Control": "no-cache" },
            });

            if (!mountedRef.current) return;

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                const code = body.error || "server_error";
                const message = body.message || `Request failed with status ${res.status}`;

                setError({ code, message });
                setFailureCount((c) => c + 1);
                setIsLoading(false);
                return;
            }

            const data: BotStatus = await res.json();
            setStatus(data);
            setError(null);
            setFailureCount(0);
        } catch (err) {
            if (!mountedRef.current) return;
            setError({
                code: "network_error",
                message: err instanceof Error ? err.message : "Network request failed",
            });
            setFailureCount((c) => c + 1);
        } finally {
            if (mountedRef.current) {
                setIsLoading(false);
            }
        }
    }, []);

    const clearError = useCallback(() => {
        setError(null);
        setFailureCount(0);
    }, []);

    // Initial fetch + polling
    useEffect(() => {
        mountedRef.current = true;

        if (!enabled) return;

        // Initial fetch
        fetchStatus();

        // Set up polling if interval > 0 and we haven't exceeded max retries
        if (pollInterval > 0) {
            intervalRef.current = setInterval(() => {
                // Stop polling after too many consecutive failures
                setFailureCount((currentCount) => {
                    if (currentCount >= maxRetries) {
                        if (intervalRef.current) {
                            clearInterval(intervalRef.current);
                            intervalRef.current = null;
                        }
                        return currentCount;
                    }
                    fetchStatus();
                    return currentCount;
                });
            }, pollInterval);
        }

        return () => {
            mountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [enabled, pollInterval, maxRetries, fetchStatus]);

    return {
        status,
        error,
        isLoading,
        failureCount,
        refresh: fetchStatus,
        clearError,
    };
}
