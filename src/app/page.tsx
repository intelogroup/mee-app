import { createClient } from "@/lib/supabase";
import { redirect } from "next/navigation";
import Navbar from "@/components/ui/Navbar";
import HeroSection from "@/components/ui/HeroSection";
import FeatureCard from "@/components/ui/FeatureCard";

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-background selection:bg-brand-primary/30 text-text-primary">
      <Navbar />

      <HeroSection />

      {/* Features Section */}
      <section className="relative px-6 pb-32 mx-auto max-w-7xl">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <FeatureCard
            icon="🧠"
            title="Persistent Memory"
            desc="Mee builds a rich model of who you are — your interests, habits, and goals — and uses it in every conversation."
            delay="animation-delay-150"
          />
          <FeatureCard
            icon="🔒"
            title="Privacy First"
            desc="Your data is keyed to your unique ID, never sold, and you can deactivate at any time. You own your memory."
            delay="animation-delay-300"
          />
          <FeatureCard
            icon="⚡"
            title="Lives in Telegram"
            desc="No new app to download. Mee lives in Telegram — the app you already use every day."
            delay="animation-delay-450"
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 text-center border-t border-white/5 bg-black/20 text-text-muted text-sm">
        <p>&copy; {new Date().getFullYear()} Mee. All rights reserved.</p>
      </footer>
    </main>
  );
}
