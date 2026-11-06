# Spell-Book-App
Spell look up and custom spell book app for D&amp;D 5e Spell Casters

## Development

`npm install && npm run dev`, then open http://localhost:3000. Type a spell name to see the closest match instantly (data from dnd5eapi.co).

## Accounts and automatic saving (optional)

Without any setup the app saves to the browser only. To let people sign in and have their spell book, slots and settings save to their account automatically (and follow them to other devices), connect a free [Supabase](https://supabase.com) project. This takes about five minutes:

1. **Create a project** at supabase.com (the free plan is plenty).
2. **Create the table.** In the dashboard open *SQL Editor → New query*, paste the contents of [`supabase/schema.sql`](supabase/schema.sql), and run it. This also turns on the row-level security that keeps each person's data private. Don't skip it.
3. **Sign-in method.** *Authentication → Providers → Email* is on by default. For easy beta testing, turn **Confirm email off**: people can then create an account and be signed in straight away. (With it on, Supabase's built-in email is limited to a few messages an hour, which gets in the way of testers.)
4. **Copy the two settings** from *Project Settings → API*: the **Project URL** and the **anon public** key.
5. **Add them to the app**
   - Locally: copy `.env.example` to `.env.local` and fill in both values.
   - On Vercel: *Project → Settings → Environment Variables*, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then **redeploy**. Next.js bakes `NEXT_PUBLIC_` values in at build time, so a redeploy is required.

When the two settings are missing the account button simply doesn't appear and the app works as before.

### How saving works

- The browser copy is always what the app uses, so everything stays instant and works offline. While signed in, every change is sent to the account about a second and a half after you stop, and the header shows *Saving… / All changes saved / Offline*.
- Each save is tied to a revision number, so two devices can't silently overwrite each other. If both changed since they last met, a dialog offers *Merge both*, *Use my account's version* or *Use this browser's version* (with a download of the browser's data first).
- Signing in on a new device downloads the account's book. Signing in on a device that already has spells uploads them (or asks, if the account has a book too).
- Signing out saves any pending changes, then removes the book from that browser so the next person on a shared computer doesn't see it. The data stays in the account. The hard reset erases the account copy too while signed in.

### Known limits

- No "forgot password" flow yet. It needs Supabase's email sending configured; custom SMTP or magic links are the natural next step.
- There is no in-app account deletion. Delete users in the Supabase dashboard (*Authentication → Users*), which also removes their saved data.
