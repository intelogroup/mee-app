import { createClient } from "@supabase/supabase-js";

// Admin client — uses service key, server-side only
// Used for privileged operations (e.g. reading profiles, deactivating users)
export const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    }
);
