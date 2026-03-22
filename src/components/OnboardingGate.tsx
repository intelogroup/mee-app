"use client";

interface OnboardingStep {
    label: string;
    description: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
    { label: "Link Telegram", description: "Connect your Telegram account to Mee" },
    { label: "Introduction", description: "Tell Mee a bit about yourself" },
    { label: "First Conversation", description: "Have your first coaching session" },
    { label: "Profile Built", description: "Mee builds your initial social profile" },
];

interface OnboardingGateProps {
    currentStep: number;
    deepLink: string;
    isLinked: boolean;
}

export default function OnboardingGate({ currentStep, deepLink, isLinked }: OnboardingGateProps) {
    const completedSteps = Math.min(currentStep, 4);

    return (
        <div className="max-w-2xl mx-auto py-16 px-6">
            <div className="glass-card p-10 rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-2xl shadow-2xl">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-accent/20 flex items-center justify-center border border-accent/30">
                        <svg className="w-8 h-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Complete Your Setup</h2>
                    <p className="text-sm text-text-secondary max-w-sm mx-auto">
                        Finish onboarding to unlock your full coaching dashboard. This only takes a few minutes.
                    </p>
                </div>

                {/* Progress bar */}
                <div className="mb-8">
                    <div className="flex justify-between text-xs text-text-muted mb-2">
                        <span>Progress</span>
                        <span>{completedSteps} of {ONBOARDING_STEPS.length}</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden border border-white/10">
                        <div
                            className="h-full bg-accent rounded-full transition-all duration-500"
                            style={{ width: `${(completedSteps / ONBOARDING_STEPS.length) * 100}%` }}
                        />
                    </div>
                </div>

                {/* Steps */}
                <div className="space-y-3 mb-10">
                    {ONBOARDING_STEPS.map((step, idx) => {
                        const isComplete = idx < completedSteps;
                        const isCurrent = idx === completedSteps;

                        return (
                            <div
                                key={step.label}
                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                                    isComplete
                                        ? "bg-accent/5 border-accent/20"
                                        : isCurrent
                                        ? "bg-white/5 border-accent/30 ring-1 ring-accent/20"
                                        : "bg-white/[0.02] border-white/5 opacity-50"
                                }`}
                            >
                                <div
                                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${
                                        isComplete
                                            ? "bg-accent text-white"
                                            : isCurrent
                                            ? "bg-accent/20 text-accent border border-accent/30"
                                            : "bg-white/5 text-text-muted border border-white/10"
                                    }`}
                                >
                                    {isComplete ? (
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        idx + 1
                                    )}
                                </div>
                                <div>
                                    <span className={`text-sm font-semibold ${isComplete ? "text-accent" : isCurrent ? "text-white" : "text-text-muted"}`}>
                                        {step.label}
                                    </span>
                                    <p className="text-xs text-text-muted mt-0.5">{step.description}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* CTA */}
                <div className="space-y-3">
                    {!isLinked ? (
                        <a
                            href={deepLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-accent text-white font-bold rounded-2xl hover:brightness-110 transition-all shadow-[0_8px_30px_rgba(16,185,129,0.2)] active:scale-[0.98] text-sm"
                        >
                            Open Telegram to Get Started
                        </a>
                    ) : (
                        <a
                            href={deepLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-accent text-white font-bold rounded-2xl hover:brightness-110 transition-all shadow-[0_8px_30px_rgba(16,185,129,0.2)] active:scale-[0.98] text-sm"
                        >
                            Continue in Telegram
                        </a>
                    )}
                    <p className="text-[10px] text-text-muted text-center">
                        Your dashboard will unlock automatically once onboarding is complete.
                    </p>
                </div>
            </div>
        </div>
    );
}
