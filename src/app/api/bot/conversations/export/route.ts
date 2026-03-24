import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";

function getBackendConfig() {
    const botApiUrl = (
        process.env.BOT_BACKEND_API_URL ||
        "https://mee-app-backend.onrender.com"
    ).replace(/\/$/, "");
    const botApiKey = process.env.BOT_BACKEND_API_KEY;
    return { botApiUrl, botApiKey };
}

async function getAuthenticatedUser() {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    return user;
}

function formatMessagesToMarkdown(sessions: Session[], userEmail: string): string {
    const lines: string[] = [];
    const exportDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    lines.push("# Mee Coaching History");
    lines.push("");
    lines.push(`**Exported:** ${exportDate}`);
    lines.push(`**Account:** ${userEmail}`);
    lines.push("");
    lines.push("---");
    lines.push("");

    if (sessions.length === 0) {
        lines.push("No conversation history found.");
        return lines.join("\n");
    }

    sessions.forEach((session, idx) => {
        const sessionDate = new Date(session.started_at).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
        const startTime = new Date(session.started_at).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
        });
        const endTime = session.ended_at
            ? new Date(session.ended_at).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
              })
            : "";

        lines.push(`## Session ${idx + 1} — ${sessionDate}`);
        lines.push("");
        lines.push(
            `**Time:** ${startTime}${endTime ? ` – ${endTime}` : ""}  |  **Messages:** ${session.message_count}`
        );

        if (session.tags && session.tags.length > 0) {
            lines.push(`**Topics:** ${session.tags.join(", ")}`);
        }

        if (session.summary) {
            lines.push("");
            lines.push(`> ${session.summary}`);
        }

        lines.push("");

        if (session.messages && session.messages.length > 0) {
            session.messages.forEach((msg) => {
                const speaker = msg.role === "user" ? "**You**" : "**Mee**";
                const time = new Date(msg.created_at).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                });
                lines.push(`${speaker} _(${time})_`);
                lines.push("");
                lines.push(msg.content);
                lines.push("");
            });
        }

        lines.push("---");
        lines.push("");
    });

    return lines.join("\n");
}

interface Message {
    id: string;
    role: "user" | "assistant";
    content: string;
    created_at: string;
}

interface Session {
    started_at: string;
    ended_at: string;
    message_count: number;
    summary: string;
    tags?: string[];
    messages: Message[];
}

/**
 * GET /api/bot/conversations/export
 * Returns the user's conversation history as a markdown file download.
 * Query params:
 *   format=markdown (default) | format=json
 */
export async function GET(request: Request) {
    const user = await getAuthenticatedUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "markdown";

    if (format !== "markdown" && format !== "json") {
        return NextResponse.json(
            { error: "Invalid format. Use 'markdown' or 'json'." },
            { status: 400 }
        );
    }

    const { botApiUrl, botApiKey } = getBackendConfig();

    if (!botApiKey) {
        return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        // Fetch up to 200 messages for export
        const targetUrl = `${botApiUrl}/api/dashboard/conversations/${user.id}?limit=200&offset=0`;
        const res = await fetch(targetUrl, {
            headers: {
                Authorization: `Bearer ${botApiKey}`,
                "User-Agent": "Mee-App-Proxy/1.0",
            },
            signal: controller.signal,
            next: { revalidate: 0 },
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            return NextResponse.json(
                { error: "Backend error", status: res.status },
                { status: res.status }
            );
        }

        const data = await res.json();
        const sessions: Session[] = data.sessions ?? [];
        const exportDate = new Date().toISOString().slice(0, 10);
        const filename = `mee-coaching-history-${exportDate}`;

        if (format === "json") {
            return new NextResponse(JSON.stringify(data, null, 2), {
                status: 200,
                headers: {
                    "Content-Type": "application/json",
                    "Content-Disposition": `attachment; filename="${filename}.json"`,
                },
            });
        }

        // markdown
        const markdown = formatMessagesToMarkdown(sessions, user.email ?? "");
        return new NextResponse(markdown, {
            status: 200,
            headers: {
                "Content-Type": "text/markdown; charset=utf-8",
                "Content-Disposition": `attachment; filename="${filename}.md"`,
            },
        });
    } catch (error: unknown) {
        const err = error as Error;
        return NextResponse.json(
            {
                error: "Connection failed",
                message:
                    err.name === "AbortError" ? "Timeout" : "Backend unavailable",
            },
            { status: 502 }
        );
    }
}
