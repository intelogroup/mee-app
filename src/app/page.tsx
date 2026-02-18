import Link from "next/link";
import { createClient } from "@/lib/supabase";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Ambient background blobs */}
      <div
        className="glow-blob"
        style={{
          width: 600,
          height: 600,
          background: "#7c3aed",
          top: -200,
          left: -100,
        }}
      />
      <div
        className="glow-blob"
        style={{
          width: 400,
          height: 400,
          background: "#2563eb",
          bottom: 100,
          right: -100,
        }}
      />

      {/* Navbar */}
      <nav
        style={{
          position: "relative",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 40px",
          borderBottom: "1px solid var(--border)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            fontSize: 22,
            fontWeight: 800,
            letterSpacing: "-0.03em",
          }}
        >
          <span className="gradient-text">mee</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/login" className="btn-ghost" style={{ padding: "9px 20px", fontSize: 14 }}>
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary" style={{ padding: "9px 20px", fontSize: 14 }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "80px 24px",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 14px",
            background: "rgba(124, 58, 237, 0.1)",
            border: "1px solid rgba(124, 58, 237, 0.25)",
            borderRadius: 20,
            fontSize: 13,
            color: "var(--accent-light)",
            marginBottom: 32,
            fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 16 }}>✦</span>
          Now in early access
        </div>

        <h1
          style={{
            fontSize: "clamp(48px, 8vw, 88px)",
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            maxWidth: 800,
            marginBottom: 24,
          }}
        >
          An AI that actually{" "}
          <span className="gradient-text">knows you</span>
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 2vw, 20px)",
            color: "var(--text-secondary)",
            maxWidth: 520,
            lineHeight: 1.7,
            marginBottom: 48,
          }}
        >
          Mee is your personal AI companion on Telegram. It remembers your
          preferences, learns your personality, and gets smarter with every
          conversation.
        </p>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href="/signup" className="btn-primary" style={{ fontSize: 16, padding: "14px 36px" }}>
            Start for free →
          </Link>
          <Link href="/login" className="btn-ghost" style={{ fontSize: 16, padding: "14px 36px" }}>
            Sign in
          </Link>
        </div>

        {/* Social proof */}
        <p style={{ marginTop: 32, fontSize: 13, color: "var(--text-muted)" }}>
          No credit card required · Works on any device · Private by design
        </p>
      </section>

      {/* Feature cards */}
      <section
        style={{
          position: "relative",
          zIndex: 1,
          padding: "0 24px 100px",
          maxWidth: 1100,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
          }}
        >
          {[
            {
              icon: "🧠",
              title: "Persistent Memory",
              desc: "Mee builds a rich model of who you are — your interests, habits, and goals — and uses it in every conversation.",
            },
            {
              icon: "🔒",
              title: "Privacy First",
              desc: "Your data is keyed to your unique ID, never sold, and you can deactivate at any time. You own your memory.",
            },
            {
              icon: "⚡",
              title: "Lives in Telegram",
              desc: "No new app to download. Mee lives in Telegram — the app you already use every day.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="glass-card"
              style={{ padding: 28 }}
            >
              <div style={{ fontSize: 32, marginBottom: 16 }}>{feature.icon}</div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  marginBottom: 10,
                  letterSpacing: "-0.02em",
                }}
              >
                {feature.title}
              </h3>
              <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
