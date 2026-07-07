# Personal Knowledge Graph

A single-user personal learning dashboard built around a knowledge graph. See
[knowledge-graph-implementation-plan.md](./knowledge-graph-implementation-plan.md) for the full spec.

## Stack

Vite + React + TypeScript, pnpm, Supabase (Postgres, Auth, Edge Functions), Vercel, GitHub Actions.

## Local setup

1. `pnpm install`
2. Copy `.env.example` to `.env.local` and fill in your Supabase project URL, anon/publishable key,
   and owner email.
3. In the Supabase dashboard: enable the Google Auth provider, and add
   `http://localhost:5173/auth/callback` (and your deployed URL) to the allowed redirect URLs.
4. Run the SQL files in `supabase/migrations` (in order) via the Supabase SQL editor, or via the
   Supabase CLI if you have it installed.
5. `pnpm dev`

## Scripts

- `pnpm dev` — start the dev server
- `pnpm build` — typecheck + production build
- `pnpm lint` / `pnpm typecheck`

## Deployment

- **Vercel**: import this repo, framework preset "Vite". Set the three `VITE_*` env vars from
  `.env.example` in the Vercel project settings.
- **GitHub Actions**: `.github/workflows/ci.yml` runs lint/typecheck/build on every push and PR.
  `.github/workflows/deploy.yml` deploys to Vercel on push to `main` — requires `VERCEL_TOKEN`,
  `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` repo secrets (and the three `VITE_*` secrets).
- **Supabase Edge Functions**: deploy with `supabase functions deploy <name>` (requires the
  Supabase CLI, logged in and linked to your project).
