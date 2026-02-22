'use client';

import { useState, useEffect } from 'react';

interface Trait {
    id: string;
    text: string;
    category: string;
    score: number;
}

interface Memory {
    id: string;
    text: string;
    created_at: number;
}

interface BrainData {
    profile: any;
    traits: Trait[];
    memories: Memory[];
}

export default function BrainView({ userId }: { userId: string }) {
    const [data, setData] = useState<BrainData | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'memories'>('overview');

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Use the backend API directly via proxy or direct fetch
                // For now, assuming we can fetch from the backend if CORS allows or via Next.js API route
                // Let's use the pattern from dashboard page but client-side? 
                // Actually, client-side fetch to external backend might have CORS issues if not configured.
                // Better to fetch via a Next.js API route that proxies to the Python backend.
                // But for MVP, let's assume the backend URL is public or we use a server action.
                
                // For this implementation, I'll fetch from a new Next.js API route I'll create: /api/proxy/brain
                const res = await fetch(`/api/bot/brain?userId=${userId}`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json);
                }
            } catch (e) {
                console.error("Failed to fetch brain data", e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [userId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent"></div>
            </div>
        );
    }

    if (!data) return <div className="text-text-muted">Failed to load neural data.</div>;

    const traitsByCategory = data.traits.reduce((acc, trait) => {
        let cat = trait.category ? trait.category.toLowerCase() : 'personality';
        
        // Map common variations or missing cats to the 4 main buckets
        if (!['location', 'personality', 'goal', 'relationship'].includes(cat)) {
            cat = 'personality'; // Fallback for 'general', 'N/A', etc.
        }
        
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(trait);
        return acc;
    }, {} as Record<string, Trait[]>);

    return (
        <div className="space-y-8">
            {/* Header Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Sync Level" value="4" sub="High Fidelity" color="text-accent" />
                <StatCard label="Neural Load" value={data.traits.length.toString()} sub="Active Traits" color="text-purple-400" />
                <StatCard label="Episodic Depth" value={data.memories.length.toString()} sub="Memories" color="text-blue-400" />
                <StatCard label="Last Sync" value="Just now" sub="Real-time" color="text-green-400" />
            </div>

            {/* Main Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 📍 Coordinates (Location) */}
                <BentoCard title="Coordinates" icon="📍" color="bg-blue-500/10 border-blue-500/20">
                    <TraitList traits={traitsByCategory['location']} emptyMsg="No fixed location data." />
                </BentoCard>

                {/* 🧠 Firmware (Personality) */}
                <BentoCard title="Firmware" icon="🧠" color="bg-purple-500/10 border-purple-500/20" className="md:col-span-2">
                    <TraitList traits={traitsByCategory['personality']} emptyMsg="Personality profile building..." />
                </BentoCard>

                {/* 🎯 Directives (Goals) */}
                <BentoCard title="Directives" icon="🎯" color="bg-red-500/10 border-red-500/20" className="md:col-span-2">
                    <TraitList traits={traitsByCategory['goal']} emptyMsg="No active goals identified." />
                </BentoCard>

                {/* ❤️ Social Graph */}
                <BentoCard title="Social Graph" icon="❤️" color="bg-pink-500/10 border-pink-500/20">
                    <TraitList traits={traitsByCategory['relationship']} emptyMsg="Social network mapping..." />
                </BentoCard>
            </div>

            {/* Memory Stream */}
            <div className="mt-12">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                    Memory Stream
                </h3>
                <div className="space-y-4 relative border-l-2 border-white/10 ml-3 pl-8 pb-4">
                    {data.memories.map((mem) => (
                        <div key={mem.id} className="relative">
                            <div className="absolute -left-[37px] top-2 w-4 h-4 rounded-full bg-background border-2 border-white/20"></div>
                            <div className="glass-card p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors">
                                <span className="text-[10px] text-text-muted font-mono block mb-2">
                                    {new Date(mem.created_at * 1000).toLocaleString()}
                                </span>
                                <p className="text-sm text-text-secondary leading-relaxed">
                                    {mem.text}
                                </p>
                            </div>
                        </div>
                    ))}
                    {data.memories.length === 0 && (
                        <p className="text-text-muted italic">No episodic memories yet.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function BentoCard({ title, icon, children, color, className = "" }: { title: string, icon: string, children: React.ReactNode, color: string, className?: string }) {
    return (
        <div className={`glass-card p-6 rounded-3xl border ${color} backdrop-blur-xl bg-opacity-20 ${className}`}>
            <div className="flex items-center gap-3 mb-6">
                <span className="text-2xl">{icon}</span>
                <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
            </div>
            {children}
        </div>
    );
}

function StatCard({ label, value, sub, color }: { label: string, value: string, sub: string, color: string }) {
    return (
        <div className="glass-card p-4 rounded-2xl border border-white/10 bg-white/5">
            <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold block mb-1">{label}</span>
            <div className={`text-2xl font-black ${color}`}>{value}</div>
            <span className="text-[10px] text-text-secondary">{sub}</span>
        </div>
    );
}

function TraitList({ traits, emptyMsg }: { traits: Trait[] | undefined, emptyMsg: string }) {
    if (!traits || traits.length === 0) {
        return <p className="text-xs text-text-muted italic">{emptyMsg}</p>;
    }
    return (
        <div className="flex flex-wrap gap-2">
            {traits.map((t, idx) => (
                <span key={t.id || idx} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-text-secondary transition-colors cursor-default">
                    {t.text}
                </span>
            ))}
        </div>
    );
}
