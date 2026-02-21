"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";

export default function UpdatePasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const supabase = createClient();

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password,
            });

            if (updateError) {
                setError(updateError.message);
                setLoading(false);
                return;
            }

            setSuccess(true);
            setLoading(false);

            // Redirect to dashboard after a short delay
            setTimeout(() => {
                router.push("/dashboard");
            }, 2000);

        } catch (err) {
            setError("Critical error updating password.");
            setLoading(false);
        }
    };

    return (
        <main className="flex min-h-screen items-center justify-center relative overflow-hidden px-6 py-12 bg-background">
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none noise-bg"></div>

            <div className="w-full max-w-md relative z-10 flex flex-col items-center">
                <div className="text-center mb-8">
                    <Link href="/" className="inline-block text-4xl font-bold tracking-tight text-white mb-2 hover:opacity-80 transition-opacity">
                        mee
                    </Link>
                    <h1 className="text-2xl font-semibold text-white">Create New Password</h1>
                    <p className="text-text-secondary mt-2">
                        Set a secure password for your account.
                    </p>
                </div>

                <div className="w-full glass-card p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
                    {success ? (
                        <div className="text-center py-4">
                            <div className="text-4xl mb-4">✅</div>
                            <h2 className="text-xl font-medium text-white mb-2">Password Updated</h2>
                            <p className="text-text-secondary">Your password has been changed successfully. Redirecting to your dashboard...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleUpdate} className="flex flex-col gap-5">
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-text-secondary mb-2">
                                    New Password
                                </label>
                                <input
                                    id="password"
                                    type="password"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/10 transition-all font-mono"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                />
                            </div>

                            <div>
                                <label htmlFor="confirmPassword" className="block text-sm font-medium text-text-secondary mb-2">
                                    Confirm Password
                                </label>
                                <input
                                    id="confirmPassword"
                                    type="password"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/10 transition-all font-mono"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    autoComplete="new-password"
                                />
                            </div>

                            {error && (
                                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-2 w-full py-3.5 px-4 bg-white text-black font-semibold rounded-xl hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-white/5"
                            >
                                {loading ? "Updating..." : "Update Password"}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </main>
    );
}
