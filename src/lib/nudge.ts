/**
 * Re-engagement nudge system.
 *
 * Defines the inactivity threshold, nudge templates, and logic for
 * determining which users should receive a re-engagement nudge.
 */

/** Number of days of inactivity before a nudge is sent */
export const INACTIVITY_THRESHOLD_DAYS = 7;

/** Nudge message templates — one is randomly selected per nudge */
export const NUDGE_TEMPLATES = [
    "Hey! It's been a while since we last chatted. How have things been going? I'm here whenever you're ready to talk.",
    "Hi there! I noticed we haven't connected in a bit. Wanted to check in — how are you feeling about your goals?",
    "It's been about a week since our last conversation. No pressure at all, but I'm here if you'd like to reflect on anything.",
    "Hey! Just a gentle nudge — I'd love to hear how things have been going since we last talked. What's on your mind?",
    "Hi! A week has flown by. Whenever you're ready, I'm here to help you keep the momentum going on your coaching journey.",
];

/**
 * Picks a random nudge template.
 */
export function pickNudgeTemplate(): string {
    const index = Math.floor(Math.random() * NUDGE_TEMPLATES.length);
    return NUDGE_TEMPLATES[index];
}

/**
 * Determines whether a user should receive a nudge based on their last interaction date.
 *
 * @param lastInteractionDate - ISO string or Date of the user's last interaction
 * @param nudgeEnabled - Whether the user has nudges enabled
 * @param now - Current date (injectable for testing)
 * @returns true if the user should receive a nudge
 */
export function shouldSendNudge(
    lastInteractionDate: string | Date | null,
    nudgeEnabled: boolean,
    now: Date = new Date()
): boolean {
    if (!nudgeEnabled) return false;
    if (!lastInteractionDate) return true; // never interacted → nudge

    const lastDate =
        typeof lastInteractionDate === "string"
            ? new Date(lastInteractionDate)
            : lastInteractionDate;

    if (isNaN(lastDate.getTime())) return false; // invalid date

    const diffMs = now.getTime() - lastDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= INACTIVITY_THRESHOLD_DAYS;
}

export interface NudgeCandidate {
    user_id: string;
    telegram_chat_id: string;
    last_interaction: string | null;
}

export interface NudgeResult {
    user_id: string;
    sent: boolean;
    message?: string;
    error?: string;
}

/**
 * Filters a list of users to find those who should receive nudges.
 *
 * @param candidates - Users with their last interaction dates
 * @param now - Current date (injectable for testing)
 * @returns Candidates who should receive a nudge
 */
export function filterNudgeCandidates(
    candidates: NudgeCandidate[],
    now: Date = new Date()
): NudgeCandidate[] {
    return candidates.filter((c) =>
        shouldSendNudge(c.last_interaction, true, now)
    );
}
