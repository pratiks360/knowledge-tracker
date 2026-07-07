# Personal Knowledge Graph — Implementation Plan

> **For Claude Code:** Before writing any code, review the existing project at
> `C:\PROJECTS\ChakraOS`. It uses the same stack (Vite + React + pnpm, Supabase with
> Google SSO + edge functions, Vercel, GitHub Actions). Reuse its patterns for:
> project scaffolding, Supabase client setup, Google SSO flow, edge function
> structure/deployment, environment variable handling, and the GitHub Actions +
> Vercel deployment pipeline. Match its conventions unless this plan says otherwise.

---

## 1. Product summary

A single-user personal learning dashboard built around a knowledge graph.
Two personas/modes:

- **Admin + Learn mode** — create topics, attach resources (web pages, YouTube),
  AI-summarize, take notes, chat per topic, generate roadmaps, track progress,
  and revise via recap cards and quizzes.
- **Present mode (v1: one fixed setup)** — a clean, read-only, curated view of the
  graph used to answer "tell me about yourself" in technical interviews, with a
  single ordered "story path" walk-through plus free graph navigation.

Single user, but gated behind Google SSO (only the owner's Google account may use it).

---

## 2. Tech stack (fixed decisions)

| Concern           | Choice                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Frontend          | Vite + React + TypeScript, pnpm                                                                                                     |
| Backend           | Supabase: Postgres, Auth (Google SSO), Edge Functions (Deno)                                                                        |
| Hosting           | Vercel (frontend), Supabase (DB + functions)                                                                                        |
| CI/CD             | GitHub Actions (lint, typecheck, build, deploy — mirror ChakraOS pipeline)                                                          |
| AI                | OpenRouter. User pastes their own API key in a Settings page and selects a model (filterable to free models). No hardcoded keys.    |
| Architecture bias | Keep logic mostly in the frontend. Edge functions ONLY where the browser can't do it (CORS-blocked fetches, secret-ish operations). |

### AI call routing

- OpenRouter chat/completions calls go **directly from the browser** using the
  user-supplied key (it's the user's own key; acceptable for a single-user app).
- Store the key + selected model in a `user_settings` table (per user id), and cache
  in memory. Do not commit keys; do not put keys in URLs.
- Settings page: paste key → validate with a cheap `GET /models` call → populate a
  model dropdown from OpenRouter's model list, with a "free models only" filter
  (models where pricing is 0) → save selection.

### Edge functions (the only backend code)

1. `fetch-web` — given a URL, fetch the page server-side (bypasses CORS), strip
   boilerplate, return readable text + title. Use a readability-style extraction.
2. `fetch-youtube` — given a YouTube URL, fetch the caption/transcript track and
   return plain text + video title. If no captions exist, return a typed error so
   the UI offers "paste notes manually" fallback.
3. (Optional, only if browser-direct OpenRouter calls hit CORS issues) `ai-proxy` —
   thin pass-through to OpenRouter using the key forwarded in the request header.

All edge functions must verify the Supabase JWT and check the caller is the owner.

---

## 3. Data model (Supabase Postgres)

Enable RLS on every table: `user_id = auth.uid()` for all operations.

```sql
-- Topics / subtopics. Tree via parent_id; DAG via cross-links table.
nodes (
  id uuid pk default gen_random_uuid(),
  user_id uuid not null references auth.users,
  parent_id uuid null references nodes(id),   -- canonical parent; null = root
  title text not null,
  description text,
  notes_md text,                              -- freeform markdown notes
  status text not null default 'not_started', -- not_started | learning | done
  order_index int not null default 0,         -- sibling ordering (roadmap sequence)
  present_visible boolean not null default false,
  present_summary text,                        -- curated blurb for present mode
  node_kind text not null default 'topic',    -- topic | project | profile_root
  last_visited_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)

-- Non-hierarchical relations: "related", "also-under", project→topic-used, prerequisite
node_links (
  id uuid pk,
  user_id uuid not null,
  from_node uuid not null references nodes(id) on delete cascade,
  to_node uuid not null references nodes(id) on delete cascade,
  link_type text not null default 'related'   -- related | uses | prerequisite
)

resources (
  id uuid pk,
  user_id uuid not null,
  node_id uuid not null references nodes(id) on delete cascade,
  kind text not null,           -- web | youtube | manual
  url text,
  title text,
  raw_content text,             -- extracted page text / transcript / pasted notes
  summary_md text,              -- AI summary
  pinned boolean default false, -- "the good stuff" (used by present mode later)
  created_at timestamptz default now()
)

-- One persistent chat thread per node
chat_messages (
  id uuid pk,
  user_id uuid not null,
  node_id uuid not null references nodes(id) on delete cascade,
  role text not null,           -- user | assistant
  content text not null,
  created_at timestamptz default now()
)

quizzes (
  id uuid pk,
  user_id uuid not null,
  node_id uuid not null references nodes(id) on delete cascade,
  questions jsonb not null,     -- [{q, options?, answer, explanation}]
  last_score int,
  taken_at timestamptz
)

-- v1: single fixed presentation, but keyed for future multi-presentation support
presentations (
  id uuid pk,
  user_id uuid not null,
  name text not null default 'default'
)

story_path_steps (
  id uuid pk,
  user_id uuid not null,
  presentation_id uuid not null references presentations(id) on delete cascade,
  node_id uuid not null references nodes(id) on delete cascade,
  step_order int not null
)

user_settings (
  user_id uuid pk references auth.users,
  openrouter_api_key text,
  selected_model text,
  owner_email text              -- optional allowlist enforcement
)
```

**Full-text search:** add a generated `tsvector` column over
`nodes(title, description, notes_md)` and `resources(title, summary_md, raw_content)`
with GIN indexes; expose one search RPC that unions both.

**Progress rollup:** compute client-side — a node's progress % = done descendants /
total descendants (leaf nodes count themselves via status). No triggers needed.

---

## 4. AI features (all via OpenRouter from the frontend)

Central `lib/ai.ts` module with typed helpers. All structured outputs: prompt the
model to return **JSON only**, strip code fences, `JSON.parse` with error recovery.

1. **Auto-placement** — on quick-add: send new topic title + a compact serialization
   of the existing tree (titles + ids, depth-limited) → model returns
   `{parent_id | null, reasoning, suggested_path}`. UI shows proposal:
   **Accept / pick different parent / make root**. Never place silently.
2. **Summarize resource** — raw_content → markdown summary (chunk if long; map-reduce
   summarization for big transcripts).
3. **Node-level actions** — Summarize node (across all resources + notes),
   Simplify (ELI5 rewrite), Show examples. Results are shown and can be saved into
   notes or as a `manual` resource.
4. **Generate subtopics / roadmap** — returns a proposed ordered subtree
   `[{title, description, order, children[], prerequisites[]}]` → rendered as a
   preview panel → user merges all or cherry-picks nodes; merged nodes get
   `order_index` and `prerequisite` links.
5. **Per-node chat** — context = node title/description/notes + resource summaries +
   ancestor breadcrumb titles. Persist every message. Include a "web search" toggle:
   when on, use an OpenRouter model with online capability (e.g. `:online` suffix
   models) and offer "save answer as resource".
6. **Recap card** — when opening a node not visited in >7 days, generate (and cache
   in a column or regenerate on demand) a short key-points recap shown above the
   fold.
7. **Test me (quiz)** — generate 5–8 questions (MCQ + short answer) from node
   context; interactive quiz UI; store score in `quizzes`.

---

## 5. UI / routes

```
/login                Google SSO (Supabase auth)
/                     Dashboard
/node/:id             Node page (admin+learn)
/present              Present mode
/settings             OpenRouter key + model picker, owner settings
```

### Dashboard `/`

- Root-node cards with progress rings.
- **Quick-add box**: type topic → auto-placement proposal flow.
- "Continue learning" strip: recently visited nodes.
- "Review due" strip (v1: nodes done/learning with `last_visited_at` > 14 days).
- Global search bar (FTS RPC).

### Node page `/node/:id`

- **Top:** breadcrumbs (ancestor chain), status toggle, progress %.
- **Left sidebar:** collapsible tree of the whole graph, current node highlighted.
- **Main column:**
  - Recap card (if stale revisit).
  - Notes: markdown editor with preview (e.g. CodeMirror + remark, or a lightweight
    md editor already used in ChakraOS if one exists).
  - Resources list: add-URL input (web/YT auto-detected) → edge function ingest →
    summary; each resource expandable with re-summarize / simplify / examples /
    pin / delete.
  - Action bar: Summarize node · Simplify · Examples · Generate subtopics ·
    Generate roadmap · Test me.
  - Roadmap/subtopic proposals render as an inline preview tree with per-node
    checkboxes → Merge.
  - Present-mode controls: `present_visible` toggle + `present_summary` textarea
    (collapsed by default).
- **Right panel:** persistent chat thread for this node (web-search toggle,
  save-answer-as-resource).

### Present mode `/present`

- Read-only. Shows only `present_visible` nodes.
- Zoomable/pannable graph canvas (use **React Flow** with an auto-layout lib like
  `dagre`/`elkjs`) rooted at the `profile_root` node; smooth focus/zoom on click.
- Node click → side card with title + `present_summary` + pinned resources only.
  Never chat, notes, raw progress.
- **Story path bar:** Next / Back walks `story_path_steps` in order, auto-focusing
  each node; free clicks anywhere allowed, "Resume path" returns to current step.
- Keyboard: ← → for path steps, Esc to zoom out. Clean, presentation-grade styling
  (this page justifies extra design polish).
- Story path editor: simple drag-order list, reachable from Settings or a
  "Configure presentation" button (admin mode only).

### Graph rendering note

Left-sidebar tree = simple recursive component (cheap, always visible).
React Flow canvas is used in **two** places: roadmap-preview rendering and present
mode. Keep it lazy-loaded.

---

## 6. Auth

- Supabase Google SSO, same wiring as ChakraOS.
- Single-user enforcement: after login, check email against an `OWNER_EMAIL`
  env/config (or first-user-wins stored in `user_settings.owner_email`); reject
  other accounts with a friendly "private app" screen.
- RLS everywhere as backup.

---

## 7. Build phases (each phase ends runnable + deployed)

**Phase 0 — Scaffold**
Vite+React+TS+pnpm app, Tailwind (or ChakraOS's styling choice), Supabase project,
Google SSO, owner gate, Vercel deploy, GitHub Actions pipeline copied/adapted from
ChakraOS. Empty dashboard behind login.

**Phase 1 — Graph core**
`nodes` table + RLS, tree sidebar, breadcrumbs, node page shell, manual CRUD
(add child, rename, move parent, delete with confirm), status toggle, progress
rollup, dashboard root cards, global FTS search.

**Phase 2 — Settings + AI foundation**
Settings page (OpenRouter key, model list with free filter), `lib/ai.ts`,
auto-placement flow on quick-add, node actions: summarize/simplify/examples
(from notes only at this point).

**Phase 3 — Resources & ingestion**
`resources` table, `fetch-web` + `fetch-youtube` edge functions, add-resource flow,
per-resource summarization, manual-paste fallback, pinning, markdown notes editor.

**Phase 4 — Chat**
`chat_messages`, right-panel chat with node context, web-search toggle,
save-answer-as-resource.

**Phase 5 — Roadmaps & suggestions**
Generate subtopics/roadmap → React Flow preview → cherry-pick merge with
`order_index` + prerequisite links. Cross-links UI ("relate to…" picker on node).

**Phase 6 — Recall loop**
Recap card on stale revisit, Test-me quiz generation + quiz UI + score storage,
"Review due" strip on dashboard.

**Phase 7 — Present mode**
`presentations` + `story_path_steps`, present_visible/present_summary controls,
`/present` graph canvas, story path walk + editor, keyboard nav, visual polish.

**Deferred (v2):** spaced-repetition scheduling, multi-presentation support,
Whisper transcription for caption-less videos, multi-page web crawling,
node embeddings/RAG (v1 chat context = summaries + notes, which fits comfortably
in context for single-node scope).

---

## 8. Engineering conventions

- TypeScript strict; shared types for all tables in `src/types/db.ts`
  (or generate via `supabase gen types`).
- TanStack Query for all Supabase reads/writes; optimistic updates for CRUD.
- Zustand (or ChakraOS's state choice) only for UI state (selected node, panels).
- All AI prompts live in `src/lib/prompts.ts` — one place to tune.
- Every AI action shows loading state + graceful error toast (key missing →
  deep-link to Settings).
- Migrations in `supabase/migrations`, run via CI.
- No secrets in repo; `.env.example` provided.

## 9. Acceptance checklist (v1 done when)

- [ ] Login restricted to owner's Google account
- [ ] Create/rename/move/delete topics; tree + breadcrumbs navigation
- [ ] Quick-add proposes placement; never places silently
- [ ] Web + YouTube resources ingest and summarize; manual fallback works
- [ ] Markdown notes persist per node
- [ ] Per-node persistent chat grounded in node context; web-search toggle
- [ ] Summarize / simplify / examples / subtopics / roadmap actions work with preview-merge
- [ ] Recap card on stale nodes; quiz generation + scoring
- [ ] Global search returns nodes and resources
- [ ] Present mode shows only curated nodes, story path walk works, no notes/chat leak
- [ ] Deployed on Vercel via GitHub Actions; OpenRouter key configurable in Settings with free-model filter
