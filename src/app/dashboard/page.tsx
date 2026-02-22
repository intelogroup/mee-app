import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import QRCode from "qrcode";
import DeactivateButton from "@/components/DeactivateButton";
import BotStatusWatcher from "@/components/BotStatusWatcher";
import Link from "next/link";


async function getQRCode(url: string): Promise<string> {
    return QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
    });
}

async function getProfile(userId: string) {
    console.log(`[Dashboard] Fetching profile for user: ${userId}`);
    const { data, error } = await supabaseAdmin
        .from("profiles")
        .select("telegram_chat_id, is_active, message_count, onboarding_step, bot_linked_at")
        .eq("id", userId)
        .single();
    if (error) console.error(`[Dashboard] Profile fetch error for ${userId}:`, error);
    return data;
}

async function getTraits(userId: string): Promise<string[]> {
    const botApiKey = process.env.BOT_BACKEND_API_KEY;
    const botApiUrl = process.env.BOT_BACKEND_API_URL || "https://mee-app-backend.onrender.com";

    console.log(`[Dashboard] Fetching traits for ${userId} from ${botApiUrl}`);
    if (!botApiKey) {
        console.warn("[Dashboard] Missing BOT_BACKEND_API_KEY");
        return [];
    }

    try {
        const res = await fetch(`${botApiUrl}/api/telegram/users/${userId}/traits`, {
            headers: { Authorization: `Bearer ${botApiKey}` },
            next: { revalidate: 60 },
        });
        if (!res.ok) {
            console.error(`[Dashboard] Traits API failed: ${res.status} ${res.statusText}`);
            return [];
        }
        const data = await res.json();
        console.log(`[Dashboard] Successfully fetched ${data.traits?.length ?? 0} traits for ${userId}`);
        return data.traits ?? [];
    } catch (error) {
        console.error("[Dashboard] Failed to fetch traits:", error);
        return [];
    }
}

