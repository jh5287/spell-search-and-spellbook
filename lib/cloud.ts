import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CloudError, type CloudApi } from "./sync";

// Next.js swaps these in at build time, so they have to be written out in full like this.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Accounts only appear once the two Supabase settings exist; without them the app works as it always did. */
export const cloudConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** The anon key is meant to be public. What each person can read or change is limited by the row-level
 *  security rules in supabase/schema.sql, not by keeping the key secret. */
export function supabase(): SupabaseClient {
  if (!url || !anonKey) throw new Error("Accounts aren't set up: add the Supabase settings to .env.local.");
  client ??= createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  return client;
}

interface Failure {
  message: string;
  code?: string;
}

function fail(error: Failure, status: number): never {
  const auth = status === 401 || status === 403 || error.code === "PGRST301" || /jwt/i.test(error.message);
  const network = status === 0 || /failed to fetch|network|load failed|fetch failed/i.test(error.message);
  throw new CloudError(error.message, auth ? "auth" : network ? "network" : "other");
}

const TABLE = "user_data";

export const supabaseCloud: CloudApi = {
  async fetchRow(userId) {
    const { data, error, status } = await supabase().from(TABLE).select("data, revision").eq("user_id", userId).maybeSingle();
    if (error) fail(error, status);
    return data ? { data: data.data, revision: data.revision } : null;
  },

  async insertRow(userId, data) {
    const { data: row, error, status } = await supabase()
      .from(TABLE)
      .insert({ user_id: userId, data, revision: 1 })
      .select("revision")
      .single();
    if (error) {
      if (error.code === "23505") return "conflict"; // a row already exists
      fail(error, status);
    }
    return row.revision;
  },

  async updateRow(userId, data, revision) {
    // the revision check makes this a no-op if another device saved first
    const { data: rows, error, status } = await supabase()
      .from(TABLE)
      .update({ data, revision: revision + 1, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("revision", revision)
      .select("revision");
    if (error) fail(error, status);
    return rows && rows.length > 0 ? rows[0].revision : "conflict";
  },
};
