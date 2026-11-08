import { backupData } from "./backup";
import { cloudConfigured, cloudSettings, describeFailure, supabase } from "./cloud";
import { EMPTY_TRACKER } from "./slots";

export type CheckResult = "pass" | "fail" | "warn" | "skip";

export interface Check {
  label: string;
  result: CheckResult;
  detail: string;
  /** What to do about it, for anything that isn't a pass. */
  fix?: string;
}

const TABLE = "user_data";

/** Reads the role out of a Supabase key without verifying it, just to spot the wrong key being used. */
function keyRole(key: string): string | null {
  if (key.startsWith("sb_secret_")) return "service_role";
  if (key.startsWith("sb_publishable_")) return "anon";
  try {
    const payload = key.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return (JSON.parse(json) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

function checkSettings(): Check {
  const { url, anonKey } = cloudSettings;
  if (!cloudConfigured || !url || !anonKey) {
    return {
      label: "App has the Supabase settings",
      result: "fail",
      detail: "NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing from this build.",
      fix: "Add both in Vercel (Settings → Environment Variables), then redeploy. They're only picked up when the app is built.",
    };
  }
  let host: URL;
  try {
    host = new URL(url);
  } catch {
    return {
      label: "App has the Supabase settings",
      result: "fail",
      detail: `The project URL isn't a valid web address: ${url}`,
      fix: "Copy the Project URL from Supabase → Project Settings → API. It looks like https://abcdefgh.supabase.co",
    };
  }
  if (keyRole(anonKey) === "service_role") {
    return {
      label: "App has the Supabase settings",
      result: "fail",
      detail: "The key in NEXT_PUBLIC_SUPABASE_ANON_KEY is the secret service_role key. It bypasses all privacy rules and is now visible to anyone who opens your site.",
      fix: "Use the anon / publishable key instead, and rotate the exposed key in Supabase (Project Settings → API) right away.",
    };
  }
  if (host.pathname !== "/" && host.pathname !== "") {
    return {
      label: "App has the Supabase settings",
      result: "warn",
      detail: `The project URL has a path on the end (${host.pathname}).`,
      fix: "Use just the base address, like https://abcdefgh.supabase.co, with nothing after .co",
    };
  }
  return { label: "App has the Supabase settings", result: "pass", detail: `Project ${host.host}, key type ${keyRole(anonKey) ?? "unknown"}.` };
}

async function checkReachable(): Promise<Check> {
  const { url, anonKey } = cloudSettings;
  const label = "Supabase is reachable and accepts the key";
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: anonKey ?? "" } });
    if (res.status === 401 || res.status === 403) {
      return { label, result: "fail", detail: `Supabase answered ${res.status}: the API key was rejected.`, fix: "Re-copy the anon / publishable key from Project Settings → API into NEXT_PUBLIC_SUPABASE_ANON_KEY and redeploy." };
    }
    if (!res.ok) {
      return { label, result: "fail", detail: `Supabase answered with status ${res.status}.`, fix: "Check the project URL, and that the project isn't paused (free projects pause after a week of no use)." };
    }
    const settings = (await res.json()) as { mailer_autoconfirm?: boolean; disable_signup?: boolean };
    const notes = [
      settings.disable_signup ? "new sign-ups are disabled" : null,
      settings.mailer_autoconfirm === false ? "email confirmation is ON (new accounts must click a link before signing in)" : "email confirmation is off",
    ].filter(Boolean);
    return { label, result: settings.disable_signup ? "warn" : "pass", detail: `Connected; ${notes.join("; ")}.`, fix: settings.disable_signup ? "Enable sign-ups in Authentication → Sign In / Providers." : undefined };
  } catch (e) {
    return {
      label,
      result: "fail",
      detail: `Couldn't reach ${url} (${e instanceof Error ? e.message : "network error"}).`,
      fix: "Check NEXT_PUBLIC_SUPABASE_URL for typos, make sure the project isn't paused, and that an ad blocker or network filter isn't blocking supabase.co.",
    };
  }
}

type Signed = { userId: string } | { problem: Check };

