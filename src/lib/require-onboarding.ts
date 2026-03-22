import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { getOnboardingStatus } from "@/lib/onboarding";

/**
 * Server-side guard: checks onboarding status and redirects to dashboard
 * if onboarding is not complete. Used to gate sub-routes like /history and /brain.
 *
 * Usage: Call at the top of any server page that requires completed onboarding.
 * Returns the authenticated user object if onboarding is complete, or redirects otherwise.
 */
export async function requireOnboardingComplete() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const status = await getOnboardingStatus(user.id);

    if (!status.isComplete) {
        redirect("/dashboard");
    }

    return user;
}
