# Implementation Plan — MCQ Mentor v0.1

**Status:** v0.1 (vertical slice)
**Last updated:** 2026-06-06

This plan covers what is left to take the slice from "compiles and the dev server returns 200" to "verified end-to-end with the MCP toolchain" and ready for first user testing.

## 1. What is already done

Verified working in this repo as of 2026-06-06:

- `git init` on `main`; repo root has `.gitignore`, `.env.example`, top-level `README.md`.
- `supabase/migrations/0001_initial_schema.sql` (8 tables, enums, RLS, `handle_new_user` trigger).
- `supabase/migrations/0002_storage_bucket.sql` (`materials` bucket + storage RLS).
- `backend/` — full FastAPI service: config, JWT + Fernet security, per-user Supabase client factory, Pydantic schemas, extraction services (pdf/docx/text/csv/json + regex MCQ parser), generation services (OpenAI/Anthropic/Google adapters + factory), quiz services (scoring, mistake FSM, recommendations), 6 route modules, main app. `uv sync` ✅, `ruff check` ✅, `pytest` 4/4 ✅, 24 routes registered.
- `frontend/` — Next.js 16.2.7 App Router project. Tailwind v4, shadcn new-york primitives, `@supabase/ssr` 0.10.3. `proxy.ts` (renamed from middleware.ts in Next 16), `cookies()` awaited. 14 page routes + 4 server actions + 1 proxy + 22 shadcn primitives. `npm run lint` ✅, `npx tsc --noEmit` ✅, `npm run build` ✅. 9 routes curl-tested as 200 OK.
- `frontend/src/proxy.ts`, `frontend/src/lib/supabase/{client,server,proxy}.ts`, `frontend/src/lib/api-{shared,client,server}.ts`, `frontend/src/lib/types.ts`, `frontend/src/lib/auth.ts`.

What has NOT been verified yet:

- SQL not yet applied to a live Supabase project (Supabase MCP needs an opencode restart to load).
- No end-to-end Playwright run against a real Supabase + backend.
- No 2-user RLS isolation test.
- No `playwright.config.ts` and no e2e spec under `tests/e2e/`.

## 2. Phased plan

### Phase 0 — Documentation (this turn)

- ✅ `docs/PRD.md`
- ✅ `docs/ARCHITECTURE.md`
- ✅ `docs/ACCEPTANCE_CRITERIA.md`
- ✅ `docs/IMPLEMENTATION_PLAN.md` (this file)

### Phase 1 — Supabase bring-up

Owner: Rising + opencode.

1. Restart opencode so the Supabase MCP server loads (`supabase` entry in `~/.config/opencode/opencode.json`).
2. Use the Supabase MCP to apply `supabase/migrations/0001_initial_schema.sql`. Verify:
   - `select count(*) from information_schema.tables where table_schema='public'` is 8 (or 9 if you count the trigger-returned view).
   - `select relname, relrowsecurity, relforcerowsecurity from pg_class where relname in ('profiles','user_settings','learning_materials','question_sets','questions','quiz_attempts','question_attempts','mistake_bank','practice_sessions')` — every row has both true.
3. Apply `0002_storage_bucket.sql`. Verify the `materials` bucket exists and is private.
4. In Supabase Studio, confirm `auth.users → handle_new_user` trigger fires on a test signup.

Exit criteria: a test user can sign up via Supabase Auth and a `profiles` row appears automatically.

### Phase 2 — Backend smoke

Owner: opencode.

1. Fill `backend/.env` with real `SUPABASE_URL` and `SUPABASE_JWT_SECRET` from the dashboard.
2. `uv run uvicorn app.main:app --reload --port 8000` — confirm boot with no errors.
3. `curl http://localhost:8000/healthz` → `200 {"status":"ok"}`.
4. `curl http://localhost:8000/openapi.json` → all 24 routes listed.
5. Sign up a test user via the frontend. From the browser, copy the JWT from devtools.
6. Use that JWT to call `GET /dashboard/summary` via curl — confirm a 200 with zeros.
7. Save an AI key with `PUT /settings/me/api-key` — confirm the row in `user_settings` is encrypted (Supabase MCP `select api_key_encrypted`).
8. Run `uv run pytest` — 4/4 green.

Exit criteria: a signed-in user can hit every endpoint family (materials, question sets, quiz, mistakes, dashboard, settings) with a 2xx or an expected 4xx.

### Phase 3 — Frontend end-to-end with Playwright

Owner: opencode.

1. Add `playwright.config.ts` at the repo root or under `tests/e2e/`. Configure two `webServer` entries: `backend` (uvicorn) and `frontend` (next dev). Use a fresh disposable Supabase project (or test schema) so the e2e doesn't pollute real data.
2. Write `tests/e2e/happy-path.spec.ts`:
   - sign up
   - add a fake AI key (mock the provider adapter to return canned JSON, OR sign the user up but stub `/question-sets/generate` via a Playwright `route.fulfill`)
   - upload a small text fixture
   - click Generate, expect the set list
   - take the quiz, submit
   - assert results page shows 100%
   - visit `/mistakes`, expect 0 rows
   - visit `/practice`, expect 0 questions
