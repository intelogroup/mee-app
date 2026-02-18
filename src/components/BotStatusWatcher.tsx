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
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    background: "rgba(234,179,8,0.08)",
                    border: "1px solid rgba(234,179,8,0.2)",
                    borderRadius: 10,
                    fontSize: 13,
                    color: "var(--warning)",
                    marginBottom: 16,
                }}
            >
                <span style={{ fontSize: 16 }}>⏳</span>
                <span>Waiting for you to open the bot in Telegram…</span>
                <span
                    style={{
                        display: "inline-block",
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--warning)",
                        animation: "pulse 1.5s ease-in-out infinite",
                        marginLeft: "auto",
                    }}
                />
            </div>
        );
    }

    if (justLinked) {
        return (
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    background: "rgba(34,197,94,0.08)",
                    border: "1px solid rgba(34,197,94,0.2)",
                    borderRadius: 10,
                    fontSize: 13,
                    color: "var(--success)",
                    marginBottom: 16,
                }}
            >
                <span style={{ fontSize: 16 }}>🎉</span>
                <span>Bot linked! Refreshing your dashboard…</span>
            </div>
        );
    }

    return null;
}
