"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

export default function DeactivateButton() {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleDeactivate = async () => {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/user/deactivate", { method: "POST" });
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || "Failed to deactivate.");
                return;
            }
            const supabase = createClient();
            await supabase.auth.signOut();
            router.push("/");
        } catch {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (confirming) {
        return (
            <div>
                <p style={{ fontSize: 13, color: "var(--danger)", marginBottom: 12, fontWeight: 500 }}>
                    Are you sure? This will stop Mee from responding.
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleDeactivate} disabled={loading} className="btn-danger" style={{ flex: 1 }}>
                        {loading ? "Deactivating…" : "Yes, deactivate"}
                    </button>
                    <button onClick={() => setConfirming(false)} className="btn-ghost" style={{ flex: 1, padding: "10px 16px", fontSize: 14 }}>
                        Cancel
                    </button>
                </div>
                {error && <p style={{ marginTop: 8, fontSize: 12, color: "var(--danger)" }}>{error}</p>}
            </div>
        );
    }

    return (
        <button onClick={() => setConfirming(true)} className="btn-danger" style={{ width: "100%" }}>
            Deactivate account
        </button>
    );
}
