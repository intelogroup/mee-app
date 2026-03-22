"use client";

import { useState, useEffect } from "react";

interface SessionSummary {
    started_at: string;
    summary: string;
    message_count: number;
    topics?: string[];
}

export default function SessionContextSummary() {
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);

    useEffect(() => {
        fetch("/api/bot/conversations?limit=10&offset=0")
            .then((r) => r.json())
            .then((data) => {
                const allSessions: SessionSummary[] = data.sessions || [];
                // Show recent sessions (both with and without summaries)
                setSessions(allSessions.slice(0, 5));
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const generateSummary = async (sessionIndex: number) => {
        setGeneratingIndex(sessionIndex);
        try {
            const res = await fetch("/api/bot/conversations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionIndex }),
            });
            if (res.ok) {
                const data = await res.json();
                setSessions((prev) =>
                    prev.map((s, i) =>
                        i === sessionIndex
                            ? { ...s, summary: data.summary || "Summary generated." }
                            : s
                    )
                );
            }
        } catch {
            // silently fail
        } finally {
            setGeneratingIndex(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    if (sessions.length === 0) {
        return (
            <div className="py-10 text-center border-2 border-dashed border-white/5 rounded-3xl">
                <p className="text-sm text-text-muted leading-relaxed max-w-sm mx-auto">
                    No coaching sessions yet. Start chatting with Mee on Telegram and your session summaries will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {sessions.map((session, idx) => (
                <div
                    key={`${session.started_at}-${idx}`}
                    className="px-5 py-4 bg-white/5 border border-white/10 rounded-2xl group hover:bg-accent/5 hover:border-accent/20 transition-all"
                >
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-white">
                            {new Date(session.started_at).toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                            })}
                        </span>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] text-text-muted">
                                {session.message_count} messages
                            </span>
                            {!session.summary && (
                                <button
                                    onClick={() => generateSummary(idx)}
                                    disabled={generatingIndex !== null}
                                    className="text-[10px] font-bold text-accent hover:text-white bg-accent/10 hover:bg-accent px-2 py-0.5 rounded-md border border-accent/20 transition-all disabled:opacity-50"
                                >
                                    {generatingIndex === idx ? "Generating..." : "Summarize"}
                                </button>
                            )}
                        </div>
                    </div>
                    {session.summary ? (
                        <p className="text-xs text-text-secondary group-hover:text-white transition-colors leading-relaxed">
                            {session.summary}
                        </p>
                    ) : (
                        <p className="text-xs text-text-muted italic">
                            No summary yet. Click &quot;Summarize&quot; to generate one.
                        </p>
                    )}
                </div>
            ))}
        </div>
    );
}
