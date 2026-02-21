import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import BrainView from "@/components/BrainView";
import Link from "next/link";

export default async function BrainPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

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
                        Neural Interface
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

            <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
                <div className="mb-12">
                    <h1 className="text-4xl font-bold tracking-tight text-white mb-2">
                        The <span className="text-purple-400">Mirror</span>
                    </h1>
                    <p className="text-text-secondary text-sm max-w-xl">
                        Visualizing your digital twin's understanding of you. These traits and memories drive Mee's personality and responses.
                    </p>
                </div>

                <BrainView userId={user.id} />
            </div>
        </main>
    );
}
