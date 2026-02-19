"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase-browser";

interface BotStatusProps {
    userId: string;
    initialLinked: boolean;
}

export default function BotStatusWatcher({ userId, initialLinked }: BotStatusProps) {
    const [isLinked, setIsLinked] = useState(initialLinked);
    const [justLinked, setJustLinked] = useState(false);

    useEffect(() => {
        if (initialLinked) return; // Already linked, no need to watch

        const supabase = createClient();

        const channel = supabase
            .channel(`profile:${userId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "profiles",
                    filter: `id=eq.${userId}`,
                },
                (payload) => {
                    const newRecord = payload.new as { telegram_chat_id: number | null };
                    if (newRecord.telegram_chat_id) {
                        setIsLinked(true);
                        setJustLinked(true);
                        // Refresh the page after a short delay to update QR/link status
                        setTimeout(() => window.location.reload(), 2000);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [userId, initialLinked]);

    if (!isLinked && !justLinked) {
        return (
            <div className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-sm">
                <span className="text-base">⏳</span>
                <span>Waiting for you to open the bot in Telegram...</span>
                <span className="ml-auto inline-block w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            </div>
        );
    }

    if (justLinked) {
        return (
            <div className="flex items-center gap-3 p-3 mb-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 text-sm">
                <span className="text-base">🎉</span>
                <span>Bot linked! Refreshing your dashboard...</span>
            </div>
        );
    }

    return null;
}
