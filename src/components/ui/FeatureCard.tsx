interface FeatureCardProps {
    icon: string;
    title: string;
    desc: string;
    delay?: string;
}

export default function FeatureCard({ icon, title, desc, delay }: FeatureCardProps) {
    return (
        <div
            className={`glass-card p-8 rounded-3xl transition-all duration-300 animate-fade-in-up ${delay} hover:border-white/20 hover:bg-white/10`}
        >
            <div className="mb-6 text-4xl opacity-80">{icon}</div>
            <h3 className="mb-3 text-xl font-bold tracking-tight text-white">
                {title}
            </h3>
            <p className="leading-relaxed text-text-secondary">
                {desc}
            </p>
        </div>
    );
}
