'use client';

import { useState, useEffect, useCallback } from 'react';
import TraitConnectionGraph from './TraitConnectionGraph';
import PatternInsights from './PatternInsights';

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

const CATEGORIES = ['personality', 'location', 'goal', 'relationship'] as const;

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
    location: 'Places you mention frequently — where you live, work, or spend time. Helps Mee give location-aware advice.',
    personality: 'Core personality traits Mee has picked up from your conversations — communication style, values, and tendencies.',
    goal: 'Active goals and aspirations you have shared. Mee uses these to keep coaching sessions focused on what matters to you.',
    relationship: 'Key people in your life that come up in conversations. Helps Mee understand your social context.',
};
type Category = typeof CATEGORIES[number];

export default function BrainView({ userId }: { userId: string }) {
    const [data, setData] = useState<BrainData | null>(null);
    const [loading, setLoading] = useState(true);
    const [editingTrait, setEditingTrait] = useState<Trait | null>(null);
    const [editText, setEditText] = useState('');
    const [editCategory, setEditCategory] = useState<string>('personality');
    const [isAdding, setIsAdding] = useState(false);
    const [addText, setAddText] = useState('');
    const [addCategory, setAddCategory] = useState<string>('personality');
    const [saving, setSaving] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            const res = await fetch(`/api/bot/brain?userId=${userId}`);
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch {
            // Fetch failed silently — UI shows fallback
        } finally {
            setLoading(false);
        }
    }, [userId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDelete = async (traitId: string) => {
        if (!confirm('Remove this trait?')) return;
        setSaving(true);
        try {
            const res = await fetch('/api/bot/brain', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ traitId }),
            });
            if (res.ok) {
                setData(prev => prev ? {
                    ...prev,
                    traits: prev.traits.filter(t => t.id !== traitId),
                } : prev);
            }
        } catch {
            // silent
        } finally {
            setSaving(false);
        }
    };

    const handleEditSave = async () => {
        if (!editingTrait || !editText.trim()) return;
        setSaving(true);
        try {
            const res = await fetch('/api/bot/brain', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    traitId: editingTrait.id,
                    text: editText.trim(),
                    category: editCategory,
                }),
            });
            if (res.ok) {
                setData(prev => prev ? {
                    ...prev,
                    traits: prev.traits.map(t =>
                        t.id === editingTrait.id
                            ? { ...t, text: editText.trim(), category: editCategory }
                            : t
                    ),
                } : prev);
                setEditingTrait(null);
            }
        } catch {
            // silent
        } finally {
            setSaving(false);
        }
    };

    const handleAdd = async () => {
        if (!addText.trim()) return;
        setSaving(true);
        try {
            const res = await fetch('/api/bot/brain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: addText.trim(),
                    category: addCategory,
                }),
            });
            if (res.ok) {
                const result = await res.json();
                setData(prev => prev ? {
                    ...prev,
                    traits: [...prev.traits, { id: result.id, text: addText.trim(), category: addCategory, score: 0 }],
                } : prev);
                setAddText('');
                setIsAdding(false);
            }
        } catch {
            // silent
        } finally {
            setSaving(false);
        }
    };

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
        if (!CATEGORIES.includes(cat as Category)) {
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

            {/* Knowledge Graph Visualization */}
            <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <span className="text-2xl">{'\uD83D\uDD78\uFE0F'}</span>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Knowledge Graph</h3>
                        <p className="text-[11px] text-text-muted">Visual map of how Mee understands you. Each node is a trait, colored by category and connected to you at the center.</p>
                    </div>
                </div>
                <TraitConnectionGraph traits={data.traits} />
            </div>

            {/* Pattern Insights */}
            <PatternInsights traits={data.traits} memories={data.memories} />

            {/* Add Trait Button */}
            <div className="flex justify-end">
                {isAdding ? (
                    <div className="flex items-center gap-2 glass-card p-3 rounded-xl border border-accent/30 bg-white/5">
                        <input
                            type="text"
                            value={addText}
                            onChange={(e) => setAddText(e.target.value)}
                            placeholder="New trait..."
                            className="bg-transparent border border-white/20 rounded-lg px-3 py-1.5 text-sm text-white placeholder-text-muted focus:outline-none focus:border-accent"
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                            autoFocus
                        />
                        <select
                            value={addCategory}
                            onChange={(e) => setAddCategory(e.target.value)}
                            className="bg-background border border-white/20 rounded-lg px-2 py-1.5 text-xs text-text-secondary"
                        >
                            {CATEGORIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <button onClick={handleAdd} disabled={saving || !addText.trim()} className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium disabled:opacity-50">
                            {saving ? '...' : 'Add'}
                        </button>
                        <button onClick={() => { setIsAdding(false); setAddText(''); }} className="px-2 py-1.5 text-text-muted text-xs hover:text-white">
                            Cancel
                        </button>
                    </div>
                ) : (
                    <button onClick={() => setIsAdding(true)} className="px-4 py-2 border border-white/10 hover:border-accent/50 rounded-xl text-xs font-medium text-text-secondary hover:text-white transition-colors">
                        + Add Trait
                    </button>
                )}
            </div>

            {/* Edit Modal */}
            {editingTrait && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditingTrait(null)}>
                    <div className="glass-card p-6 rounded-2xl border border-white/20 bg-background max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-white">Edit Trait</h3>
                        <input
                            type="text"
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full bg-transparent border border-white/20 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-accent"
                            onKeyDown={(e) => e.key === 'Enter' && handleEditSave()}
                            autoFocus
                        />
                        <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="w-full bg-background border border-white/20 rounded-lg px-4 py-2 text-sm text-text-secondary"
                        >
                            {CATEGORIES.map(c => (
                                <option key={c} value={c}>{c}</option>
                            ))}
                        </select>
                        <div className="flex justify-end gap-2 pt-2">
                            <button onClick={() => setEditingTrait(null)} className="px-4 py-2 text-text-muted text-sm hover:text-white">Cancel</button>
                            <button onClick={handleEditSave} disabled={saving || !editText.trim()} className="px-4 py-2 bg-accent text-white rounded-lg text-sm font-medium disabled:opacity-50">
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Main Bento Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <BentoCard title="Coordinates" icon="location" color="bg-blue-500/10 border-blue-500/20" description={CATEGORY_DESCRIPTIONS.location}>
                    <TraitList
                        traits={traitsByCategory['location']}
                        emptyMsg="No fixed location data."
                        onEdit={(t) => { setEditingTrait(t); setEditText(t.text); setEditCategory(t.category); }}
                        onDelete={handleDelete}
                    />
                </BentoCard>

                <BentoCard title="Firmware" icon="brain" color="bg-purple-500/10 border-purple-500/20" className="md:col-span-2" description={CATEGORY_DESCRIPTIONS.personality}>
                    <TraitList
                        traits={traitsByCategory['personality']}
                        emptyMsg="Personality profile building..."
                        onEdit={(t) => { setEditingTrait(t); setEditText(t.text); setEditCategory(t.category); }}
                        onDelete={handleDelete}
                    />
                </BentoCard>

                <BentoCard title="Directives" icon="target" color="bg-red-500/10 border-red-500/20" className="md:col-span-2" description={CATEGORY_DESCRIPTIONS.goal}>
                    <TraitList
                        traits={traitsByCategory['goal']}
                        emptyMsg="No active goals identified."
                        onEdit={(t) => { setEditingTrait(t); setEditText(t.text); setEditCategory(t.category); }}
                        onDelete={handleDelete}
                    />
                </BentoCard>

                <BentoCard title="Social Graph" icon="heart" color="bg-pink-500/10 border-pink-500/20" description={CATEGORY_DESCRIPTIONS.relationship}>
                    <TraitList
                        traits={traitsByCategory['relationship']}
                        emptyMsg="Social network mapping..."
                        onEdit={(t) => { setEditingTrait(t); setEditText(t.text); setEditCategory(t.category); }}
                        onDelete={handleDelete}
                    />
                </BentoCard>
            </div>

            {/* Memory Stream */}
            <div className="mt-12">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                    Memory Stream
                </h3>
                <p className="text-xs text-text-muted mb-6 max-w-lg">
                    Timestamped notes Mee has stored from your conversations. These help maintain context across sessions so coaching stays consistent.
                </p>
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

const ICON_MAP: Record<string, string> = {
    location: '\uD83D\uDCCD',
    brain: '\uD83E\uDDE0',
    target: '\uD83C\uDFAF',
    heart: '\u2764\uFE0F',
};

function BentoCard({ title, icon, children, color, className = "", description }: { title: string, icon: string, children: React.ReactNode, color: string, className?: string, description?: string }) {
    return (
        <div className={`glass-card p-6 rounded-3xl border ${color} backdrop-blur-xl bg-opacity-20 ${className}`}>
            <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{ICON_MAP[icon] || icon}</span>
                <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
            </div>
            {description && (
                <p className="text-[11px] text-text-muted leading-relaxed mb-5">{description}</p>
            )}
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

function TraitList({
    traits,
    emptyMsg,
    onEdit,
    onDelete,
}: {
    traits: Trait[] | undefined;
    emptyMsg: string;
    onEdit: (trait: Trait) => void;
    onDelete: (traitId: string) => void;
}) {
    if (!traits || traits.length === 0) {
        return <p className="text-xs text-text-muted italic">{emptyMsg}</p>;
    }
    return (
        <div className="flex flex-wrap gap-2">
            {traits.map((t, idx) => (
                <span
                    key={t.id || idx}
                    className="group relative px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-medium text-text-secondary transition-colors cursor-default"
                >
                    {t.text}
                    <span className="hidden group-hover:inline-flex items-center gap-1 ml-2">
                        <button
                            onClick={(e) => { e.stopPropagation(); onEdit(t); }}
                            className="text-accent hover:text-white text-[10px]"
                            title="Edit"
                        >
                            edit
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onDelete(t.id); }}
                            className="text-red-400 hover:text-red-300 text-[10px]"
                            title="Remove"
                        >
                            x
                        </button>
                    </span>
                </span>
            ))}
        </div>
    );
}
