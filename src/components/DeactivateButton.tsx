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
                <p className="text-sm text-red-400 mb-3 font-medium">
                    Are you sure? This will stop Mee from responding.
                </p>
                <div className="flex gap-2">
                    <button
                        onClick={handleDeactivate}
                        disabled={loading}
                        className="flex-1 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm transition-colors"
                    >
                        {loading ? "Deactivating..." : "Yes, deactivate"}
                    </button>
                    <button
                        onClick={() => setConfirming(false)}
                        className="flex-1 px-4 py-2 hover:bg-white/5 text-text-secondary rounded-lg text-sm transition-colors"
                    >
                        Cancel
                    </button>
                </div>
                {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            </div>
        );
    }

    return (
        <button
            onClick={() => setConfirming(true)}
            className="w-full px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium transition-colors"
        >
            Deactivate account
        </button>
    );
}
