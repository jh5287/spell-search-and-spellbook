"use client";

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import { eraseEverything } from "@/lib/backup";
import { cloudConfigured, supabase, supabaseCloud } from "@/lib/cloud";
import { clearSyncMeta, createSyncEngine, type ConflictChoice, type SyncState } from "@/lib/sync";

// One engine for the whole page. It does nothing until someone signs in.
const engine = createSyncEngine(supabaseCloud);

export interface AccountUser {
  id: string;
  email: string;
}

export interface Account {
  /** False when the Supabase settings are missing; the app then hides everything account-related. */
  configured: boolean;
  /** False until the saved sign-in has been looked up, to avoid flashing a "Sign in" button. */
  ready: boolean;
  user: AccountUser | null;
  sync: SyncState;
  /** Resolve to an error message, or null on success. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  resolveConflict: (choice: ConflictChoice) => void;
}

const OFF: SyncState = { status: "off", message: null, conflict: null };

const DISABLED: Account = {
  configured: false,
  ready: true,
  user: null,
  sync: OFF,
  signIn: async () => "Accounts aren't set up.",
  signUp: async () => ({ error: "Accounts aren't set up.", needsConfirmation: false }),
  signOut: async () => {},
  resolveConflict: () => {},
};

const AccountContext = createContext<Account>(DISABLED);

export function useAccount(): Account {
  return useContext(AccountContext);
}

export default function AccountProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [ready, setReady] = useState(!cloudConfigured);
  const sync = useSyncExternalStore(engine.subscribe, engine.getState, engine.getServerState);

  useEffect(() => {
    if (!cloudConfigured) return;
    const auth = supabase().auth;
    const toUser = (s: { user: { id: string; email?: string } } | null): AccountUser | null =>
      s ? { id: s.user.id, email: s.user.email ?? "" } : null;

    auth.getSession().then(({ data }) => {
      setUser(toUser(data.session));
      setReady(true);
    });
    // token refreshes also land here, so only a change of person should restart anything
    const { data } = auth.onAuthStateChange((_event, session) => setUser(toUser(session)));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    engine.start(userId);
    return () => engine.stop();
  }, [userId]);

  const value = useMemo<Account>(() => {
    if (!cloudConfigured) return DISABLED;
    return {
      configured: true,
      ready,
      user,
      sync,
      signIn: async (email, password) => {
        const { error } = await supabase().auth.signInWithPassword({ email, password });
        return error ? error.message : null;
      },
      signUp: async (email, password) => {
        const { data, error } = await supabase().auth.signUp({ email, password });
        // with email confirmation switched on in Supabase there is no session until the link is clicked
        return { error: error ? error.message : null, needsConfirmation: !error && !data.session };
      },
      signOut: async () => {
        const saved = await engine.flush();
        const warning = saved
          ? "Sign out? Your book is saved in your account, and it will be removed from this browser."
          : "Some recent changes haven't reached your account yet, and signing out will lose them. Sign out anyway?";
        if (!window.confirm(warning)) return;

        // stop syncing first, so wiping this browser can't be mistaken for deleting the book
        engine.stop();
        try {
          // "local" signs out this browser only, not the person's other devices
          await supabase().auth.signOut({ scope: "local" });
        } catch {
          // the sign-in is dropped on this browser either way
        }
        eraseEverything();
        clearSyncMeta();
      },
      resolveConflict: (choice) => void engine.resolveConflict(choice),
    };
  }, [ready, user, sync]);

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}
