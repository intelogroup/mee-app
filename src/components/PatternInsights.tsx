'use client';

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

interface PatternInsightsProps {
    traits: Trait[];
    memories: Memory[];
}

/**
 * PatternInsights — surfaces patterns from the user's trait data:
 * category distribution, strongest clusters, memory frequency, etc.
 */
export default function PatternInsights({ traits, memories }: PatternInsightsProps) {
    if (traits.length === 0 && memories.length === 0) return null;

    // Compute category distribution
    const catCounts: Record<string, number> = {};
    for (const t of traits) {
        const cat = t.category?.toLowerCase() || 'personality';
        catCounts[cat] = (catCounts[cat] || 0) + 1;
    }

    const totalTraits = traits.length;
    const dominantCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
    const categoryCount = Object.keys(catCounts).length;

    // Memory frequency (last 30 days vs older)
    const now = Date.now() / 1000;
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60;
    const recentMemories = memories.filter((m) => m.created_at > thirtyDaysAgo).length;
    const olderMemories = memories.length - recentMemories;

    const insights: Array<{ icon: string; title: string; detail: string }> = [];

    // Dominant category insight
    if (dominantCategory) {
        const pct = Math.round((dominantCategory[1] / totalTraits) * 100);
        insights.push({
            icon: '\uD83C\uDFAF',
            title: 'Dominant Pattern',
            detail: `${pct}% of your traits fall under "${dominantCategory[0]}". ${
                pct > 60
                    ? 'This heavy concentration suggests Mee knows you well in this area.'
                    : 'A balanced profile helps Mee coach across multiple dimensions.'
            }`,
        });
    }

    // Category breadth insight
    if (categoryCount >= 3) {
        insights.push({
            icon: '\uD83C\uDF10',
            title: 'Well-Rounded Profile',
            detail: `Your traits span ${categoryCount} categories. This gives Mee a holistic understanding of your personality, goals, and context.`,
        });
    } else if (categoryCount === 1 && totalTraits > 2) {
        insights.push({
            icon: '\uD83D\uDD0D',
            title: 'Narrow Focus',
            detail: `All ${totalTraits} traits are in one category. Try sharing about your goals, relationships, or location to give Mee a fuller picture.`,
        });
    }

    // Memory activity insight
    if (memories.length > 0) {
        insights.push({
            icon: '\uD83E\uDDE0',
            title: 'Memory Activity',
            detail: `${recentMemories} memories from the last 30 days${
                olderMemories > 0 ? `, ${olderMemories} older` : ''
            }. ${
                recentMemories > 5
                    ? 'Active engagement helps Mee stay calibrated to your current needs.'
                    : recentMemories === 0
                    ? 'No recent activity. A quick chat with Mee refreshes your coaching context.'
                    : 'Steady engagement keeps your coaching on track.'
            }`,
        });
    }

    // Trait volume insight
    if (totalTraits >= 10) {
        insights.push({
            icon: '\u2B50',
            title: 'Deep Profile',
            detail: `${totalTraits} active traits gives Mee strong signal about who you are. The more Mee knows, the more personalized coaching gets.`,
        });
    } else if (totalTraits >= 3) {
        insights.push({
            icon: '\uD83D\uDCC8',
            title: 'Growing Profile',
            detail: `${totalTraits} traits so far. Keep chatting with Mee to deepen your profile and unlock more nuanced coaching.`,
        });
    }

    if (insights.length === 0) return null;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse"></span>
                <h3 className="text-lg font-bold text-white tracking-tight">Pattern Insights</h3>
            </div>
            <p className="text-xs text-text-muted mb-4 max-w-lg">
                Patterns Mee has identified from your trait data and conversation history. These help guide coaching focus areas.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {insights.map((insight, idx) => (
                    <div
                        key={idx}
                        className="glass-card p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <div className="flex items-start gap-3">
                            <span className="text-xl flex-shrink-0 mt-0.5">{insight.icon}</span>
                            <div>
                                <h4 className="text-sm font-bold text-white mb-1">{insight.title}</h4>
                                <p className="text-xs text-text-secondary leading-relaxed">{insight.detail}</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Category Distribution Bar */}
            {totalTraits > 0 && (
                <div className="glass-card p-5 rounded-2xl border border-white/10 bg-white/5 mt-4">
                    <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-3">Category Distribution</h4>
                    <div className="flex rounded-full overflow-hidden h-3 bg-white/5">
                        {Object.entries(catCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([cat, count]) => {
                                const pct = (count / totalTraits) * 100;
                                const colors: Record<string, string> = {
                                    personality: 'bg-purple-500',
                                    location: 'bg-blue-500',
                                    goal: 'bg-red-400',
                                    relationship: 'bg-pink-500',
                                };
                                return (
                                    <div
                                        key={cat}
                                        className={`${colors[cat] || 'bg-gray-500'} transition-all`}
                                        style={{ width: `${pct}%` }}
                                        title={`${cat}: ${count} traits (${Math.round(pct)}%)`}
                                    />
                                );
                            })}
                    </div>
                    <div className="flex flex-wrap gap-4 mt-3">
                        {Object.entries(catCounts)
                            .sort((a, b) => b[1] - a[1])
                            .map(([cat, count]) => {
                                const colors: Record<string, string> = {
                                    personality: 'text-purple-400',
                                    location: 'text-blue-400',
                                    goal: 'text-red-400',
                                    relationship: 'text-pink-400',
                                };
                                return (
                                    <span key={cat} className={`text-[10px] font-medium ${colors[cat] || 'text-gray-400'}`}>
                                        {cat}: {count} ({Math.round((count / totalTraits) * 100)}%)
                                    </span>
                                );
                            })}
                    </div>
                </div>
            )}
        </div>
    );
}
