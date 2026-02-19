import Link from "next/link";

export default function Navbar() {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass-panel">
            <div className="text-xl font-bold tracking-tight text-white">
                mee
            </div>

            <div className="flex items-center gap-4">
                <Link
                    href="/login"
                    className="text-sm font-medium text-text-secondary hover:text-white transition-colors"
                >
                    Sign in
                </Link>
                <Link
                    href="/signup"
                    className="px-4 py-2 text-sm font-semibold text-black transition-all transform bg-white rounded-full hover:bg-white/90 hover:scale-105 active:scale-95"
                >
                    Get started
                </Link>
            </div>
        </nav>
    );
}
