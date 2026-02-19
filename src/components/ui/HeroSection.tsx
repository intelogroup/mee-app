import Link from "next/link";

export default function HeroSection() {
    return (
        <section className="relative flex flex-col items-center justify-center min-h-screen px-4 pt-32 pb-16 overflow-hidden text-center">

            {/* Badge - Solid & Clean */}
            <div className="inline-flex items-center gap-2 px-3 py-1 mb-8 text-xs font-medium text-white/80 border border-white/10 rounded-full bg-white/5 backdrop-blur-md animate-fade-in-up">
                <span className="relative flex h-1.5 w-1.5">
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white"></span>
                </span>
                Now in early access
            </div>

            <h1 className="z-10 max-w-4xl mb-6 text-5xl font-bold tracking-tight md:text-7xl lg:text-8xl animate-fade-in-up animation-delay-150 text-white">
                An AI that actually <br />
                <span className="text-white/50">knows you</span>
            </h1>

            <p className="z-10 max-w-xl mb-10 text-lg md:text-xl text-text-secondary animate-fade-in-up animation-delay-300">
                Mee is your personal AI companion on Telegram. It remembers your
                preferences, learns your personality, and gets smarter with every
                conversation.
            </p>

            <div className="flex flex-col gap-4 sm:flex-row animate-fade-in-up animation-delay-450 z-10">
                <Link
                    href="/signup"
                    className="px-8 py-4 text-base font-semibold text-black transition-all transform bg-white rounded-xl hover:bg-white/90 hover:scale-105 active:scale-95 shadow-xl shadow-white/5"
                >
                    Start for free →
                </Link>
                <Link
                    href="/login"
                    className="px-8 py-4 text-base font-semibold text-white transition-all transform border border-white/10 bg-white/5 rounded-xl hover:bg-white/10 hover:border-white/20 backdrop-blur-md hover:scale-105 active:scale-95"
                >
                    Sign in
                </Link>
            </div>

            <div className="mt-12 text-sm text-text-muted animate-fade-in-up animation-delay-600">
                No credit card required · Works on any device · Private by design
            </div>
        </section>
    );
}
