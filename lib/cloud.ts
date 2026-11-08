import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CloudError, type CloudApi } from "./sync";

// Next.js swaps these in at build time, so they have to be written out in full like this.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Accounts only appear once the two Supabase settings exist; without them the app works as it always did. */
export const cloudConfigured = Boolean(url && anonKey);

/** For the connection check only. Both values are public by design (they ship in the page). */
export const cloudSettings = { url, anonKey };

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

/** Turns Supabase's terse errors into something a person can act on, keeping the original for reference. */
export function describeFailure(error: Failure, status: number): CloudError {
  const text = error.message ?? "";
  const ref = `${error.code ?? status}: ${text}`;

  if (error.code === "PGRST205" || error.code === "42P01" || /could not find the table|relation .* does not exist/i.test(text)) {
    return new CloudError(`The user_data table doesn't exist in your Supabase project. Run supabase/schema.sql in the SQL Editor. (${ref})`, "other");
  }
  if (error.code === "42501" || /row-level security|permission denied/i.test(text)) {
    return new CloudError(`Supabase blocked the save (permission denied). Run supabase/schema.sql again to create the access rules. (${ref})`, "other");
  }
  if (/invalid api key|no api key/i.test(text)) {
    return new CloudError(`Supabase rejected the API key. Check NEXT_PUBLIC_SUPABASE_ANON_KEY and redeploy. (${ref})`, "other");
  }
  if (status === 401 || error.code === "PGRST301" || error.code === "PGRST303" || /jwt/i.test(text)) {
    return new CloudError(text, "auth");
  }
  if (status === 0 || /failed to fetch|network|load failed|fetch failed/i.test(text)) {
    return new CloudError(text, "network");
  }
  return new CloudError(`${text} (${error.code ?? status})`, "other");
}

function fail(error: Failure, status: number): never {
  throw describeFailure(error, status);
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
