"use client";

import { useBotStatus } from "@/hooks/useBotStatus";

/**
 * Displays connection error alerts when the Telegram bot link fails or token expires.
 * Renders nothing when connection is healthy.
 *
 * Drop this into any dashboard page to show bot connection errors:
 *   <BotConnectionAlert />
 */
export default function BotConnectionAlert() {
    const { status, error, isLoading, failureCount, refresh, clearError } = useBotStatus({
        pollInterval: 60_000,
        maxRetries: 3,
    });

    // Nothing to show while loading initially
    if (isLoading && !status && !error) return null;

    // Session expired
    if (error?.code === "unauthorized") {
        return (
            <div className="mx-auto max-w-2xl px-4 mb-4">
                <div className="flex items-center gap-3 p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-sm">
                    <div className="w-8 h-8 rounded-xl bg-red-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-red-300">Session Expired</p>
                        <p className="text-xs text-red-300/70 mt-0.5">Please log in again to reconnect your bot.</p>
                    </div>
                    <a
                        href="/login"
                        className="px-4 py-2 text-xs font-semibold bg-red-500/20 text-red-300 rounded-xl border border-red-500/20 hover:bg-red-500/30 transition-colors"
                    >
                        Log In
                    </a>
                </div>
            </div>
        );
    }

    // Network / server error with retry
    if (error && (error.code === "network_error" || error.code === "server_error")) {
        return (
            <div className="mx-auto max-w-2xl px-4 mb-4">
                <div className="flex items-center gap-3 p-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 text-sm">
                    <div className="w-8 h-8 rounded-xl bg-yellow-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-yellow-300">Connection Issue</p>
                        <p className="text-xs text-yellow-300/70 mt-0.5">
                            {failureCount >= 3
                                ? "Unable to reach the server. Auto-retry paused."
                                : `Checking bot status failed. Retrying... (${failureCount}/3)`}
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            clearError();
                            refresh();
                        }}
                        className="px-4 py-2 text-xs font-semibold bg-yellow-500/20 text-yellow-300 rounded-xl border border-yellow-500/20 hover:bg-yellow-500/30 transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    // Stale connection warning
    if (status?.linkHealth === "stale") {
        const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "YourBotName";
        return (
            <div className="mx-auto max-w-2xl px-4 mb-4">
                <div className="flex items-center gap-3 p-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-sm">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-amber-300">Bot Link May Be Stale</p>
                        <p className="text-xs text-amber-300/70 mt-0.5">
                            Your Telegram connection is over 90 days old. Re-link to ensure it still works.
                        </p>
                    </div>
                    <a
                        href={`https://t.me/${botUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-xs font-semibold bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/20 hover:bg-amber-500/30 transition-colors"
                    >
                        Re-link
                    </a>
                </div>
            </div>
        );
    }

    // Unlinked state
    if (status && !status.isLinked) {
        const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "YourBotName";
        return (
            <div className="mx-auto max-w-2xl px-4 mb-4">
                <div className="flex items-center gap-3 p-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 text-sm">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 00-5.656-5.656l-1.102 1.101" />
                        </svg>
                    </div>
                    <div className="flex-1">
                        <p className="font-semibold text-blue-300">Telegram Not Connected</p>
                        <p className="text-xs text-blue-300/70 mt-0.5">Link your Telegram account to start coaching sessions.</p>
                    </div>
                    <a
                        href={`https://t.me/${botUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-xs font-semibold bg-blue-500/20 text-blue-300 rounded-xl border border-blue-500/20 hover:bg-blue-500/30 transition-colors"
                    >
                        Connect
                    </a>
                </div>
            </div>
        );
    }

    // Everything is healthy — render nothing
    return null;
}
