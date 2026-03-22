"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase-browser";

type ConnectionState =
    | "waiting"       // Not linked yet, waiting for user to open Telegram
    | "connected"     // Just linked successfully
    | "error"         // Connection or subscription error
    | "token_expired" // Auth session expired
    | "idle";         // Already linked on load, nothing to show

interface BotStatusProps {
    userId: string;
    initialLinked: boolean;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;
const HEALTH_CHECK_INTERVAL_MS = 30000; // Check every 30s while waiting

export default function BotStatusWatcher({ userId, initialLinked }: BotStatusProps) {
    const [state, setState] = useState<ConnectionState>(initialLinked ? "idle" : "waiting");
    const [errorMessage, setErrorMessage] = useState<string>("");
    const [retryCount, setRetryCount] = useState(0);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const healthCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const cleanup = useCallback(() => {
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
            retryTimeoutRef.current = null;
        }
        if (healthCheckRef.current) {
            clearInterval(healthCheckRef.current);
            healthCheckRef.current = null;
        }
    }, []);

    // Check bot status via API (also catches token expiry)
    const checkBotStatus = useCallback(async (): Promise<boolean> => {
        try {
            const res = await fetch("/api/bot/status");

            if (res.status === 401) {
                setState("token_expired");
                setErrorMessage("Your session has expired. Please log in again.");
                cleanup();
                return false;
            }

            if (!res.ok) {
                throw new Error(`Status check failed (${res.status})`);
            }

            const data = await res.json();

            if (data.isLinked) {
                setState("connected");
                cleanup();
                setTimeout(() => window.location.reload(), 2000);
                return true;
            }

            return false;
        } catch (err) {
            // Network error during health check — don't immediately show error,
            // the realtime subscription may still work
            console.warn("Bot status health check failed:", err);
            return false;
        }
    }, [cleanup]);

    // Retry the realtime subscription
    const retryConnection = useCallback(() => {
        if (retryCount >= MAX_RETRIES) {
            setState("error");
            setErrorMessage(
                "Unable to detect your Telegram connection. Please refresh the page or try again later."
            );
            return;
        }

        setRetryCount((prev) => prev + 1);
        setState("waiting");
        setErrorMessage("");

        // Will trigger the effect to re-subscribe
    }, [retryCount]);

    // Manual retry handler
    const handleRetry = useCallback(() => {
        setRetryCount(0);
        setState("waiting");
        setErrorMessage("");
        checkBotStatus();
    }, [checkBotStatus]);

    useEffect(() => {
        if (initialLinked || state === "idle" || state === "connected" || state === "token_expired") {
            return;
        }

        const supabase = createClient();

        const channel = supabase
            .channel(`profile:${userId}:${retryCount}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "profiles",
                    filter: `id=eq.${userId}`,
                },
                (payload) => {
                    const newRecord = payload.new as { telegram_chat_id: number | null };
                    if (newRecord.telegram_chat_id) {
                        setState("connected");
                        cleanup();
                        setTimeout(() => window.location.reload(), 2000);
                    }
                }
            )
            .subscribe((status) => {
                if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
                    console.error("Realtime subscription error:", status);

                    if (retryCount < MAX_RETRIES) {
                        retryTimeoutRef.current = setTimeout(() => {
                            retryConnection();
                        }, RETRY_DELAY_MS * (retryCount + 1));
                    } else {
                        setState("error");
                        setErrorMessage(
                            "Lost connection to the server. Your Telegram link may still work — please refresh to check."
                        );
                    }
                }
            });

        // Periodic health check via API as fallback
        healthCheckRef.current = setInterval(() => {
            checkBotStatus();
        }, HEALTH_CHECK_INTERVAL_MS);

        // Also do an immediate check
        checkBotStatus();

        return () => {
            supabase.removeChannel(channel);
            cleanup();
        };
    }, [userId, initialLinked, state, retryCount, retryConnection, checkBotStatus, cleanup]);

    // --- Render states ---

    if (state === "idle") return null;

    if (state === "connected") {
        return (
            <div className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Bot linked! Refreshing your dashboard...</span>
            </div>
        );
    }

    if (state === "token_expired") {
        return (
            <div className="flex items-center gap-3 p-4 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m9.364-7.364A9 9 0 115.636 5.636a9 9 0 0113.728 0z" />
                </svg>
                <div className="flex-1">
                    <p className="font-semibold">Session Expired</p>
                    <p className="text-xs text-red-400/80 mt-0.5">{errorMessage}</p>
                </div>
                <a
                    href="/login"
                    className="shrink-0 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-lg transition-colors border border-red-500/20"
                >
                    Log in
                </a>
            </div>
        );
    }

    if (state === "error") {
        return (
            <div className="flex items-center gap-3 p-4 mb-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                    <p className="font-semibold">Connection Issue</p>
                    <p className="text-xs text-red-400/80 mt-0.5">{errorMessage}</p>
                </div>
                <button
                    onClick={handleRetry}
                    className="shrink-0 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-xs font-bold rounded-lg transition-colors border border-red-500/20"
                >
                    Retry
                </button>
            </div>
        );
    }

    // state === "waiting"
    return (
        <div className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm">
            <svg className="w-5 h-5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>Waiting for you to open the bot in Telegram...</span>
            {retryCount > 0 && (
                <span className="text-xs text-yellow-500/60 ml-auto">
                    Attempt {retryCount + 1}/{MAX_RETRIES + 1}
                </span>
            )}
            <span className="ml-auto inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
        </div>
    );
}
