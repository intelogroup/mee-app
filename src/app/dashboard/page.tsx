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
    const { data } = await supabaseAdmin
        .from("profiles")
        .select("telegram_chat_id, is_active")
        .eq("id", userId)
        .single();
    return data;
}



async function getTraits(userId: string): Promise<string[]> {
    const botApiKey = process.env.BOT_BACKEND_API_KEY;
    // Use the backend URL directly if possible, or fallback gracefully
    const botApiUrl = process.env.BOT_BACKEND_API_URL || "https://mee-app-backend.onrender.com";

    if (!botApiKey) return [];
    try {
        const res = await fetch(`${botApiUrl}/api/telegram/users/${userId}/traits`, {
            headers: { Authorization: `Bearer ${botApiKey}` },
            next: { revalidate: 60 },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.traits ?? [];
    } catch (error) {
        console.error("Failed to fetch traits:", error);
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

    const [profile, qrDataUrl, traits] = await Promise.all([
        getProfile(user.id),
        getQRCode(deepLink),
        getTraits(user.id),
    ]);

    const isLinked = !!profile?.telegram_chat_id;
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
            <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">
                <div className="mb-10">
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
                        Your Dashboard
                    </h1>
                    <p className="text-text-secondary text-sm">
                        Member since {memberSince}
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* Bot Card */}
                    <div className="glass-card p-6 md:p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl flex flex-col h-full">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-bold tracking-tight text-white">
                                Your Mee Bot
                            </h2>
                            <span
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${isLinked
                                    ? "bg-green-500/10 text-green-500 border-green-500/20"
                                    : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                                    }`}
                            >
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${isLinked ? "bg-green-500" : "bg-yellow-500"
                                        }`}
                                />
                                {isLinked ? "Linked" : "Not linked"}
                            </span>
                        </div>

                        <div className="flex justify-center mb-6">
                            <div className="p-3 bg-white rounded-xl shadow-lg">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={qrDataUrl}
                                    alt="Telegram bot QR code"
                                    className="block rounded-lg w-40 h-40 object-cover"
                                />
                            </div>
                        </div>

                        <p className="text-xs text-text-muted text-center mb-6 leading-relaxed">
                            Scan to open your personal Mee bot in Telegram, or click the
                            button below.
                        </p>

                        {/* Real-time bot link watcher */}
                        <BotStatusWatcher userId={user.id} initialLinked={isLinked} />

                        <div className="mt-auto">
                            <a
                                href={deepLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-white text-black font-semibold rounded-xl hover:bg-white/90 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-white/5 text-sm"
                            >
                                <span>✈</span> Open in Telegram
                            </a>

                            <div className="mt-4 p-3 bg-black/20 rounded-lg border border-white/5 text-[10px] text-text-muted font-mono break-all text-center select-all">
                                {deepLink}
                            </div>
                        </div>
                    </div>

                    {/* Right column (spans 2 columns on large screens if needed, otherwise distinct) */}
                    <div className="lg:col-span-2 flex flex-col gap-6">
                        {/* Traits */}
                        <div className="glass-card p-6 md:p-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl">
                            <h2 className="text-lg font-bold tracking-tight text-white mb-4">
                                Your Traits
                            </h2>
                            {traits.length > 0 ? (
                                <div className="flex flex-wrap gap-2">
                                    {traits.map((trait) => (
                                        <span
                                            key={trait}
                                            className="px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full text-xs font-medium text-violet-400"
                                        >
                                            {trait}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-text-muted leading-relaxed">
                                    {isLinked
                                        ? "Mee is still learning about you. Keep chatting to unlock your personality traits!"
                                        : "Link your Telegram account to start building your unique profile."}
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
                            {/* Profile */}
                            <div className="glass-card p-6 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl h-full">
                                <h2 className="text-lg font-bold tracking-tight text-white mb-4">
                                    Profile
                                </h2>
                                <div className="space-y-4">
                                    <div>
                                        <span className="block text-xs text-text-muted mb-1">
                                            Email
                                        </span>
                                        <span className="text-sm text-white font-medium">
                                            {user.email}
                                        </span>
                                    </div>
                                    <div className="h-px bg-white/5" />
                                    <div>
                                        <span className="block text-xs text-text-muted mb-1">
                                            User ID
                                        </span>
                                        <span className="text-xs text-text-secondary font-mono">
                                            {user.id}
                                        </span>
                                    </div>
                                    <div className="h-px bg-white/5" />
                                    <div>
                                        <span className="block text-xs text-text-muted mb-1">
                                            Status
                                        </span>
                                        <span
                                            className={`text-sm font-medium ${isLinked ? "text-green-500" : "text-yellow-500"
                                                }`}
                                        >
                                            {isLinked ? "Connected" : "Awaiting link"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Danger Connect - using slightly different style */}
                            <div className="glass-card p-6 rounded-3xl border border-red-500/10 bg-red-500/5 backdrop-blur-xl h-full flex flex-col">
                                <h2 className="text-sm font-bold tracking-tight text-red-500 mb-2">
                                    Danger Zone
                                </h2>
                                <p className="text-xs text-text-muted leading-relaxed mb-6">
                                    Deactivating your account will stop Mee from responding. Your
                                    data is preserved.
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