3. Write `tests/e2e/mistakes-flow.spec.ts`:
   - sign up, add key, upload text
   - generate 3 MCQs, take quiz, intentionally answer 2 wrong
   - assert 2 mistakes in `/mistakes`
   - start practice session, answer both correctly
   - assert mastery moves to `improving`
4. Run `npx playwright test --reporter=list`. All specs green.

Exit criteria: `npx playwright test` is green locally.

### Phase 4 — MCP-driven verification

Owner: opencode. This phase is the gating step for v0.1.

1. **Supabase MCP**:
   - `list_tables` — confirm the 8 tables and 6 enums.
   - `list_policies` — confirm a `SELECT/INSERT/UPDATE/DELETE` policy on every student-owned table keyed to `auth.uid() = user_id`.
   - `list_storage_buckets` — confirm `materials` is private.
   - Create a second auth user. As that user, attempt to `select * from learning_materials where user_id = '<user_A_id>'` — must return 0 rows. Same for `select from question_sets`, `quiz_attempts`, `mistake_bank`.
2. **Chrome DevTools MCP**:
   - Walk the happy path in a real browser. Confirm 0 console errors of level `error`.
   - Confirm no 4xx/5xx in the network log except the documented cases (no key → 400, no session → redirect).
3. **Playwright MCP** (separate from the npm `playwright` test runner; this is the assistant's interactive browser) — drive the same path, take a snapshot of the dashboard and the results page, save to `docs/screenshots/` for the README.
4. **Git MCP** (or bash fallback if scoped out) — `git status`, `git diff --stat`, ensure no stray `node_modules`, `.venv`, or `.env.local` files. `git log --oneline` shows the initial commit and any follow-ups.
5. **Context7 MCP** — if the user adds a new dependency, fetch its current docs before wiring it in. (Already used during this turn for Next.js, FastAPI, Supabase, shadcn.)

Exit criteria: every "How to verify" row in `docs/ACCEPTANCE_CRITERIA.md` has been ticked with the corresponding MCP tool, command, or Playwright test.

### Phase 5 — Initial commit and README polish

Owner: opencode.

1. `git add -A`, then carefully unstage anything that shouldn't ship (e.g. `dev.log`, `dev.out.log`, `dev.err.log`, `tsconfig.tsbuildinfo`, `.next/`).
2. `git status` clean except the four docs + the source code already committed or being committed.
3. Single commit: `chore: initial vertical slice — backend, frontend, migrations, docs`. Use the conventional-commit prefix.
4. Update root `README.md` to point at `docs/PRD.md` and `docs/ACCEPTANCE_CRITERIA.md` for readers who want the full picture.

Exit criteria: a fresh clone of the repo, after `cp .env.example .env.local && cp backend/.env.example backend/.env && uv sync && npm install && npm run dev`, brings up a working app on `localhost:3000`.

## 3. Open work (post v0.1, not blocking)

These are tracked here so they don't get lost. None of them block the v0.1 acceptance criteria.

- **OCR for scanned PDFs** — currently returns an `error_message`. Add Tesseract in a v0.2 sidecar.
- **Question regeneration** — bad question sets can't be rolled over without creating a new set.
- **Email verification flow** — Supabase defaults work, but no branded email template.
- **Provider streaming** — generation is a single round-trip. No incremental rendering yet.
- **Question set deletion UI** — backend supports it; UI does not.
- **Mobile-specific layouts** — current UI is responsive down to ~360px, not optimized for native.
- **i18n** — English only.
- **Telemetry** — no analytics, no error reporting (Sentry). v0.2 candidate.

## 4. Test plan summary

| Layer | Tool | Command |
| --- | --- | --- |
| Backend unit | pytest | `cd backend && uv run pytest` |
| Backend lint | ruff | `cd backend && uv run ruff check app` |
| Frontend lint | ESLint (Next config) | `cd frontend && npm run lint` |
| Frontend types | TypeScript | `cd frontend && npx tsc --noEmit` |
| Frontend build | Turbopack | `cd frontend && npm run build` |
| Frontend smoke | curl | `for r in / /login /signup /dashboard; do curl -s -o /dev/null -w "%{http_code} $r\n" http://localhost:3000$r; done` |
| Backend smoke | curl | `curl http://localhost:8000/healthz` |
| E2E happy path | Playwright | `cd tests/e2e && npx playwright test happy-path.spec.ts` |
| E2E mistakes flow | Playwright | `cd tests/e2e && npx playwright test mistakes-flow.spec.ts` |
| RLS isolation | Supabase MCP | Two auth users, second user's `select` on first user's data returns 0 rows |
| Browser console | Chrome DevTools MCP | Walk happy path, expect 0 console errors |
| Live API in browser | Chrome DevTools MCP | Walk happy path, expect no 4xx/5xx in network log |

## 5. Definition of done for v0.1

- All of `docs/ACCEPTANCE_CRITERIA.md` rows are ticked.
- `tests/e2e` is green.
- One commit on `main` with the entire vertical slice + docs.
- README links to PRD, architecture, and acceptance criteria.
- Known limits are listed in the README and in `docs/IMPLEMENTATION_PLAN.md` §3.