export default async function DashboardPage() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const botUsername =
        process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "YourBotName";
    const deepLink = `https://t.me/${botUsername}?start=${user.id}`;

    console.log(`[Dashboard] Loading page data for user: ${user.id}`);
    const [profile, qrDataUrl, traits] = await Promise.all([
        getProfile(user.id),
        getQRCode(deepLink),
        getTraits(user.id),
    ]);
    console.log(`[Dashboard] Data load complete for ${user.id}. Linked: ${!!profile?.telegram_chat_id}`);

    const isLinked = !!profile?.telegram_chat_id;
    const messageCount = profile?.message_count || 0;
    const onboardingStep = profile?.onboarding_step || 0;
    const onboardingProgress = Math.min((onboardingStep / 4) * 100, 100);

    const memberSince = user.created_at
        ? new Date(user.created_at).toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
        })
        : "—";

    return (
        <main className="min-h-screen relative overflow-hidden bg-background text-text-primary">
            {/* Background Noise Texture */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none noise-bg"></div>

            {/* Navbar */}
            <nav className="relative z-10 flex items-center justify-between px-6 py-4 glass-panel border-b border-white/5">
                <Link
                    href="/"
                    className="text-2xl font-bold tracking-tight text-white hover:opacity-80 transition-opacity"
                >
                    mee
                </Link>
                <div className="flex items-center gap-4">
                    <span className="text-sm text-text-secondary hidden sm:inline-block">
                        {user.email}
                    </span>
                    <form
                        action={async () => {
                            "use server";
                            const supabase = await createClient();
                            await supabase.auth.signOut();
                            redirect("/");
                        }}
                    >
                        <button
                            type="submit"
                            className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-white transition-colors rounded-lg hover:bg-white/5"
                        >
                            Sign out
                        </button>
                    </form>
                </div>
            </nav>

            {/* Content */}
            <div className="relative z-10 max-w-6xl mx-auto px-6 py-12">
                <div className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight text-white mb-2">
                            Good day, <span className="text-accent">User</span>
                        </h1>
                        <p className="text-text-secondary text-sm flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                            Mee is online and ready to assist.
                        </p>
                    </div>

                    {/* Compact Profile Summary */}
                    <div className="flex items-center gap-4 bg-white/5 p-2 pr-6 rounded-2xl border border-white/10 backdrop-blur-md">
                        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center text-accent font-bold text-lg border border-accent/20">
                            {user.email?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-white truncate max-w-[150px]">
                                {user.email}
                            </span>
                            <span className="text-[10px] text-text-muted">
                                Member since {memberSince}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Stats Grid - High Impact */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                    <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5 relative overflow-hidden group hover:border-accent/30 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-12 h-12 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                            </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1 block">Interactions</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-white">{messageCount}</span>
                            <span className="text-xs text-accent font-medium">Messages</span>
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5 relative overflow-hidden group hover:border-accent/30 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-12 h-12 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1 block">Onboarding</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-black text-white">{onboardingProgress}%</span>
                            <span className="text-xs text-text-muted font-medium">Complete</span>
                        </div>
                    </div>

                    <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5 relative overflow-hidden group hover:border-accent/30 transition-all">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <svg className="w-12 h-12 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1 block">Status</span>
                        <div className="flex items-center gap-2">
                            <span className={`text-xl font-bold ${isLinked ? "text-accent" : "text-yellow-500"}`}>
                                {isLinked ? "Operational" : "Pending"}
                            </span>
                        </div>
                    </div>

                    <Link
                        href="/dashboard/brain"
                        className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5 relative overflow-hidden group hover:border-accent/30 transition-all text-center sm:text-left cursor-pointer"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                            <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </div>
                        <span className="text-[10px] uppercase tracking-widest text-text-muted font-bold mb-1 block">Memories</span>
                        <div className="flex items-baseline gap-2 justify-center sm:justify-start mb-4">
                            <span className="text-3xl font-black text-white">{traits.length}</span>
                            <span className="text-xs text-accent font-medium">Active Traits</span>
                        </div>
                        <div className="text-[10px] text-accent font-bold uppercase tracking-tighter py-1 px-2 bg-accent/10 rounded-md inline-block group-hover:bg-accent group-hover:text-white transition-all">
                            View Brain Interface
                        </div>
                    </Link>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Column: Bot Connection (4/12) */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="glass-card p-8 rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-2xl flex flex-col shadow-2xl relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/10 blur-[60px] -mr-16 -mt-16 rounded-full" />

                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-xl font-bold text-white tracking-tight">Your Mee Bot</h2>
                                <div className={`flex items-center gap-2 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-tighter border ${isLinked
                                    ? "bg-accent/10 text-accent border-accent/20"
                                    : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                    }`}>
                                    {isLinked ? "Connected" : "Action Required"}
                                </div>
                            </div>

                            <div className="flex justify-center mb-8">
                                <div className="p-4 bg-white rounded-2xl shadow-[0_0_40px_rgba(16,185,129,0.15)] relative group transition-transform hover:scale-105">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                        src={qrDataUrl}
                                        alt="Telegram bot QR code"
                                        className="block rounded-lg w-44 h-44 object-cover"
                                    />
                                    {!isLinked && (
                                        <div className="absolute inset-0 border-4 border-accent rounded-2xl animate-pulse pointer-events-none" />
                                    )}
                                </div>
                            </div>

                            <p className="text-xs text-text-muted text-center mb-8 leading-relaxed max-w-[220px] mx-auto">
                                {isLinked
                                    ? "Connected to your personal social co-pilot. Talk to Mee on Telegram to start evolving."
                                    : "Scan the secure code to link your account and start your social transformation."
                                }
                            </p>

                            <BotStatusWatcher userId={user.id} initialLinked={isLinked} />

                            <div className="mt-auto space-y-4">
                                <a
                                    href={deepLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-accent text-white font-bold rounded-2xl hover:brightness-110 transition-all shadow-[0_8px_30px_rgba(16,185,129,0.2)] active:scale-[0.98] text-sm group"
                                >
                                    <span>✈</span> Open Telegram <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">→</span>
                                </a>
                                <Link
                                    href="/dashboard/brain"
                                    className="flex items-center justify-center gap-3 w-full py-4 px-6 bg-white/5 text-white font-bold rounded-2xl border border-white/10 hover:bg-white/10 transition-all active:scale-[0.98] text-sm group"
                                >
                                    <span>🔮</span> The Mirror <span className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">→</span>
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Traits & Profile (8/12) */}
                    <div className="lg:col-span-8 flex flex-col gap-8">
                        {/* Traits Card */}
                        <div className="glass-card p-8 rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-2xl shadow-xl">
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-xl font-bold text-white tracking-tight">Social Identity</h2>
                                <span className="text-[10px] uppercase tracking-widest text-accent font-black">Distilled Facts</span>
                            </div>

                            {traits.length > 0 ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {traits.map((trait) => (
                                        <div
                                            key={trait}
                                            className="px-4 py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 group hover:bg-accent/5 hover:border-accent/20 transition-all"
                                        >
                                            <div className="w-1.5 h-1.5 rounded-full bg-accent group-hover:scale-150 transition-transform" />
                                            <span className="text-sm font-medium text-text-secondary group-hover:text-white transition-colors">
                                                {trait}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-12 text-center border-2 border-dashed border-white/5 rounded-3xl">
                                    <p className="text-sm text-text-muted leading-relaxed max-w-sm mx-auto">
                                        {isLinked
                                            ? "Mee hasn't distilled any traits yet. Keep chatting to build your profile."
                                            : "Link your account to unlock your personality profile."}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Bottom Info Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="glass-card p-8 rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl">
                                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white/40 mb-6">Security & Identity</h2>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-text-muted font-medium">Encrypted ID</span>
                                        <span className="text-[10px] text-text-secondary font-mono bg-black/30 px-2 py-1 rounded-md">
                                            {user.id.slice(0, 8)}...
                                        </span>
                                    </div>
                                    <div className="h-px bg-white/5" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-text-muted font-medium">Data Retention</span>
                                        <span className="text-[10px] text-accent font-bold px-2 py-1 bg-accent/10 rounded-md">
                                            30 DAYS (Active)
                                        </span>
                                    </div>
                                    <div className="h-px bg-white/5" />
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs text-text-muted font-medium">Node Status</span>
                                        <span className="flex items-center gap-1.5 text-[10px] text-green-500 font-bold uppercase">
                                            <span className="w-1 h-1 rounded-full bg-green-500 animate-ping" />
                                            Oregon-USA
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="glass-card p-8 rounded-[2rem] border border-red-500/10 bg-red-500/5 backdrop-blur-xl flex flex-col group hover:bg-red-500/10 transition-colors">
                                <h2 className="text-xs font-black uppercase tracking-[0.2em] text-red-500/60 mb-4">Memory Control</h2>
                                <p className="text-[11px] text-text-muted leading-relaxed mb-8">
                                    Stop Mee from analyzing your behavior. All future social coaching will be disabled.
                                    <span className="block mt-2 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity italic">Reversible action.</span>
                                </p>
                                <div className="mt-auto">
                                    <DeactivateButton />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
