'use client';

import { useState, useEffect } from 'react';

interface PrivacyData {
    data_collection_enabled: boolean;
    nudge_enabled: boolean;
    account_created: string;
    stored_data: {
        trait_count: number;
        pattern_count: number;
        conversation_count: number;
    };
}

type ResetStep = 'idle' | 'confirm' | 'resetting' | 'done' | 'error';

export default function PrivacyControls() {
    const [data, setData] = useState<PrivacyData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [resetStep, setResetStep] = useState<ResetStep>('idle');
    const [resetError, setResetError] = useState('');

    useEffect(() => {
        fetch('/api/user/privacy')
            .then((res) => res.json())
            .then((d) => setData(d))
            .catch(() => {
                setData({
                    data_collection_enabled: true,
                    nudge_enabled: true,
                    account_created: '',
                    stored_data: {
                        trait_count: 0,
                        pattern_count: 0,
                        conversation_count: 0,
                    },
                });
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSavePreferences = async () => {
        if (!data) return;
        setSaving(true);
        setSaved(false);
        setError('');

        try {
            const res = await fetch('/api/user/privacy', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    data_collection_enabled: data.data_collection_enabled,
                    nudge_enabled: data.nudge_enabled,
                }),
            });

            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                const d = await res.json();
                setError(d.error || 'Failed to save');
            }
        } catch {
            setError('Connection error');
        } finally {
            setSaving(false);
        }
    };

    const handleResetMemory = async () => {
        setResetStep('resetting');
        setResetError('');

        try {
            const res = await fetch('/api/user/privacy', { method: 'DELETE' });
            const d = await res.json();

            if (res.ok) {
                setResetStep('done');
                // Update stored data counts to zero
                setData((prev) =>
                    prev
                        ? {
                              ...prev,
                              stored_data: {
                                  trait_count: 0,
                                  pattern_count: 0,
                                  conversation_count: 0,
                              },
                          }
                        : prev
                );
            } else if (res.status === 207) {
                setResetStep('error');
                setResetError(
                    d.errors?.join(', ') || 'Some data could not be cleared'
                );
            } else {
                setResetStep('error');
                setResetError(d.error || 'Reset failed');
            }
        } catch {
            setResetStep('error');
            setResetError('Connection error');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
            </div>
        );
    }

    if (!data) return null;

    return (
        <div className="space-y-8">
            {/* Stored Data Summary */}
            <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5">
                <h3 className="text-lg font-bold text-white tracking-tight mb-4">
                    Your Stored Data
                </h3>
                <p className="text-xs text-text-muted mb-6 max-w-md">
                    Here is what Mee has learned about you through your coaching
                    conversations.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="glass-card p-4 rounded-xl border border-white/10 bg-white/5 text-center">
                        <p className="text-2xl font-bold text-accent">
                            {data.stored_data.conversation_count}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                            Conversations
                        </p>
                    </div>
                    <div className="glass-card p-4 rounded-xl border border-white/10 bg-white/5 text-center">
                        <p className="text-2xl font-bold text-accent">
                            {data.stored_data.trait_count}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                            Traits Learned
                        </p>
                    </div>
                    <div className="glass-card p-4 rounded-xl border border-white/10 bg-white/5 text-center">
                        <p className="text-2xl font-bold text-accent">
                            {data.stored_data.pattern_count}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                            Patterns Identified
                        </p>
                    </div>
                </div>

                {data.account_created && (
                    <p className="text-[11px] text-text-muted mt-4">
                        Account created:{' '}
                        {new Date(data.account_created).toLocaleDateString(
                            'en-US',
                            {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            }
                        )}
                    </p>
                )}
            </div>

            {/* Data Collection Preferences */}
            <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5">
                <h3 className="text-lg font-bold text-white tracking-tight mb-4">
                    Data Collection Preferences
                </h3>
                <p className="text-xs text-text-muted mb-6 max-w-md">
                    Control how Mee collects and uses your data. Changes take
                    effect immediately.
                </p>

                <div className="space-y-6">
                    {/* Data collection toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-white">
                                Learning from conversations
                            </p>
                            <p className="text-xs text-text-muted mt-1 max-w-sm">
                                When enabled, Mee learns your traits and patterns
                                from conversations to personalize coaching.
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={data.data_collection_enabled}
                            aria-label="Toggle data collection"
                            onClick={() =>
                                setData((prev) =>
                                    prev
                                        ? {
                                              ...prev,
                                              data_collection_enabled:
                                                  !prev.data_collection_enabled,
                                          }
                                        : prev
                                )
                            }
                            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                data.data_collection_enabled
                                    ? 'bg-accent'
                                    : 'bg-white/20'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    data.data_collection_enabled
                                        ? 'translate-x-5'
                                        : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>

                    {/* Nudge toggle */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-medium text-white">
                                Re-engagement nudges
                            </p>
                            <p className="text-xs text-text-muted mt-1 max-w-sm">
                                Receive a gentle reminder if you haven&apos;t
                                chatted with Mee in 7 days.
                            </p>
                        </div>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={data.nudge_enabled}
                            aria-label="Toggle nudge notifications"
                            onClick={() =>
                                setData((prev) =>
                                    prev
                                        ? {
                                              ...prev,
                                              nudge_enabled:
                                                  !prev.nudge_enabled,
                                          }
                                        : prev
                                )
                            }
                            className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                                data.nudge_enabled
                                    ? 'bg-accent'
                                    : 'bg-white/20'
                            }`}
                        >
                            <span
                                className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                    data.nudge_enabled
                                        ? 'translate-x-5'
                                        : 'translate-x-0'
                                }`}
                            />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-4 mt-6">
                    <button
                        onClick={handleSavePreferences}
                        disabled={saving}
                        className="px-6 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Preferences'}
                    </button>

                    {saved && (
                        <span className="text-sm text-green-400 animate-fade-in">
                            Preferences saved
                        </span>
                    )}
                    {error && (
                        <span className="text-sm text-red-400">{error}</span>
                    )}
                </div>
            </div>

            {/* Reset AI Memory */}
            <div className="glass-card p-6 rounded-3xl border border-red-500/20 bg-red-500/5">
                <h3 className="text-lg font-bold text-white tracking-tight mb-2">
                    Reset AI Memory
                </h3>
                <p className="text-xs text-text-muted mb-6 max-w-md">
                    This will permanently delete all your coaching data: conversation
                    history, learned traits, identified patterns, and vector
                    embeddings. This action cannot be undone.
                </p>

                {resetStep === 'idle' && (
                    <button
                        onClick={() => setResetStep('confirm')}
                        className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
                    >
                        Reset All Data
                    </button>
                )}

                {resetStep === 'confirm' && (
                    <div className="space-y-4">
                        <div className="glass-card p-4 rounded-xl border border-red-500/30 bg-red-500/10">
                            <p className="text-sm text-white font-medium mb-2">
                                Are you sure?
                            </p>
                            <p className="text-xs text-text-muted">
                                This will delete {data.stored_data.conversation_count}{' '}
                                conversations, {data.stored_data.trait_count} traits,
                                and {data.stored_data.pattern_count} patterns. Your
                                account and settings will remain intact.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleResetMemory}
                                className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
                            >
                                Yes, Delete Everything
                            </button>
                            <button
                                onClick={() => setResetStep('idle')}
                                className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {resetStep === 'resetting' && (
                    <div className="flex items-center gap-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-red-400"></div>
                        <span className="text-sm text-text-muted">
                            Clearing your data...
                        </span>
                    </div>
                )}

                {resetStep === 'done' && (
                    <div className="glass-card p-4 rounded-xl border border-green-500/20 bg-green-500/10">
                        <p className="text-sm text-green-400 font-medium">
                            All AI memory has been cleared successfully.
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                            Mee will start fresh the next time you chat.
                        </p>
                    </div>
                )}

                {resetStep === 'error' && (
                    <div className="space-y-3">
                        <div className="glass-card p-4 rounded-xl border border-red-500/20 bg-red-500/10">
                            <p className="text-sm text-red-400 font-medium">
                                {resetError}
                            </p>
                        </div>
                        <button
                            onClick={() => setResetStep('idle')}
                            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm transition-colors"
                        >
                            Try Again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
