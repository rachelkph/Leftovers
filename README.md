# leftovers

A little memory for what's in your fridge. Snap a receipt or an item, confirm what the AI found, and Leftovers keeps track, nudging you about what to eat soon.

Desktop-first web app: React + TypeScript + Vite. Receipt and item scanning use Claude's vision through a small server route, so your API key never reaches the browser.

## Run it locally

You need Node 22 or newer (`node -v`; install with `brew install node`).

```bash
npm run setup   # once: installs dependencies and asks for your Anthropic API key
npm run dev     # starts the app and opens http://localhost:5173
```

**Scanning needs Claude, powered one of two ways** (`npm run setup` walks you through it):

- **Your Claude subscription, via Claude Code (free, local only).** If the `claude` CLI is installed and signed in, and there's no API key, scans run through `claude -p` and count against your plan's usage limits. This is for trying the app on your own machine.
- **An Anthropic API key (pay-as-you-go).** Paste it into `npm run setup`, which hides it as you type, checks it works, and saves it to `.env` (git-ignored, readable only by you). You'll need this once anyone else uses the app.

To force one, set `LEFTOVERS_SCANNER=api` or `LEFTOVERS_SCANNER=claude-code` in `.env`. Without either, everything works except scanning, and **Add by hand** always works.

When `npm run dev` starts, it prints whether scanning is on. Your food is saved in the browser, so it survives restarts; to wipe it, go to Profile → Start over.

## What's here

| Area | Where |
|---|---|
| Home: the fridge door (eat-soon magnets + your decor), eat-soon list, photo grid | `src/pages/Home.tsx` |
| Fridge: the door swings open onto the shelves, or switch to List view; item details on the right | `src/pages/FridgePage.tsx`, `src/components/Fridge.tsx`, `Shelves.tsx`, `ItemPanel.tsx` |
| Add: scan a receipt, scan an item, or add by hand; editable review, and uncertain items must be confirmed | `src/components/AddDialog.tsx` |
| Customize: 8 paints (incl. light teal), gloss/matte, drag-around magnets | `src/pages/Customize.tsx`, `src/lib/decor.ts` |
| Onboarding: name → just me / share → pick your fridge | `src/pages/Onboarding.tsx` |
| Scanning (server): Claude vision → structured JSON | `server/scan.ts`, mounted by `server/vitePlugin.ts` |
| Data: local-first store in `localStorage`, all writes go through `actions` | `src/lib/store.ts` |
| Sync and sign-in (optional): Supabase, per-key settings merge, offline queue | `src/lib/sync.ts`, `src/lib/auth.ts`, `supabase/schema.sql` |
| Hosting: website + signed-in-only scan function for Vercel | `scripts/build-vercel.mjs`, `server/vercelScan.ts` |

## Sync across your devices (optional)

Leftovers can keep one fridge in sync between your laptop and phone. You sign in with a 6-digit code emailed to you (no password), and only your signed-in session can read or change your data. Each device keeps a local copy, so it opens instantly and works offline; changes upload in the background and other devices pick them up when you open or return to the app.

**1. Supabase: the database and sign-in**

Leftovers can have its own Supabase project, or share one with another app: its tables are all prefixed `leftovers_`, and it never creates accounts (it signs in people who already exist in the project).

1. Pick the project. For a new one: [supabase.com](https://supabase.com) → New project, then **Authentication → Users → Add user** with your email.
2. **SQL Editor → New query**, paste [`supabase/schema.sql`](supabase/schema.sql), **Run**.
3. **Authentication → Emails → Magic Link** template: make sure the email shows the code. Add this line if it isn't there (another app using the template is unaffected):
   ```html
   <p>Or sign in with this code: <strong>{{ .Token }}</strong></p>
   ```
4. **Project Settings → API**: copy the **Project URL** and the **anon / publishable** key. Both are public by design. Never put the `service_role` key in this app.

**2. Vercel (free): the website and the scan function**

1. At [vercel.com](https://vercel.com), **Add New → Project** and import this repo. The build settings come from `vercel.json` (`npm run build:vercel`).
2. Under **Environment Variables**, add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `ANTHROPIC_API_KEY`, and optionally `ALLOWED_EMAILS` (your email) as an extra lock on scanning.
3. Deploy. In the [Anthropic Console](https://console.anthropic.com), set a monthly **spend limit** on the key.

The hosted scanner (`server/vercelScan.ts`) refuses any request without a valid signed-in session, and refuses everything if the Supabase settings are missing, so it can't run up your bill.

**To use sync while developing locally,** put the two `VITE_SUPABASE_*` values in `.env.local`. Without them the app stays local-only, exactly as before.

## Not built yet

- **Sharing a fridge with other people.** Households, members and Mine/Shared exist in the UI and data model, but sync is per person: each account sees only its own food.
- **Photos.** `public/food/` holds Creative Commons placeholders, some of which require attribution. See `CREDITS.md`, and replace them before launch.
