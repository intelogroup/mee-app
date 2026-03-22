'use client';

import { useState, useEffect } from 'react';

const DAYS = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
    const ampm = i >= 12 ? 'PM' : 'AM';
    const hour12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
    return { value: i, label: `${hour12}:00 ${ampm}` };
});

interface Preferences {
    weekly_checkin_enabled: boolean;
    weekly_checkin_day: number;
    weekly_checkin_hour: number;
}

function getLocalTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return 'Unknown';
    }
}

function getNextReminderText(prefs: Preferences): string {
    if (!prefs.weekly_checkin_enabled) return '';

    const now = new Date();
    const targetDay = prefs.weekly_checkin_day;
    const targetHour = prefs.weekly_checkin_hour;
    const currentDay = now.getDay();
    const currentHour = now.getHours();

    let daysUntil = targetDay - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && currentHour >= targetHour)) {
        daysUntil += 7;
    }

    const next = new Date(now);
    next.setDate(now.getDate() + daysUntil);
    next.setHours(targetHour, 0, 0, 0);

    return next.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}

export default function NotificationPreferences() {
    const [prefs, setPrefs] = useState<Preferences>({
        weekly_checkin_enabled: false,
        weekly_checkin_day: 1,
        weekly_checkin_hour: 9,
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');
    const [timezone] = useState(getLocalTimezone);

    useEffect(() => {
        fetch('/api/user/preferences')
            .then((res) => res.json())
            .then((data) => {
                setPrefs({
                    weekly_checkin_enabled: data.weekly_checkin_enabled ?? false,
                    weekly_checkin_day: data.weekly_checkin_day ?? 1,
                    weekly_checkin_hour: data.weekly_checkin_hour ?? 9,
                });
            })
            .catch(() => {
                // Use defaults on failure
            })
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        setError('');

        try {
            const res = await fetch('/api/user/preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prefs),
            });

            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                const data = await res.json();
                setError(data.error || 'Failed to save');
            }
        } catch {
            setError('Connection error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-accent"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Weekly Check-in Reminder */}
            <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                            Weekly Check-in Reminder
                        </h3>
                        <p className="text-xs text-text-muted mt-1 max-w-md">
                            Mee will send you a Telegram message to check in on your goals and well-being.
                            This helps maintain coaching momentum even when you forget to reach out.
                        </p>
                    </div>

                    {/* Toggle */}
                    <button
                        type="button"
                        role="switch"
                        aria-checked={prefs.weekly_checkin_enabled}
                        onClick={() =>
                            setPrefs((p) => ({
                                ...p,
                                weekly_checkin_enabled: !p.weekly_checkin_enabled,
                            }))
                        }
                        className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                            prefs.weekly_checkin_enabled ? 'bg-accent' : 'bg-white/20'
                        }`}
                    >
                        <span
                            className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                prefs.weekly_checkin_enabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                        />
                    </button>
                </div>

                {/* Schedule settings — only visible when enabled */}
                {prefs.weekly_checkin_enabled && (
                    <div className="mt-6 pt-6 border-t border-white/10 space-y-5">
                        <div>
                            <label className="block text-xs font-medium text-text-secondary mb-2">
                                Preferred day
                            </label>
                            <select
                                value={prefs.weekly_checkin_day}
                                onChange={(e) =>
                                    setPrefs((p) => ({
                                        ...p,
                                        weekly_checkin_day: Number(e.target.value),
                                    }))
                                }
                                className="w-full sm:w-auto bg-background border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                            >
                                {DAYS.map((d) => (
                                    <option key={d.value} value={d.value}>
                                        {d.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-text-secondary mb-2">
                                Preferred time
                            </label>
                            <select
                                value={prefs.weekly_checkin_hour}
                                onChange={(e) =>
                                    setPrefs((p) => ({
                                        ...p,
                                        weekly_checkin_hour: Number(e.target.value),
                                    }))
                                }
                                className="w-full sm:w-auto bg-background border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-accent transition-colors"
                            >
                                {HOURS.map((h) => (
                                    <option key={h.value} value={h.value}>
                                        {h.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="glass-card p-4 rounded-xl border border-accent/20 bg-accent/5">
                            <div className="flex items-start gap-3">
                                <span className="text-lg flex-shrink-0">📅</span>
                                <div>
                                    <p className="text-xs text-white font-medium mb-1">Next reminder</p>
                                    <p className="text-[11px] text-text-secondary">
                                        {getNextReminderText(prefs)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-[11px] text-text-muted">
                                🌐 Timezone: {timezone}
                            </span>
                        </div>

                        <p className="text-[11px] text-text-muted">
                            Reminders are sent via Telegram. Make sure your bot is linked on the dashboard.
                        </p>
                    </div>
                )}
            </div>

            {/* Re-engagement Nudge Info */}
            <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">
                            Re-engagement Nudge
                        </h3>
                        <p className="text-xs text-text-muted mt-1 max-w-md">
                            If you haven&apos;t chatted with Mee in 7 days, the bot will send a gentle prompt to check in.
                            This is always on to help maintain coaching momentum.
                        </p>
                    </div>
                    <div className="px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wide bg-accent/10 text-accent border border-accent/20">
                        Always On
                    </div>
                </div>
                <p className="text-[11px] text-text-muted leading-relaxed">
                    The nudge is a single friendly message — never spammy. You can always ignore it.
                    If you want to fully stop coaching, use the deactivate option on your dashboard.
                </p>
            </div>

            {/* Save button */}
            <div className="flex items-center gap-4">
                <button
                    onClick={handleSave}
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
                    <span className="text-sm text-red-400">
                        {error}
                    </span>
                )}
            </div>
        </div>
    );
}
