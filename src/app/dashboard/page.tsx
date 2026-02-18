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
        color: { dark: "#f8fafc", light: "#111118" },
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
    const botApiUrl = process.env.BOT_BACKEND_API_URL;
    const botApiKey = process.env.BOT_BACKEND_API_KEY;
    if (!botApiUrl || !botApiKey) return [];
    try {
        const res = await fetch(`${botApiUrl}/users/${userId}/traits`, {
            headers: { Authorization: `Bearer ${botApiKey}` },
            next: { revalidate: 60 },
        });
        if (!res.ok) return [];
        const data = await res.json();
        return data.traits ?? [];
    } catch {
        return [];
    }
}

export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "YourBotName";
    const deepLink = `https://t.me/${botUsername}?start=${user.id}`;

    const [profile, qrDataUrl, traits] = await Promise.all([
        getProfile(user.id),
        getQRCode(deepLink),
        getTraits(user.id),
    ]);

    const isLinked = !!profile?.telegram_chat_id;
    const memberSince = user.created_at
        ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : "—";

    return (
        <main style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
            <div className="glow-blob" style={{ width: 500, height: 500, background: "#7c3aed", top: -200, right: -100 }} />
            <div className="glow-blob" style={{ width: 300, height: 300, background: "#0ea5e9", bottom: 0, left: -100 }} />

            {/* Navbar */}
            <nav style={{ position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 40px", borderBottom: "1px solid var(--border)", backdropFilter: "blur(12px)" }}>
                <Link href="/" style={{ fontSize: 22, fontWeight: 900, letterSpacing: "-0.04em", textDecoration: "none" }}>
                    <span className="gradient-text">mee</span>
                </Link>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{user.email}</span>
                    <form action={async () => {
                        "use server";
                        const supabase = await createClient();
                        await supabase.auth.signOut();
                        redirect("/");
                    }}>
                        <button type="submit" className="btn-ghost" style={{ padding: "8px 16px", fontSize: 13 }}>
                            Sign out
                        </button>
                    </form>
                </div>
            </nav>

            {/* Content */}
            <div style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
                <div style={{ marginBottom: 40 }}>
                    <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 8 }}>
                        Your Dashboard
                    </h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: 15 }}>Member since {memberSince}</p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
                    {/* Bot Card */}
                    <div className="glass-card" style={{ padding: 28 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                            <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em" }}>Your Mee Bot</h2>
                            <span className={`badge ${isLinked ? "badge-success" : "badge-warning"}`}>
                                <span className="badge-dot" />
                                {isLinked ? "Linked" : "Not linked"}
                            </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                            <div style={{ padding: 12, background: "#111118", borderRadius: 12, border: "1px solid var(--border)" }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={qrDataUrl} alt="Telegram bot QR code" width={180} height={180} style={{ display: "block", borderRadius: 6 }} />
                            </div>
                        </div>

                        <p style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center", marginBottom: 16, lineHeight: 1.6 }}>
                            Scan to open your personal Mee bot in Telegram
                        </p>

                        {/* Real-time bot link watcher */}
                        <BotStatusWatcher userId={user.id} initialLinked={isLinked} />

                        <a href={deepLink} target="_blank" rel="noopener noreferrer" className="btn-primary" style={{ width: "100%", fontSize: 14 }}>
                            <span>✈</span> Open in Telegram
                        </a>

                        <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11, color: "var(--text-muted)", wordBreak: "break-all", fontFamily: "monospace" }}>
                            {deepLink}
                        </div>
                    </div>

                    {/* Right column */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                        {/* Profile */}
                        <div className="glass-card" style={{ padding: 28 }}>
                            <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 16 }}>Profile</h2>
                            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                                {[
                                    { label: "Email", value: user.email },
                                    { label: "User ID", value: user.id, mono: true },
                                    { label: "Bot status", value: isLinked ? "Connected" : "Awaiting link", color: isLinked ? "var(--success)" : "var(--warning)" },
                                ].map((row, i) => (
                                    <div key={i}>
                                        {i > 0 && <div style={{ height: 1, background: "var(--border)", marginBottom: 12 }} />}
                                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{row.label}</span>
                                            <span style={{ fontSize: row.mono ? 11 : 13, color: row.color ?? "var(--text-secondary)", fontFamily: row.mono ? "monospace" : undefined, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {row.value}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Traits */}
                        <div className="glass-card" style={{ padding: 28 }}>
                            <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 16 }}>Your Traits</h2>
                            {traits.length > 0 ? (
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                                    {traits.map((trait) => (
                                        <span key={trait} style={{ padding: "5px 12px", background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 20, fontSize: 12, color: "var(--accent-light)", fontWeight: 500 }}>
                                            {trait}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.7 }}>
                                    {isLinked ? "Mee is still learning about you. Keep chatting!" : "Link your Telegram account to start building your profile."}
                                </p>
                            )}
                        </div>

                        {/* Danger zone */}
                        <div className="glass-card" style={{ padding: 24, border: "1px solid rgba(239,68,68,0.15)" }}>
                            <h2 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--danger)" }}>Danger Zone</h2>
                            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
                                Deactivating your account will stop Mee from responding. Your data is preserved.
                            </p>
                            <DeactivateButton />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
