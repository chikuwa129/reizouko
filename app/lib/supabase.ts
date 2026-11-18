import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// The client is created on first use, not when this file is imported.
// Creating it at import time made `next build` fail wherever the Supabase
// environment variables are missing (e.g. Vercel preview builds), because the
// build imports every route while collecting page data.
let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for this environment."
    );
  }
  client = createClient(url, anonKey);
  return client;
}

// Same API as before (`supabase.from(...)` etc.), resolved lazily.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const c = getClient();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
