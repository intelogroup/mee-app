"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import Link from "next/link";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const supabase = createClient();
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/update-password`,
            });

            if (resetError) {
                setError(resetError.message);
                setLoading(false);
                return;
            }

            setSuccess(true);
            setLoading(false);
        } catch (err) {
            setError("Network error. Please try again.");
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
                    <h1 className="text-2xl font-semibold text-white">Reset Password</h1>
                    <p className="text-text-secondary mt-2">
                        Enter your email and we&apos;ll send you a recovery link.
                    </p>
                </div>

                <div className="w-full glass-card p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
                    {success ? (
                        <div className="text-center py-4">
                            <div className="text-4xl mb-4">📧</div>
                            <h2 className="text-xl font-medium text-white mb-2">Check your email</h2>
                            <p className="text-text-secondary mb-6">
                                If an account exists for {email}, you will receive a password reset link shortly.
                            </p>
                            <Link
                                href="/login"
                                className="inline-block w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-all"
                            >
                                Back to Login
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-text-secondary mb-2">
                                    Email address
                                </label>
                                <input
                                    id="email"
                                    type="email"
                                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-white/20 focus:bg-white/10 transition-all"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
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
                                {loading ? "Sending..." : "Send Reset Link"}
                            </button>

                            <div className="text-center text-sm text-text-muted mt-2">
                                Remembered your password?{" "}
                                <Link href="/login" className="text-white hover:underline font-medium">
                                    Log in
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </main>
    );
}
