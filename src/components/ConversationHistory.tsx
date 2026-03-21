"use client";

import { useState, useEffect } from "react";

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
}

interface Session {
    started_at: string;
    ended_at: string;
    message_count: number;
    summary: string;
    messages: Message[];
}

interface ConversationData {
    sessions: Session[];
    total_messages: number;
    limit: number;
    offset: number;
}

export default function ConversationHistory() {
    const [data, setData] = useState<ConversationData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedSession, setExpandedSession] = useState<number | null>(null);
    const [offset, setOffset] = useState(0);
    const limit = 50;

    useEffect(() => {
        fetchConversations();
    }, [offset]);

    async function fetchConversations() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/bot/conversations?limit=${limit}&offset=${offset}`
            );
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || "Failed to load conversations");
            }
            const json: ConversationData = await res.json();
            setData(json);
        } catch (err: unknown) {
            setError((err as Error).message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    }

    function formatTime(iso: string) {
        return new Date(iso).toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    }

    function formatDate(iso: string) {
        return new Date(iso).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
        });
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-text-muted">Loading conversations...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="py-12 text-center border-2 border-dashed border-red-500/20 rounded-3xl">
                <p className="text-sm text-red-400 mb-4">{error}</p>
                <button
                    onClick={() => fetchConversations()}
                    className="px-4 py-2 text-sm bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors text-white"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (!data || data.sessions.length === 0) {
        return (
            <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
                <p className="text-sm text-text-muted leading-relaxed max-w-sm mx-auto">
                    No conversations yet. Start chatting with Mee on Telegram to see
                    your coaching sessions here.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between mb-6">
                <p className="text-xs text-text-muted">
                    {data.total_messages} total messages across {data.sessions.length}{" "}
                    session{data.sessions.length !== 1 ? "s" : ""}
                </p>
            </div>

            {/* Session List */}
            {data.sessions.map((session, idx) => (
                <div
                    key={`${session.started_at}-${idx}`}
                    className="glass-card rounded-2xl border border-white/10 bg-white/5 overflow-hidden transition-all hover:border-accent/20"
                >
                    {/* Session Header */}
                    <button
                        onClick={() =>
                            setExpandedSession(expandedSession === idx ? null : idx)
                        }
                        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                    >
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-1">
                                <span className="text-xs font-bold text-white">
                                    {formatDate(session.started_at)}
                                </span>
                                <span className="text-[10px] text-text-muted px-2 py-0.5 bg-white/5 rounded-full">
                                    {session.message_count} messages
                                </span>
                            </div>
                            {session.summary && (
                                <p className="text-xs text-text-secondary truncate max-w-lg">
                                    {session.summary}
                                </p>
                            )}
                            <p className="text-[10px] text-text-muted mt-1">
                                {formatTime(session.started_at)} &mdash;{" "}
                                {formatTime(session.ended_at)}
                            </p>
                        </div>
                        <svg
                            className={`w-4 h-4 text-text-muted transition-transform flex-shrink-0 ml-4 ${
                                expandedSession === idx ? "rotate-180" : ""
                            }`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                            />
                        </svg>
                    </button>

                    {/* Expanded Messages */}
                    {expandedSession === idx && (
                        <div className="border-t border-white/5 px-6 py-4 space-y-3 max-h-[400px] overflow-y-auto">
                            {session.messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${
                                        msg.role === "user"
                                            ? "justify-end"
                                            : "justify-start"
                                    }`}
                                >
                                    <div
                                        className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                                            msg.role === "user"
                                                ? "bg-accent/20 text-white rounded-tr-md"
                                                : "bg-white/5 text-text-secondary border border-white/5 rounded-tl-md"
                                        }`}
                                    >
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                        <p className="text-[9px] text-text-muted mt-1 opacity-60">
                                            {formatTime(msg.created_at)}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            ))}

            {/* Pagination */}
            {data.total_messages > limit && (
                <div className="flex items-center justify-center gap-4 pt-4">
                    <button
                        onClick={() => setOffset(Math.max(0, offset - limit))}
                        disabled={offset === 0}
                        className="px-4 py-2 text-xs font-medium text-text-secondary bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        Newer
                    </button>
                    <span className="text-[10px] text-text-muted">
                        Showing {offset + 1}&ndash;
                        {Math.min(offset + limit, data.total_messages)} of{" "}
                        {data.total_messages}
                    </span>
                    <button
                        onClick={() => setOffset(offset + limit)}
                        disabled={offset + limit >= data.total_messages}
                        className="px-4 py-2 text-xs font-medium text-text-secondary bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        Older
                    </button>
                </div>
            )}
        </div>
    );
}
