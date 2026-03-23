"use client";

import { useState, useEffect, useCallback } from "react";

interface ReferralData {
    referral_code: string;
    referral_count: number;
}

export default function ReferralCard() {
    const [data, setData] = useState<ReferralData | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchReferral = useCallback(async () => {
        try {
            const res = await fetch("/api/user/referral");
            if (!res.ok) throw new Error("Failed to load referral data");
            const json = await res.json();
            setData(json);
        } catch {
            setError("Could not load your referral link. Try refreshing.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchReferral();
    }, [fetchReferral]);

    const referralUrl =
        data
            ? `${typeof window !== "undefined" ? window.location.origin : ""}/signup?ref=${data.referral_code}`
            : "";

    const handleCopy = async () => {
        if (!referralUrl) return;
        try {
            await navigator.clipboard.writeText(referralUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Fallback: select the input
        }
    };

    const handleShare = async () => {
        if (!referralUrl) return;
        if (navigator.share) {
            await navigator.share({
                title: "Join me on Mee",
                text: "I've been using Mee for social coaching — it's genuinely helpful. Join with my link:",
                url: referralUrl,
            });
        } else {
            await handleCopy();
        }
    };

    if (loading) {
        return (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 animate-pulse">
                <div className="h-5 bg-white/10 rounded w-1/3 mb-4" />
                <div className="h-10 bg-white/10 rounded" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <p className="text-red-400 text-sm">{error}</p>
            </div>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            {/* Stats */}
            <div className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">
                    Friends invited
                </span>
                <span className="text-lg font-bold text-white">
                    {data?.referral_count ?? 0}
                </span>
            </div>

            {/* Link display */}
            <div className="flex items-center gap-2">
                <input
                    readOnly
                    value={referralUrl}
                    aria-label="Referral link"
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-text-secondary font-mono truncate outline-none focus:border-accent"
                />
                <button
                    onClick={handleCopy}
                    className="px-3 py-2 text-sm font-medium rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors whitespace-nowrap"
                    aria-label={copied ? "Copied" : "Copy link"}
                >
                    {copied ? "Copied!" : "Copy"}
                </button>
            </div>

            {/* Share button */}
            <button
                onClick={handleShare}
                className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-accent text-background hover:opacity-90 transition-opacity"
            >
                Share invite link
            </button>
        </div>
    );
}
