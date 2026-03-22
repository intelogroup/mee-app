'use client';

import { useMemo } from 'react';

interface Trait {
    id: string;
    text: string;
    category: string;
    score: number;
}

interface TraitConnectionGraphProps {
    traits: Trait[];
}

const CATEGORY_CONFIG: Record<string, { color: string; bgColor: string; borderColor: string; label: string }> = {
    personality: { color: '#a78bfa', bgColor: 'rgba(167,139,250,0.15)', borderColor: 'rgba(167,139,250,0.4)', label: 'Personality' },
    location: { color: '#60a5fa', bgColor: 'rgba(96,165,250,0.15)', borderColor: 'rgba(96,165,250,0.4)', label: 'Location' },
    goal: { color: '#f87171', bgColor: 'rgba(248,113,113,0.15)', borderColor: 'rgba(248,113,113,0.4)', label: 'Goals' },
    relationship: { color: '#f472b6', bgColor: 'rgba(244,114,182,0.15)', borderColor: 'rgba(244,114,182,0.4)', label: 'Relationships' },
};

interface NodePosition {
    x: number;
    y: number;
    trait: Trait;
}

/**
 * TraitConnectionGraph — visual knowledge graph showing how traits cluster by
 * category with connecting lines to a central "You" node.
 * Pure SVG, no external dependencies.
 */
export default function TraitConnectionGraph({ traits }: TraitConnectionGraphProps) {
    const { nodes, centerX, centerY, width, height } = useMemo(() => {
        const w = 700;
        const h = 420;
        const cx = w / 2;
        const cy = h / 2;

        const grouped: Record<string, Trait[]> = {};
        for (const t of traits) {
            const cat = t.category?.toLowerCase() || 'personality';
            const key = Object.keys(CATEGORY_CONFIG).includes(cat) ? cat : 'personality';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(t);
        }

        const categories = Object.keys(grouped);
        const positions: NodePosition[] = [];

        categories.forEach((cat, catIdx) => {
            const catTraits = grouped[cat];
            const angleOffset = (catIdx / categories.length) * Math.PI * 2 - Math.PI / 2;
            const catRadius = 140;

            // Place category cluster center
            const clusterCx = cx + Math.cos(angleOffset) * catRadius;
            const clusterCy = cy + Math.sin(angleOffset) * catRadius;

            catTraits.forEach((trait, i) => {
                const spread = Math.min(catTraits.length, 6);
                const traitAngle = angleOffset + ((i - (spread - 1) / 2) * 0.35);
                const traitRadius = 40 + (i % 2) * 25;
                positions.push({
                    x: clusterCx + Math.cos(traitAngle) * traitRadius,
                    y: clusterCy + Math.sin(traitAngle) * traitRadius,
                    trait,
                });
            });
        });

        return { nodes: positions, centerX: cx, centerY: cy, width: w, height: h };
    }, [traits]);

    if (traits.length === 0) {
        return (
            <div className="text-center py-12 text-text-muted text-sm">
                No traits yet. Chat with Mee on Telegram and your knowledge graph will appear here.
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                className="w-full max-w-3xl mx-auto"
                style={{ minHeight: 320 }}
            >
                <defs>
                    <radialGradient id="center-glow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(16,185,129,0.3)" />
                        <stop offset="100%" stopColor="rgba(16,185,129,0)" />
                    </radialGradient>
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                        <radialGradient key={key} id={`glow-${key}`} cx="50%" cy="50%" r="50%">
                            <stop offset="0%" stopColor={cfg.bgColor} />
                            <stop offset="100%" stopColor="transparent" />
                        </radialGradient>
                    ))}
                </defs>

                {/* Connection lines from center to each trait */}
                {nodes.map((node, i) => {
                    const cat = node.trait.category?.toLowerCase() || 'personality';
                    const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.personality;
                    return (
                        <line
                            key={`line-${i}`}
                            x1={centerX}
                            y1={centerY}
                            x2={node.x}
                            y2={node.y}
                            stroke={cfg.color}
                            strokeOpacity={0.15}
                            strokeWidth={1}
                        />
                    );
                })}

                {/* Center glow */}
                <circle cx={centerX} cy={centerY} r={50} fill="url(#center-glow)" />

                {/* Center node */}
                <circle cx={centerX} cy={centerY} r={22} fill="rgba(16,185,129,0.2)" stroke="rgba(16,185,129,0.6)" strokeWidth={2} />
                <text x={centerX} y={centerY + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={11} fontWeight={700}>
                    You
                </text>

                {/* Trait nodes */}
                {nodes.map((node, i) => {
                    const cat = node.trait.category?.toLowerCase() || 'personality';
                    const cfg = CATEGORY_CONFIG[cat] || CATEGORY_CONFIG.personality;
                    const label = node.trait.text.length > 22
                        ? node.trait.text.slice(0, 20) + '...'
                        : node.trait.text;

                    return (
                        <g key={`node-${i}`}>
                            <circle cx={node.x} cy={node.y} r={28} fill={`url(#glow-${cat})`} />
                            <circle cx={node.x} cy={node.y} r={6} fill={cfg.bgColor} stroke={cfg.borderColor} strokeWidth={1.5} />
                            <text
                                x={node.x}
                                y={node.y + 16}
                                textAnchor="middle"
                                fill={cfg.color}
                                fontSize={8}
                                fontWeight={500}
                                opacity={0.9}
                            >
                                {label}
                            </text>
                        </g>
                    );
                })}

                {/* Legend */}
                {Object.entries(CATEGORY_CONFIG).map(([, cfg], i) => (
                    <g key={`legend-${i}`} transform={`translate(16, ${height - 80 + i * 18})`}>
                        <circle cx={5} cy={0} r={4} fill={cfg.bgColor} stroke={cfg.borderColor} strokeWidth={1} />
                        <text x={14} y={1} fill={cfg.color} fontSize={9} dominantBaseline="middle" fontWeight={500}>
                            {cfg.label}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}
