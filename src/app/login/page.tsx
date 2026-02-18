"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const supabase = createClient();
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: form.email,
                password: form.password,
            });

            if (signInError) {
                setError("Invalid email or password.");
                return;
            }

            router.push(callbackUrl);
            router.refresh();
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main
            style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 24,
                position: "relative",
                overflow: "hidden",
            }}
        >
            <div
                className="glow-blob"
                style={{ width: 500, height: 500, background: "#7c3aed", top: -150, right: -150 }}
            />
            <div
                className="glow-blob"
                style={{ width: 300, height: 300, background: "#0ea5e9", bottom: -100, left: -50 }}
            />

            <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420 }}>
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <Link href="/" style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", textDecoration: "none" }}>
                        <span className="gradient-text">mee</span>
                    </Link>
                    <p style={{ marginTop: 8, color: "var(--text-secondary)", fontSize: 15 }}>
                        Welcome back
                    </p>
                </div>

                <div className="glass-card" style={{ padding: 32 }}>
                    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                        <div>
                            <label htmlFor="email" style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-secondary)" }}>
                                Email address
                            </label>
                            <input
                                id="email"
                                type="email"
                                className="input-field"
                                placeholder="you@example.com"
                                value={form.email}
                                onChange={(e) => setForm({ ...form, email: e.target.value })}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div>
                            <label htmlFor="password" style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-secondary)" }}>
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                className="input-field"
                                placeholder="Your password"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        {error && (
                            <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 13, color: "var(--danger)" }}>
                                {error}
                            </div>
                        )}

                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", marginTop: 4 }}>
                            {loading ? "Signing in…" : "Sign in"}
                        </button>
                    </form>

                    <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
                        Don&apos;t have an account?{" "}
                        <Link href="/signup" style={{ color: "var(--accent-light)", textDecoration: "none", fontWeight: 500 }}>
                            Sign up
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
