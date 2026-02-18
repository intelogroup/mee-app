"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";

export default function SignupPage() {
    const router = useRouter();
    const [form, setForm] = useState({ email: "", password: "", confirm: "" });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (form.password !== form.confirm) {
            setError("Passwords do not match.");
            return;
        }
        if (form.password.length < 8) {
            setError("Password must be at least 8 characters.");
            return;
        }

        setLoading(true);
        try {
            const supabase = createClient();
            const { error: signUpError } = await supabase.auth.signUp({
                email: form.email,
                password: form.password,
            });

            if (signUpError) {
                setError(signUpError.message);
                return;
            }

            // Sign in immediately after signup (no email verify in MVP)
            const { error: signInError } = await supabase.auth.signInWithPassword({
                email: form.email,
                password: form.password,
            });

            if (signInError) {
                setError("Account created! Please sign in.");
                router.push("/login");
                return;
            }

            router.push("/dashboard");
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
                style={{ width: 500, height: 500, background: "#7c3aed", top: -150, left: -150 }}
            />
            <div
                className="glow-blob"
                style={{ width: 300, height: 300, background: "#2563eb", bottom: -100, right: -50 }}
            />

            <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 420 }}>
                <div style={{ textAlign: "center", marginBottom: 32 }}>
                    <Link href="/" style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", textDecoration: "none" }}>
                        <span className="gradient-text">mee</span>
                    </Link>
                    <p style={{ marginTop: 8, color: "var(--text-secondary)", fontSize: 15 }}>
                        Create your account
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
                                placeholder="Min. 8 characters"
                                value={form.password}
                                onChange={(e) => setForm({ ...form, password: e.target.value })}
                                required
                                autoComplete="new-password"
                            />
                        </div>

                        <div>
                            <label htmlFor="confirm" style={{ display: "block", fontSize: 13, fontWeight: 500, marginBottom: 6, color: "var(--text-secondary)" }}>
                                Confirm password
                            </label>
                            <input
                                id="confirm"
                                type="password"
                                className="input-field"
                                placeholder="Repeat your password"
                                value={form.confirm}
                                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                                required
                                autoComplete="new-password"
                            />
                        </div>

                        {error && (
                            <div style={{ padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: 13, color: "var(--danger)" }}>
                                {error}
                            </div>
                        )}

                        <button type="submit" className="btn-primary" disabled={loading} style={{ width: "100%", marginTop: 4 }}>
                            {loading ? "Creating account…" : "Create account"}
                        </button>
                    </form>

                    <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
                        Already have an account?{" "}
                        <Link href="/login" style={{ color: "var(--accent-light)", textDecoration: "none", fontWeight: 500 }}>
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </main>
    );
}
