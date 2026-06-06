# Architecture — MCQ Mentor

**Status:** v0.1 vertical slice
**Last updated:** 2026-06-06

## 1. System diagram

```
┌────────────────────┐         ┌──────────────────────┐         ┌────────────────────────┐
│   Browser (user)   │ ──────▶ │  Vercel (Next.js 16) │ ──────▶ │  Python host (FastAPI) │
│                    │  HTTPS  │  App Router + RSC    │   JWT   │  Modular services      │
└────────────────────┘ ◀────── │  proxy.ts (was mid.) │ ◀────── │  Pydantic v2           │
                               └──────────────┬───────┘  JSON   └────────────┬───────────┘
                                              │                              │
                                              │ supabase-js + JWT            │ supabase-py + JWT
                                              ▼                              ▼
                               ┌──────────────────────────────────────────────────────────┐
                               │              Supabase project (umbohpysrqowpmcpnjlz)       │
                               │  ┌──────────┐  ┌──────────────┐  ┌─────────────────────┐  │
                               │  │ Postgres │  │     Auth     │  │ Storage (materials) │  │
                               │  │  + RLS   │  │  (GoTrue)    │  │  per-user folders   │  │
                               │  └──────────┘  └──────────────┘  └─────────────────────┘  │
                               └──────────────────────────────────────────────────────────┘
                                                          ▲
                                                          │ HTTPS (provider call)
                                                          │
                                          ┌───────────────┴────────────────┐
                                          │  OpenAI / Anthropic / Google   │
                                          │  (called from backend only)    │
                                          └────────────────────────────────┘
```

## 2. Folder layout

This is the canonical layout. Do not introduce parallel structures.

```
MCQs_ulitmate/
├── backend/                    FastAPI service
│   ├── app/
│   │   ├── main.py             FastAPI app + router registration
│   │   ├── core/               config, security (JWT verify, Fernet)
│   │   ├── db/                 Supabase client factory
│   │   ├── schemas/            Pydantic request/response shapes
│   │   ├── services/
│   │   │   ├── extraction/     pdf, docx, text, csv, json, mcq_parser
│   │   │   ├── generation/     providers, mcq_generator, short_question_generator, factory
│   │   │   └── quiz/           scoring_service, mistake_service, recommendation_service
│   │   └── api/routes/         materials, question_sets, quiz_attempts, mistakes, dashboard, settings
│   ├── tests/                  pytest (unit tests, no live Supabase)
│   ├── pyproject.toml          uv-managed deps + ruff config
│   └── README.md
├── frontend/                   Next.js 16 app (App Router)
│   ├── src/
│   │   ├── app/                page.tsx, layout.tsx, route groups
│   │   │   ├── actions/        server actions (auth, settings)
│   │   │   ├── login/          login page + form
│   │   │   ├── signup/         signup page + form
│   │   │   ├── dashboard/      summary cards + recommendations
│   │   │   ├── materials/      list, new (upload/paste), [id] detail
│   │   │   ├── quiz-sets/[id]/ preview + start
│   │   │   ├── quiz/[attemptId]/ active quiz runner
│   │   │   ├── results/[attemptId]/ score + breakdown
│   │   │   ├── mistakes/       mastery breakdown + list
│   │   │   ├── practice/       start form
│   │   │   └── settings/       AI key form
│   │   ├── components/
│   │   │   ├── app-nav.tsx     client nav (uses browser Supabase client)
│   │   │   ├── theme-provider.tsx
│   │   │   ├── theme-toggle.tsx
│   │   │   └── ui/             shadcn primitives
│   │   └── lib/
│   │       ├── api-shared.ts   base url, error parsing, buildUrl
│   │       ├── api-client.ts   browser fetch helper (uses browser Supabase client)
│   │       ├── api-server.ts   server fetch helper (uses next/headers cookies)
│   │       ├── auth.ts         requireUser() server helper
│   │       ├── env.ts          typed env access
│   │       ├── supabase/       client.ts, server.ts, proxy.ts
│   │       ├── types.ts        shared TS types mirroring backend Pydantic
│   │       └── utils.ts        cn() helper
│   ├── proxy.ts                Next 16 session refresh (renamed from middleware.ts)
│   ├── components.json         shadcn config (new-york, slate)
│   ├── next.config.ts
│   ├── tailwind via globals.css (Tailwind v4 @theme inline)
│   └── package.json
├── supabase/
│   └── migrations/
│       ├── 0001_initial_schema.sql     8 tables, enums, RLS, handle_new_user trigger
│       └── 0002_storage_bucket.sql     materials bucket + storage RLS
├── tests/
│   └── e2e/                     Playwright smoke (signup → quiz → practice)
├── docs/                        PRD, architecture, acceptance criteria, implementation plan
├── .env.example
├── .gitignore
└── README.md
```

