"use client";

import { useState, useEffect, useCallback } from "react";

const COMMUNICATION_STYLES = [
    { id: "direct", label: "Direct", desc: "Straightforward feedback, no sugar-coating" },
    { id: "gentle", label: "Gentle", desc: "Supportive and encouraging tone" },
    { id: "balanced", label: "Balanced", desc: "Mix of honest and supportive" },
    { id: "socratic", label: "Socratic", desc: "Guided self-discovery through questions" },
] as const;

const FOCUS_AREAS = [
    "Confidence",
    "Social Anxiety",
    "Conversation Skills",
    "Assertiveness",
    "Active Listening",
    "Empathy",
    "Conflict Resolution",
    "Networking",
    "Public Speaking",
    "Body Language",
    "Small Talk",
    "Emotional Intelligence",
] as const;

interface ProfileData {
    communication_style: string;
    coaching_focus: string[];
    display_name: string;
}

export default function ProfileEditor() {
    const [profile, setProfile] = useState<ProfileData>({
        communication_style: "balanced",
        coaching_focus: [],
        display_name: "",
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");

    useEffect(() => {
        fetch("/api/user/profile")
            .then((r) => r.json())
            .then((data) => {
                setProfile({
                    communication_style: data.communication_style || "balanced",
                    coaching_focus: data.coaching_focus || [],
                    display_name: data.display_name || "",
                });
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const save = useCallback(async (updated: ProfileData) => {
        setSaving(true);
        setSaveStatus("idle");
        try {
            const res = await fetch("/api/user/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updated),
            });
            if (res.ok) {
                setSaveStatus("saved");
                setTimeout(() => setSaveStatus("idle"), 2000);
            } else {
                setSaveStatus("error");
            }
        } catch {
            setSaveStatus("error");
        } finally {
            setSaving(false);
        }
    }, []);

    const toggleFocus = (area: string) => {
        const current = profile.coaching_focus;
        let updated: string[];
        if (current.includes(area)) {
            updated = current.filter((f) => f !== area);
        } else {
            if (current.length >= 5) return; // max 5
            updated = [...current, area];
        }
        const newProfile = { ...profile, coaching_focus: updated };
        setProfile(newProfile);
        save(newProfile);
    };

    const setStyle = (style: string) => {
        const newProfile = { ...profile, communication_style: style };
        setProfile(newProfile);
        save(newProfile);
    };

    const setDisplayName = (name: string) => {
        setProfile((p) => ({ ...p, display_name: name }));
    };

    const saveDisplayName = () => {
        save(profile);
    };

    if (loading) {
        return (
            <div className="space-y-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Save Indicator */}
            {saveStatus !== "idle" && (
                <div
                    className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-xl text-xs font-bold border backdrop-blur-md transition-all ${
                        saveStatus === "saved"
                            ? "bg-accent/10 text-accent border-accent/20"
                            : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}
                >
                    {saveStatus === "saved" ? "Saved" : "Failed to save"}
                </div>
            )}

            {/* Display Name */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/5">
                <h3 className="text-sm font-black uppercase tracking-[0.15em] text-white/40 mb-4">Display Name</h3>
                <div className="flex gap-3">
                    <input
                        type="text"
                        value={profile.display_name}
                        onChange={(e) => setDisplayName(e.target.value)}
                        onBlur={saveDisplayName}
                        onKeyDown={(e) => e.key === "Enter" && saveDisplayName()}
                        placeholder="How should Mee address you?"
                        maxLength={50}
                        className="flex-1 bg-transparent border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-text-muted outline-none focus:border-accent/50 transition-colors"
                    />
                </div>
                <p className="text-[10px] text-text-muted mt-2">This name will be used in coaching conversations.</p>
            </div>

            {/* Communication Style */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/5">
                <h3 className="text-sm font-black uppercase tracking-[0.15em] text-white/40 mb-4">Communication Style</h3>
                <p className="text-xs text-text-muted mb-4">Choose how Mee should communicate with you during coaching sessions.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {COMMUNICATION_STYLES.map((style) => (
                        <button
                            key={style.id}
                            onClick={() => setStyle(style.id)}
                            disabled={saving}
                            className={`text-left p-4 rounded-xl border transition-all ${
                                profile.communication_style === style.id
                                    ? "bg-accent/10 border-accent/30 ring-1 ring-accent/20"
                                    : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                            }`}
                        >
                            <span className={`text-sm font-bold ${
                                profile.communication_style === style.id ? "text-accent" : "text-white"
                            }`}>
                                {style.label}
                            </span>
                            <p className="text-[10px] text-text-muted mt-1">{style.desc}</p>
                        </button>
                    ))}
                </div>
            </div>

            {/* Coaching Focus Areas */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 bg-white/5">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-[0.15em] text-white/40">Coaching Focus Areas</h3>
                    <span className="text-[10px] text-text-muted">
                        {profile.coaching_focus.length}/5 selected
                    </span>
                </div>
                <p className="text-xs text-text-muted mb-4">
                    Select up to 5 areas you want Mee to focus on. These guide your coaching conversations.
                </p>
                <div className="flex flex-wrap gap-2">
                    {FOCUS_AREAS.map((area) => {
                        const selected = profile.coaching_focus.includes(area);
                        const atMax = profile.coaching_focus.length >= 5 && !selected;
                        return (
                            <button
                                key={area}
                                onClick={() => toggleFocus(area)}
                                disabled={saving || atMax}
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                    selected
                                        ? "bg-accent/10 text-accent border-accent/30"
                                        : atMax
                                            ? "bg-white/5 text-text-muted border-white/5 opacity-50 cursor-not-allowed"
                                            : "bg-white/5 text-text-secondary border-white/10 hover:bg-white/10 hover:border-white/20"
                                }`}
                            >
                                {selected && <span className="mr-1">&#10003;</span>}
                                {area}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
