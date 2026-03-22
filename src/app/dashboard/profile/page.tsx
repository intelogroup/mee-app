import { requireOnboardingComplete } from "@/lib/require-onboarding";
import ProfileEditor from "@/components/ProfileEditor";
import Link from "next/link";

export default async function ProfilePage() {
    const user = await requireOnboardingComplete();

    return (
        <main className="min-h-screen relative overflow-hidden bg-background text-text-primary">
            {/* Background Noise Texture */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none noise-bg"></div>

            {/* Navbar */}
            <nav className="relative z-10 flex items-center justify-between px-6 py-4 glass-panel border-b border-white/5">
                <div className="flex items-center gap-6">
                    <Link
                        href="/"
                        className="text-2xl font-bold tracking-tight text-white hover:opacity-80 transition-opacity"
                    >
                        mee
                    </Link>
                    <div className="h-6 w-px bg-white/10 hidden sm:block"></div>
                    <Link
                        href="/dashboard"
                        className="text-sm font-medium text-text-muted hover:text-white transition-colors hidden sm:block"
                    >
                        Dashboard
                    </Link>
                    <span className="text-sm font-medium text-white bg-white/10 px-3 py-1 rounded-full">
                        Profile Editor
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-sm text-text-secondary hidden sm:inline-block">
                        {user.email}
                    </span>
                    <Link
                        href="/dashboard"
                        className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors rounded-lg hover:bg-white/5"
                    >
                        Back
                    </Link>
                </div>
            </nav>

            <div className="relative z-10 max-w-3xl mx-auto px-6 py-12">
                <div className="mb-12">
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-2">
                        Your <span className="text-accent">Profile</span>
                    </h1>
                    <p className="text-text-secondary text-sm max-w-xl">
                        Customize how Mee coaches you. Set your preferred communication style,
                        choose focus areas, and manage the traits Mee has learned about you.
                    </p>
                </div>

                <ProfileEditor />

                {/* Link to Brain for trait management */}
                <div className="mt-8 glass-card p-6 rounded-2xl border border-white/10 bg-white/5">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-white mb-1">Personality Traits</h3>
                            <p className="text-xs text-text-muted">
                                View and edit the traits Mee has inferred from your conversations.
                            </p>
                        </div>
                        <Link
                            href="/dashboard/brain"
                            className="px-4 py-2 bg-accent/10 text-accent text-xs font-bold rounded-xl border border-accent/20 hover:bg-accent hover:text-white transition-all"
                        >
                            Edit Traits
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    );
}