## 3. Component responsibilities

### Frontend (Next.js 16)

- **App Router** with route groups by feature (`/materials`, `/quiz`, etc.).
- **Server Components** for every page that needs data. They call `requireUser()` and the server `api()` helper. The server helper reads the session JWT via `next/headers` cookies.
- **Client Components** only for interactivity (forms, dialogs, runner, theme toggle). They use the browser Supabase client to read the session and the client `api()` helper.
- **Server Actions** for auth (sign in, sign up, sign out) and settings (save/delete API key).
- **`proxy.ts`** (renamed from `middleware.ts` in Next 16) runs on every request, calls `supabase.auth.getUser()` to refresh tokens if needed, and forwards refreshed cookies.
- **Tailwind v4** via `@theme inline` + `oklch()` design tokens. shadcn new-york style.
- **Validation** with Zod inside React Hook Form. Backend re-validates with Pydantic.

### Backend (FastAPI 0.118+)

- **Routers** under `app/api/routes/`, one per resource. Each router depends on a single helper that builds a per-user Supabase client from the `Authorization: Bearer <jwt>` header.
- **Per-user Supabase client** is the default; it respects RLS. The service-role client is only used to write the encrypted API key column (RLS would refuse otherwise).
- **Services** are stateless and async. They take a `SupabaseClient` and Pydantic models, return Pydantic models. No ORM, no global state.
- **AI providers** are adapter classes (`OpenAIProvider`, `AnthropicProvider`, `GoogleProvider`) selected by a factory. All take `raw_text + count` and return a list of Pydantic `Question` candidates. Strict JSON output is required and validated.
- **MCQ parser** is regex-based. It is intentionally lossy: if the input text doesn't look like an MCQ dump, it returns `[]`. It never guesses.

### Database (Supabase Postgres)

- **8 tables**: `profiles`, `user_settings`, `learning_materials`, `question_sets`, `questions`, `quiz_attempts`, `question_attempts`, `mistake_bank`, `practice_sessions`.
- **Enums** for `material_status`, `question_type`, `question_set_mode`, `ai_provider`, `mastery_status`, `attempt_status`.
- **RLS** is `ENABLE ROW FORCE` on every student-owned table. Policies check `auth.uid() = user_id`.
- **`handle_new_user` trigger** on `auth.users` inserts a `profiles` row and a `user_settings` row so the user can save a key without a follow-up API call.
- **Storage**: a private `materials` bucket. Storage policies use `storage.foldername(name)` so a path of `<user_id>/<material_id>/<file>` is only writable and readable by that user.

### AI providers

- The backend never holds provider keys in environment variables. Each user's key is encrypted with Fernet and stored in `user_settings.api_key_encrypted`.
- Provider calls happen from the backend so the key never reaches the browser.
- Strict JSON schema is enforced; the response is parsed and validated by Pydantic. Validation failures raise `502` with a clear message.

## 4. Data flow examples

### 4.1 Signup

```
Browser                Next.js                  Supabase Auth        Postgres
  │  POST /signup      │                            │                   │
  │  (server action)   │                            │                   │
  ├───────────────────▶│ supabase.auth.signUp       │                   │
  │                    ├───────────────────────────▶│                   │
  │                    │                            │ INSERT auth.users │
  │                    │                            ├──────────────────▶│
  │                    │                            │ handle_new_user   │
  │                    │                            │ trigger fires     │
  │                    │                            │ INSERT profiles,  │
  │                    │                            │ user_settings     │
  │                    │◀───────────────────────────┤                   │
  │  redirect /login   │                            │                   │
  │◀───────────────────┤                            │                   │
```