async function checkSignedIn(): Promise<{ check: Check; session: Signed }> {
  const label = "You're signed in";
  const auth = supabase().auth;
  const { data } = await auth.getSession();
  if (!data.session) {
    const check: Check = { label, result: "skip", detail: "Not signed in, so the checks below were skipped.", fix: "Sign in (or create an account), then run this again." };
    return { check, session: { problem: check } };
  }
  const { data: user, error } = await auth.getUser(); // asks the server, so a stale token is caught
  if (error || !user.user) {
    const check: Check = { label, result: "fail", detail: `The saved sign-in is no longer valid (${error?.message ?? "no user"}).`, fix: "Sign out and sign in again." };
    return { check, session: { problem: check } };
  }
  return { check: { label, result: "pass", detail: `Signed in as ${user.user.email ?? user.user.id}.` }, session: { userId: user.user.id } };
}

async function checkRead(userId: string): Promise<{ check: Check; hasRow: boolean | null; revision?: number }> {
  const label = "The user_data table exists and can be read";
  const { data, error, status } = await supabase().from(TABLE).select("revision").eq("user_id", userId).maybeSingle();
  if (error) {
    const e = describeFailure(error, status);
    return { check: { label, result: "fail", detail: e.message, fix: "Open Supabase → SQL Editor, paste supabase/schema.sql, run it, then run this check again." }, hasRow: null };
  }
  return {
    check: { label, result: "pass", detail: data ? `Found your saved copy (revision ${data.revision}).` : "The table is there; you just don't have a saved copy yet." },
    hasRow: Boolean(data),
    revision: data?.revision,
  };
}

async function checkWrite(userId: string, hasRow: boolean, revision?: number): Promise<Check> {
  const label = "Saving to your account works";
  const sb = supabase();
  const fix = "Run supabase/schema.sql again: it creates the insert / update / delete rules and the permissions they rely on.";

  if (hasRow && revision !== undefined) {
    // touch the timestamp on the real row without changing its data or revision
    const { data, error, status } = await sb
      .from(TABLE)
      .update({ updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("revision", revision)
      .select("revision");
    if (error) return { label, result: "fail", detail: describeFailure(error, status).message, fix };
    if (!data || data.length === 0) {
      return { label, result: "warn", detail: "The update changed nothing. Either another device just saved, or there is no UPDATE rule.", fix: "Run this again; if it repeats, run supabase/schema.sql." };
    }
    return { label, result: "pass", detail: "Updated your saved copy." };
  }

  // no saved copy yet: write a clearly-marked blank probe row, then remove it again
  const probe = { ...backupData({ spells: [], view: "full", tracker: EMPTY_TRACKER }), probe: true };
  const inserted = await sb.from(TABLE).insert({ user_id: userId, data: probe, revision: 1 });
  if (inserted.error) {
    if (inserted.error.code === "23505") return { label, result: "pass", detail: "Your account's copy was created by a save in progress, so saving works." };
    return { label, result: "fail", detail: describeFailure(inserted.error, inserted.status).message, fix };
  }
  // only ever deletes the probe itself, never real data
  const removed = await sb.from(TABLE).delete().eq("user_id", userId).eq("data->>probe", "true");
  if (removed.error) {
    return { label, result: "warn", detail: `Saving works, but the test row couldn't be removed (${describeFailure(removed.error, removed.status).message}).`, fix: "Run supabase/schema.sql to add the delete rule. The empty row is harmless." };
  }
  return { label, result: "pass", detail: "Wrote and removed a test row." };
}

/** Walks the same path a real save takes and reports which step, if any, is broken. */
export async function diagnoseCloud(): Promise<Check[]> {
  const settings = checkSettings();
  if (settings.result === "fail") return [settings];

  const results: Check[] = [settings, await checkReachable()];
  if (results[1].result === "fail") return results;

  const { check, session } = await checkSignedIn();
  results.push(check);
  if ("problem" in session) return results;

  const read = await checkRead(session.userId);
  results.push(read.check);
  if (read.hasRow === null) return results;

  results.push(await checkWrite(session.userId, read.hasRow, read.revision));
  return results;
}

/** Plain text of the results, for pasting into a message. */
export function formatChecks(checks: Check[]): string {
  const icon: Record<CheckResult, string> = { pass: "PASS", fail: "FAIL", warn: "WARN", skip: "SKIP" };
  return checks
    .map((c) => `[${icon[c.result]}] ${c.label}\n      ${c.detail}${c.fix && c.result !== "pass" ? `\n      Fix: ${c.fix}` : ""}`)
    .join("\n");
}
