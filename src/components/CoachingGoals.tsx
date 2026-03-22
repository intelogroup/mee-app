"use client";

import { useState, useEffect, useCallback } from "react";

interface Goal {
    id: string;
    title: string;
    status: "active" | "completed" | "archived";
    created_at: string;
    updated_at: string;
}

export default function CoachingGoals() {
    const [goals, setGoals] = useState<Goal[]>([]);
    const [newGoal, setNewGoal] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchGoals = useCallback(async () => {
        try {
            const res = await fetch("/api/bot/goals");
            if (!res.ok) throw new Error("Failed to fetch goals");
            const data = await res.json();
            setGoals(data.goals || []);
        } catch {
            setError("Could not load goals");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGoals();
    }, [fetchGoals]);

    const activeGoals = goals.filter((g) => g.status === "active");
    const completedGoals = goals.filter((g) => g.status === "completed");
    const canAddMore = activeGoals.length < 3;

    async function handleAddGoal(e: React.FormEvent) {
        e.preventDefault();
        if (!newGoal.trim() || !canAddMore) return;

        setSaving(true);
        setError(null);
        try {
            const res = await fetch("/api/bot/goals", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newGoal.trim() }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || "Failed to add goal");
            }
            setNewGoal("");
            await fetchGoals();
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : "Failed to add goal"
            );
        } finally {
            setSaving(false);
        }
    }

    async function handleComplete(goalId: string) {
        try {
            const res = await fetch("/api/bot/goals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ goalId, status: "completed" }),
            });
            if (!res.ok) throw new Error("Failed to update goal");
            await fetchGoals();
        } catch {
            setError("Failed to update goal");
        }
    }

    async function handleReactivate(goalId: string) {
        if (activeGoals.length >= 3) {
            setError("Maximum 3 active goals. Complete or remove one first.");
            return;
        }
        try {
            const res = await fetch("/api/bot/goals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ goalId, status: "active" }),
            });
            if (!res.ok) throw new Error("Failed to reactivate goal");
            await fetchGoals();
        } catch {
            setError("Failed to reactivate goal");
        }
    }

    async function handleDelete(goalId: string) {
        try {
            const res = await fetch("/api/bot/goals", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ goalId }),
            });
            if (!res.ok) throw new Error("Failed to delete goal");
            await fetchGoals();
        } catch {
            setError("Failed to delete goal");
        }
    }

    if (loading) {
        return (
            <div className="glass-card p-8 rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-2xl shadow-xl">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-white/10 rounded w-1/3" />
                    <div className="h-4 bg-white/10 rounded w-2/3" />
                    <div className="h-4 bg-white/10 rounded w-1/2" />
                </div>
            </div>
        );
    }

    return (
        <div className="glass-card p-8 rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-2xl shadow-xl">
            <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white tracking-tight">
                    Coaching Goals
                </h2>
                <span className="text-[10px] uppercase tracking-widest text-accent font-black">
                    {activeGoals.length}/3 Active
                </span>
            </div>

            <p className="text-xs text-text-muted mb-6 leading-relaxed">
                Set 1-3 goals to steer your coaching sessions. Mee will
                reference these during your conversations to keep you on track.
            </p>

            {error && (
                <div className="mb-4 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                    {error}
                </div>
            )}

            {/* Active Goals */}
            {activeGoals.length > 0 && (
                <div className="space-y-3 mb-6">
                    {activeGoals.map((goal) => (
                        <div
                            key={goal.id}
                            className="flex items-center gap-3 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl group hover:bg-accent/5 hover:border-accent/20 transition-all"
                        >
                            <button
                                onClick={() => handleComplete(goal.id)}
                                className="w-5 h-5 rounded-full border-2 border-accent/40 hover:bg-accent/20 transition-colors flex-shrink-0"
                                title="Mark as completed"
                            />
                            <span className="text-sm font-medium text-text-secondary group-hover:text-white transition-colors flex-1">
                                {goal.title}
                            </span>
                            <button
                                onClick={() => handleDelete(goal.id)}
                                className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition-all text-xs"
                                title="Delete goal"
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Goal Form */}
            {canAddMore && (
                <form onSubmit={handleAddGoal} className="flex gap-2 mb-6">
                    <input
                        type="text"
                        value={newGoal}
                        onChange={(e) => setNewGoal(e.target.value)}
                        placeholder="e.g., Be more confident in group settings"
                        maxLength={200}
                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent/40 transition-colors"
                    />
                    <button
                        type="submit"
                        disabled={saving || !newGoal.trim()}
                        className="px-6 py-3 bg-accent text-white font-bold text-sm rounded-2xl hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {saving ? "..." : "Add"}
                    </button>
                </form>
            )}

            {activeGoals.length === 0 && (
                <div className="py-8 text-center border-2 border-dashed border-white/5 rounded-3xl mb-6">
                    <p className="text-sm text-text-muted leading-relaxed max-w-sm mx-auto">
                        No goals set yet. Add your first coaching goal to give
                        Mee direction.
                    </p>
                </div>
            )}

            {/* Completed Goals */}
            {completedGoals.length > 0 && (
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-text-muted mb-3">
                        Completed
                    </h3>
                    <div className="space-y-2">
                        {completedGoals.map((goal) => (
                            <div
                                key={goal.id}
                                className="flex items-center gap-3 px-4 py-2 bg-white/[0.02] border border-white/5 rounded-xl group"
                            >
                                <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                                    <svg
                                        className="w-3 h-3 text-accent"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        stroke="currentColor"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={3}
                                            d="M5 13l4 4L19 7"
                                        />
                                    </svg>
                                </div>
                                <span className="text-sm text-text-muted line-through flex-1">
                                    {goal.title}
                                </span>
                                <button
                                    onClick={() =>
                                        handleReactivate(goal.id)
                                    }
                                    className="opacity-0 group-hover:opacity-100 text-xs text-accent hover:text-white transition-all"
                                >
                                    Reactivate
                                </button>
                                <button
                                    onClick={() => handleDelete(goal.id)}
                                    className="opacity-0 group-hover:opacity-100 text-xs text-text-muted hover:text-red-400 transition-all"
                                >
                                    Remove
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