### 4.2 Generate MCQs

```
Browser        Next.js            FastAPI                Postgres      OpenAI
  │ Generate    │                    │                       │             │
  ├────────────▶│ POST /question-    │                       │             │
  │             │ sets/generate      │                       │             │
  │             ├───────────────────▶│ 1. Verify JWT         │             │
  │             │                    │ 2. Load user_settings │             │
  │             │                    │    decrypt key        │             │
  │             │                    │ 3. Insert question_set│             │
  │             │                    │ 4. Call provider      │             │
  │             │                    ├───────────────────────┼────────────▶│
  │             │                    │                       │             │
  │             │                    │ 5. Parse + validate   │             │
  │             │                    │ 6. Insert questions   │             │
  │             │                    ├──────────────────────▶│             │
  │             │ 201 + set summary  │                       │             │
  │◀────────────┤                    │                       │             │
```

### 4.3 Submit attempt

```
Browser          Next.js            FastAPI               Postgres
  │ Submit quiz  │                    │                      │
  ├─────────────▶│ POST /quiz-        │                      │
  │              │ attempts/{id}/     │                      │
  │              │ submit             │                      │
  │              ├───────────────────▶│ 1. Verify JWT        │
  │              │                    │ 2. Score per-Q       │
  │              │                    │ 3. Upsert mistakes   │
  │              │                    │ 4. Mark attempt sub. │
  │              │                    ├─────────────────────▶│
  │              │ 200 + breakdown    │                      │
  │◀─────────────┤                    │                      │
```

## 5. Security model

- **Transport**: HTTPS only in production. Vercel handles this.
- **Auth**: Supabase Auth issues JWTs. The backend verifies them with `SUPABASE_JWT_SECRET` (HS256). The frontend re-uses the JWT for backend calls.
- **RLS**: every student-owned table has `ENABLE ROW LEVEL SECURITY` + `FORCE ROW LEVEL SECURITY` + a `SELECT/INSERT/UPDATE/DELETE` policy scoped to `auth.uid() = user_id`.
- **Service-role client**: used **only** for writes to `user_settings.api_key_encrypted`. It is not used for any end-user CRUD.
- **API key encryption**: Fernet (AES-128-CBC + HMAC-SHA256). Key material is `ENCRYPTION_KEY` env var, or a SHA-256 of `SUPABASE_JWT_SECRET` as fallback for local dev.
- **Storage RLS**: policies check `storage.foldername(name)[1]::uuid = auth.uid()`. Read, write, update, and delete are all gated.
- **Frontend**: never holds the plaintext API key. The Settings page sends it to `PUT /settings/me/api-key`, gets a 200, and the form resets. The `has_api_key` boolean is the only thing the UI ever reads back.
- **CORS**: backend allows `http://localhost:3000` and the production frontend origin.

## 6. Failure modes

| Failure | Detection | User-visible result |
| --- | --- | --- |
| Supabase JWT invalid/expired | backend raises 401 | Frontend redirects to `/login`. |
| User has no AI key | `provider_factory.get_provider()` raises 400 | UI shows the backend's error message in an alert. |
| Provider call fails | exception caught, mapped to 502 | UI shows the upstream error in an alert; question set is not created. |
| PDF has no text layer (scanned) | extractor returns empty | `material.error_message` is set; UI shows it. |
| Browser hits API with no session | `getAuthHeaders()` returns no Authorization | Backend returns 401; UI redirects to `/login`. |
| Two users, same row | RLS denies | Verified by Supabase MCP RLS check (manual step in acceptance criteria). |

## 7. Next.js 16 conventions in use

This slice targets Next.js 16.2.7 specifically. Differences from earlier training data that mattered here:

- `middleware.ts` is renamed to `proxy.ts` and the export is `proxy` instead of `middleware`.
- `cookies()` is async. Every server-side Supabase client wraps it in `await cookies()`.
- Route handlers (`route.ts`) are unchanged.

All code follows these. See `frontend/proxy.ts` and `frontend/src/lib/supabase/server.ts`.
