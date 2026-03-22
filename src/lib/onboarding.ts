import { supabaseAdmin } from "@/lib/supabase-admin";

export const ONBOARDING_REQUIRED_STEP = 4;

export interface OnboardingStatus {
    isComplete: boolean;
    currentStep: number;
    isLinked: boolean;
    deepLink: string;
}

/**
 * Check onboarding status for a user.
 * Returns whether onboarding is complete, and context needed for the gate.
 */
export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
    const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "YourBotName";
    const deepLink = `https://t.me/${botUsername}?start=${userId}`;

    const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("telegram_chat_id, onboarding_step")
        .eq("id", userId)
        .single();

    const currentStep = profile?.onboarding_step || 0;
    const isLinked = !!profile?.telegram_chat_id;
    const isComplete = currentStep >= ONBOARDING_REQUIRED_STEP;

    return { isComplete, currentStep, isLinked, deepLink };
}
