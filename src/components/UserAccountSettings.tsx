'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';

const LANGUAGES = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'pt', label: 'Português' },
    { value: 'it', label: 'Italiano' },
    { value: 'ru', label: 'Русский' },
    { value: 'zh', label: '中文' },
    { value: 'ja', label: '日本語' },
    { value: 'ko', label: '한국어' },
    { value: 'ar', label: 'العربية' },
    { value: 'hi', label: 'हिन्दी' },
];

function getLocalTimezone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
        return 'Unknown';
    }
}

function getTimezoneOffset(): string {
    const offset = -new Date().getTimezoneOffset();
    const sign = offset >= 0 ? '+' : '-';
    const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
    const mins = String(Math.abs(offset) % 60).padStart(2, '0');
    return `UTC${sign}${hours}:${mins}`;
}

interface LanguageSettings {
    language: string;
}

interface PasswordForm {
    current: string;
    next: string;
    confirm: string;
}

export default function UserAccountSettings({
    initialLanguage = 'en',
}: {
    initialLanguage?: string;
}) {
    const supabase = createClient();
    const timezone = getLocalTimezone();
    const tzOffset = getTimezoneOffset();

    // Language
    const [lang, setLang] = useState<LanguageSettings>({ language: initialLanguage });
    const [savingLang, setSavingLang] = useState(false);
    const [savedLang, setSavedLang] = useState(false);
    const [langError, setLangError] = useState('');

    const handleSaveLanguage = async () => {
        setSavingLang(true);
        setSavedLang(false);
        setLangError('');
        try {
            const res = await fetch('/api/user/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: lang.language }),
            });
            if (res.ok) {
                setSavedLang(true);
                setTimeout(() => setSavedLang(false), 3000);
            } else {
                const data = await res.json();
                setLangError(data.error || 'Failed to save');
            }
        } catch {
            setLangError('Connection error');
        } finally {
            setSavingLang(false);
        }
    };

    // Password change
    const [pw, setPw] = useState<PasswordForm>({ current: '', next: '', confirm: '' });
    const [savingPw, setSavingPw] = useState(false);
    const [savedPw, setSavedPw] = useState(false);
    const [pwError, setPwError] = useState('');

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwError('');
        if (pw.next !== pw.confirm) {
            setPwError('New passwords do not match.');
            return;
        }
        if (pw.next.length < 6) {
            setPwError('Password must be at least 6 characters.');
            return;
        }
        setSavingPw(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: pw.next });
            if (error) {
                setPwError(error.message);
            } else {
                setSavedPw(true);
                setPw({ current: '', next: '', confirm: '' });
                setTimeout(() => setSavedPw(false), 4000);
            }
        } catch {
            setPwError('Connection error');
        } finally {
            setSavingPw(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Timezone (read-only display) */}
            <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5">
                <h3 className="text-lg font-bold text-white tracking-tight mb-1">Timezone</h3>
                <p className="text-xs text-text-muted mb-5 max-w-md">
                    Your local timezone is detected automatically from your device. Session reminders and
                    coaching check-ins use this timezone.
                </p>
                <div className="flex items-center gap-3">
                    <div className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-text-secondary font-mono select-all">
                        {timezone}
                    </div>
                    <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-sm text-text-muted font-mono whitespace-nowrap">
                        {tzOffset}
                    </div>
                </div>
                <p className="text-[10px] text-text-muted mt-3">
                    To change your timezone, update your device or browser system settings.
                </p>
            </div>

            {/* Language */}
            <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5">
                <h3 className="text-lg font-bold text-white tracking-tight mb-1">Language</h3>
                <p className="text-xs text-text-muted mb-5 max-w-md">
                    Sets the language Mee uses when coaching you via Telegram.
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                    <select
                        value={lang.language}
                        onChange={(e) => setLang({ language: e.target.value })}
                        className="flex-1 min-w-[180px] bg-background border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-accent/50 transition-colors"
                    >
                        {LANGUAGES.map((l) => (
                            <option key={l.value} value={l.value}>
                                {l.label}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={handleSaveLanguage}
                        disabled={savingLang}
                        className="px-5 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                        {savingLang ? 'Saving...' : 'Save Language'}
                    </button>
                </div>
                <div className="mt-2 h-5">
                    {savedLang && (
                        <span className="text-xs text-green-400">Language preference saved</span>
                    )}
                    {langError && <span className="text-xs text-red-400">{langError}</span>}
                </div>
            </div>

            {/* Change Password */}
            <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5">
                <h3 className="text-lg font-bold text-white tracking-tight mb-1">Change Password</h3>
                <p className="text-xs text-text-muted mb-5 max-w-md">
                    Set a new password for your Mee account. Minimum 6 characters.
                </p>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">
                            New password
                        </label>
                        <input
                            type="password"
                            value={pw.next}
                            onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))}
                            placeholder="New password"
                            autoComplete="new-password"
                            className="w-full bg-background border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-accent/50 transition-colors placeholder:text-text-muted"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-text-secondary mb-1.5">
                            Confirm new password
                        </label>
                        <input
                            type="password"
                            value={pw.confirm}
                            onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))}
                            placeholder="Confirm new password"
                            autoComplete="new-password"
                            className="w-full bg-background border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:border-accent/50 transition-colors placeholder:text-text-muted"
                        />
                    </div>
                    <div className="flex items-center gap-4 pt-1">
                        <button
                            type="submit"
                            disabled={savingPw || !pw.next || !pw.confirm}
                            className="px-6 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {savingPw ? 'Updating...' : 'Update Password'}
                        </button>
                        {savedPw && (
                            <span className="text-sm text-green-400 animate-fade-in">
                                Password updated successfully
                            </span>
                        )}
                        {pwError && <span className="text-sm text-red-400">{pwError}</span>}
                    </div>
                </form>
            </div>
        </div>
    );
}
