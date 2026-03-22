"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface TimelineBucket {
    label: string;
    start: string;
    end: string;
    user_messages: number;
    bot_messages: number;
    total_messages: number;
    completed_goals: string[];
    new_traits: string[];
}

interface ActiveGoal {
    title: string;
    created_at: string;
}

interface ProgressData {
    period: string;
    timeline: TimelineBucket[];
    active_goals: ActiveGoal[];
    total_traits: number;
}

export default function ProgressPage() {
    const [data, setData] = useState<ProgressData | null>(null);
    const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProgress = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/bot/progress?period=${period}`);
            if (!res.ok) throw new Error("Failed to fetch progress");
            const json = await res.json();
            setData(json);
        } catch {
            setError("Could not load progress data");
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchProgress();
    }, [fetchProgress]);

    const maxMessages = data
        ? Math.max(...data.timeline.map((t) => t.total_messages), 1)
        : 1;

    return (
        <main className="min-h-screen relative overflow-hidden bg-background text-text-primary">
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none noise-bg" />

            {/* Navbar */}
            <nav className="relative z-10 flex items-center justify-between px-6 py-4 glass-panel border-b border-white/5">
                <Link
                    href="/dashboard"
                    className="text-2xl font-bold tracking-tight text-white hover:opacity-80 transition-opacity"
                >
                    mee
                </Link>
                <Link
                    href="/dashboard"
                    className="text-sm text-accent hover:text-white transition-colors"
                >
                    Back to Dashboard
                </Link>
            </nav>

            <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-white mb-1">
                            Progress Timeline
                        </h1>
                        <p className="text-sm text-text-muted">
                            Track your coaching journey over time
                        </p>
                    </div>

                    {/* Period Toggle */}
                    <div className="flex bg-white/5 rounded-xl border border-white/10 p-1">
                        <button
                            onClick={() => setPeriod("weekly")}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                                period === "weekly"
                                    ? "bg-accent text-white"
                                    : "text-text-muted hover:text-white"
                            }`}
                        >
                            Weekly
                        </button>
                        <button
                            onClick={() => setPeriod("monthly")}
                            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                                period === "monthly"
                                    ? "bg-accent text-white"
                                    : "text-text-muted hover:text-white"
                            }`}
                        >
                            Monthly
                        </button>
                    </div>
                </div>

                {loading && (
                    <div className="space-y-4">
                        {[1, 2, 3, 4].map((i) => (
                            <div
                                key={i}
                                className="animate-pulse h-24 bg-white/5 rounded-2xl border border-white/10"
                            />
                        ))}
                    </div>
                )}

                {error && (
                    <div className="px-6 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-sm text-red-400">
                        {error}
                    </div>
                )}

                {data && !loading && (
                    <>
                        {/* Summary Stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-white/5">
                                <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold block mb-1">
                                    Total Traits
                                </span>
                                <span className="text-2xl font-black text-white">
                                    {data.total_traits}
                                </span>
                            </div>
                            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-white/5">
                                <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold block mb-1">
                                    Active Goals
                                </span>
                                <span className="text-2xl font-black text-white">
                                    {data.active_goals.length}
                                </span>
                            </div>
                            <div className="glass-card p-5 rounded-2xl border border-white/10 bg-white/5 col-span-2 sm:col-span-1">
                                <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold block mb-1">
                                    Total Interactions
                                </span>
                                <span className="text-2xl font-black text-white">
                                    {data.timeline.reduce(
                                        (sum, t) => sum + t.total_messages,
                                        0
                                    )}
                                </span>
                            </div>
                        </div>

                        {/* Activity Chart */}
                        <div className="glass-card p-8 rounded-[2rem] border border-white/10 bg-white/5 mb-8">
                            <h2 className="text-lg font-bold text-white mb-6">
                                Conversation Activity
                            </h2>
                            <div className="flex items-end gap-3 h-40">
                                {data.timeline.map((bucket, idx) => (
                                    <div
                                        key={idx}
                                        className="flex-1 flex flex-col items-center gap-2"
                                    >
                                        <div
                                            className="w-full bg-accent/30 rounded-t-lg transition-all relative group"
                                            style={{
                                                height: `${Math.max(
                                                    (bucket.total_messages /
                                                        maxMessages) *
                                                        100,
                                                    4
                                                )}%`,
                                            }}
                                        >
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-accent text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                {bucket.total_messages} msgs
                                            </div>
                                            <div
                                                className="absolute bottom-0 left-0 right-0 bg-accent rounded-t-lg transition-all"
                                                style={{
                                                    height: `${
                                                        bucket.total_messages > 0
                                                            ? (bucket.user_messages /
                                                                  bucket.total_messages) *
                                                              100
                                                            : 0
                                                    }%`,
                                                }}
                                            />
                                        </div>
                                        <span className="text-[9px] text-text-muted text-center leading-tight">
                                            {bucket.label.split(" - ")[0]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex items-center gap-4 mt-4 text-[10px] text-text-muted">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-sm bg-accent" />{" "}
                                    You
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-sm bg-accent/30" />{" "}
                                    Mee
                                </span>
                            </div>
                        </div>

                        {/* Timeline Detail */}
                        <div className="space-y-4">
                            {data.timeline.map((bucket, idx) => (
                                <div
                                    key={idx}
                                    className="glass-card p-6 rounded-2xl border border-white/10 bg-white/5"
                                >
                                    <div className="flex items-center justify-between mb-3">
                                        <span className="text-sm font-bold text-white">
                                            {bucket.label}
                                        </span>
                                        <span className="text-xs text-text-muted">
                                            {bucket.total_messages} messages
                                        </span>
                                    </div>

                                    {bucket.completed_goals.length > 0 && (
                                        <div className="mb-2">
                                            <span className="text-[10px] uppercase tracking-widest text-accent font-bold">
                                                Goals Completed
                                            </span>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {bucket.completed_goals.map(
                                                    (g, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-2 py-1 bg-accent/10 text-accent text-xs rounded-lg border border-accent/20"
                                                        >
                                                            {g}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {bucket.new_traits.length > 0 && (
                                        <div>
                                            <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold">
                                                New Traits
                                            </span>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                {bucket.new_traits.map(
                                                    (t, i) => (
                                                        <span
                                                            key={i}
                                                            className="px-2 py-1 bg-white/5 text-text-secondary text-xs rounded-lg border border-white/10"
                                                        >
                                                            {t}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {bucket.completed_goals.length === 0 &&
                                        bucket.new_traits.length === 0 &&
                                        bucket.total_messages === 0 && (
                                            <p className="text-xs text-text-muted italic">
                                                No activity this period
                                            </p>
                                        )}
                                </div>
                            ))}
                        </div>

                        {/* Active Goals */}
                        {data.active_goals.length > 0 && (
                            <div className="glass-card p-8 rounded-[2rem] border border-white/10 bg-white/5 mt-8">
                                <h2 className="text-lg font-bold text-white mb-4">
                                    Current Goals
                                </h2>
                                <div className="space-y-2">
                                    {data.active_goals.map((goal, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-xl"
                                        >
                                            <div className="w-2 h-2 rounded-full bg-accent" />
                                            <span className="text-sm text-text-secondary">
                                                {goal.title}
                                            </span>
                                            <span className="text-[10px] text-text-muted ml-auto">
                                                Since{" "}
                                                {new Date(
                                                    goal.created_at
                                                ).toLocaleDateString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
