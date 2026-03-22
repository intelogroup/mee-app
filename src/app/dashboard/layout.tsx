import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";

/**
 * Dashboard layout — ensures the user is authenticated.
 * Onboarding gating for sub-routes (/history, /brain) is handled by middleware.
 * The main /dashboard page renders the OnboardingGate UI inline.
 */
export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    return <>{children}</>;
}
