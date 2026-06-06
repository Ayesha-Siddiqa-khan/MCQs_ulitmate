# Acceptance Criteria — MCQ Mentor v0.1

**Status:** v0.1 (vertical slice)
**Last updated:** 2026-06-06

Each criterion is testable. The "How to verify" column lists the MCP tool, command, or test that must pass.

## A. Auth

| # | Criterion | How to verify |
| --- | --- | --- |
| A1 | A new user can sign up with email + password (≥ 8 chars) and lands on `/dashboard`. | Playwright: fill signup form, click submit, expect URL = `/dashboard`. |
| A2 | A `profiles` row and a `user_settings` row are created for the new user. | Supabase MCP: `select * from profiles where id = '<uid>'` and `select * from user_settings where user_id = '<uid>'`. |
| A3 | Sign in with valid credentials returns 200 and the session cookie is set. | Playwright: log out, log in, expect URL = `/dashboard`. Chrome DevTools: confirm `sb-...-auth-token` cookie present. |
| A4 | Sign in with wrong password shows a clear error and does not redirect. | Playwright: log in with `wrong@example.com` / `badpass`, expect alert visible. |
| A5 | Sign out clears the session and redirects to `/login`. | Playwright: click "Sign out", expect URL = `/login`, expect dashboard link gone from nav. |
| A6 | Visiting `/dashboard` while logged out redirects to `/login`. | `curl -I http://localhost:3000/dashboard` returns 307 → `/login`. |
| A7 | Visiting `/login` while logged in redirects to `/dashboard`. | Playwright: log in, navigate to `/login`, expect URL = `/dashboard`. |

## B. Settings / API key

| # | Criterion | How to verify |
| --- | --- | --- |
| B1 | Settings page shows "No key saved" on first visit. | Playwright: visit `/settings` before saving, expect that exact text. |
| B2 | Saving a key shows a success alert and the alert reads "Key on file" with the chosen provider. | Playwright: paste a fake `sk-test-1234567890`, click Save, expect success then key-on-file alert. |
| B3 | The plaintext key is not echoed back. | Chrome DevTools: open Network tab on the response, confirm body has `has_api_key: true` and no key string. |
| B4 | The `user_settings.api_key_encrypted` column in Postgres contains a Fernet token, not the plaintext. | Supabase MCP: `select api_key_encrypted from user_settings where user_id = '<uid>'`. Value must NOT contain the plaintext. |
| B5 | "Remove" deletes the encrypted value. | Playwright: click Remove, expect "No key saved" alert. Supabase MCP: column is NULL. |
| B6 | Generating MCQs with no key on file returns a 400 with a clear message and the UI shows it. | Playwright: with no key, click "Generate MCQs", expect an alert with the backend's message. |

## C. Materials

| # | Criterion | How to verify |
| --- | --- | --- |
| C1 | A new user with zero materials sees the empty state on `/materials`. | Playwright: log in as a fresh user, visit `/materials`, expect "No materials yet" card. |
| C2 | Pasting text and saving creates a `learning_materials` row with `status = 'ready'`, `raw_text` populated, and `storage_path = NULL`. | Supabase MCP: `select status, raw_text, storage_path from learning_materials where id = '<id>'`. |
| C3 | Uploading a text-only PDF (or DOCX) populates `raw_text` after extraction. | Upload sample.pdf, wait for `status = 'ready'`, query `raw_text` and assert non-empty. |
| C4 | A scanned PDF (no text layer) sets `status = 'error'` and writes an `error_message`. | Upload scan.pdf, assert `error_message` contains a hint about OCR. |
| C5 | The storage object lives at `<user_id>/<material_id>/<file>`. | Supabase MCP `storage.list_objects('materials', '<user_id>')` shows the object. |
| C6 | A second user cannot list or read the first user's material files. | Supabase MCP: as user B, `storage.list_objects('materials', '<user_A_id>')` returns empty / forbidden. |
| C7 | Deleting a material removes the row and (eventually) the storage object. | Playwright: click Delete, expect row gone in Supabase MCP. |

## D. Question generation

| # | Criterion | How to verify |
| --- | --- | --- |
| D1 | With a valid key + a material that has text, "Generate MCQs" returns a `question_set` with N questions. | Playwright: open a material, click Generate, expect redirect to `/quiz-sets/<id>` with N questions shown. |
| D2 | Each generated question has `options_json` with 4 options (a/b/c/d) and `correct_answer` matching a key. | Supabase MCP: `select options_json, correct_answer from questions where question_set_id = '<id>'`. |
| D3 | Without a key, generation returns 400 and no row is created. | Supabase MCP: row count for that user in `question_sets` is unchanged. |
| D4 | Provider call failures surface as 502 with the upstream message; no partial rows leak. | Force a bad key, click Generate, expect the alert and `select count(*) from question_sets` unchanged. |
| D5 | Importing a material that already contains MCQ-like text (mode = extract) creates questions via the regex parser and the count matches the dump. | Drop a fixture file with 5 MCQs, import, assert 5 rows in `questions`. |

## E. Quiz attempt

| # | Criterion | How to verify |
| --- | --- | --- |
| E1 | Starting a quiz creates a `quiz_attempts` row with `status = 'in_progress'`. | Supabase MCP: row exists with the expected status. |
| E2 | Submitting a complete attempt sets `status = 'submitted'`, computes `correct_count` and `score_percent`. | Submit answers, check the row. |
| E3 | Wrong answers are upserted into `mistake_bank` with `status = 'new_mistake'` and `wrong_attempts = 1`. | Supabase MCP: row exists with those values. |
| E4 | Re-submitting the same wrong answer moves the mistake to `needs_practice` and increments `wrong_attempts`. | Take a second attempt with the same wrong answer, check the row. |
| E5 | Getting a previously-wrong question right moves it to `improving` and increments `correct_after_wrong`. | Take a third attempt and answer correctly, check the row. |
| E6 | Two correct answers in a row after a wrong one move the question to `mastered`. | E5 + one more correct, check the row. |
| E7 | The results page shows the per-question breakdown with the user's answer, the correct answer, and an explanation where present. | Playwright: visit `/results/<id>`, expect "correct" / "wrong" / "unanswered" badges and the breakdown. |

## F. Mistakes + practice

| # | Criterion | How to verify |
| --- | --- | --- |
| F1 | `/mistakes` lists every open mistake with its mastery status. | Playwright: visit `/mistakes`, expect a card per row. |
| F2 | The mastery breakdown card shows four counts that sum to the total. | Sum the four numbers on the page, compare to total. |
| F3 | "Start practice session" creates a `practice_sessions` row and a fresh `question_set` of N mistakes. | Supabase MCP: rows in both tables; question count matches the limit. |
| F4 | The practice quiz behaves like any other quiz. Mastery is updated as correct/incorrect answers come in. | Playwright: take the practice quiz, check `mistake_bank` rows updated. |
| F5 | Already-`mastered` questions are NOT included in the new practice set. | Supabase MCP: `select count(*) from questions where question_set_id = '<practice_set_id>'`, expect 0 mastered ids. |

## G. Dashboard

| # | Criterion | How to verify |
| --- | --- | --- |
| G1 | The dashboard renders 4 stat cards: materials, question sets, quiz attempts, open mistakes. | Playwright: log in, visit `/dashboard`, expect 4 stat cards. |
| G2 | The "Recommended practice" panel lists up to 5 questions, ranked. | Playwright: expect a list with the right count. |
| G3 | "Add an AI key" card shows when `user_settings.has_api_key = false`. | With no key, the card is visible. After saving, it disappears. |

## H. Cross-cutting

| # | Criterion | How to verify |
| --- | --- | --- |
| H1 | `cd backend && uv run pytest` is green (4/4). | `uv run pytest`. |
| H2 | `cd frontend && npm run lint` is green (0 errors, 0 warnings). | `npm run lint`. |
| H3 | `cd frontend && npx tsc --noEmit` is green. | `npx tsc --noEmit`. |
| H4 | `cd frontend && npm run build` succeeds; `Proxy (Middleware)` line is present. | `npm run build`. |
| H5 | `curl http://localhost:3000/` returns 200 and the page contains "Turn study material". | `curl` smoke. |
| H6 | `curl http://localhost:8000/healthz` returns 200 with `{"status":"ok"}`. | `curl` smoke. |
| H7 | RLS is enabled and forced on every student-owned table. | Supabase MCP: `select relname, relrowsecurity, relforcerowsecurity from pg_class where relname in (...);` — every row has both true. |
| H8 | Playwright e2e smoke test covers: signup → add key → upload text → generate 3 MCQs → take quiz → submit → see results → start practice. | `cd tests/e2e && npx playwright test`. |

## I. Failure / negative criteria

| # | Criterion | How to verify |
| --- | --- | --- |
| I1 | Uploading a 25 MB file is rejected by the frontend with a clear error. | Playwright: pick a 25 MB file, expect "Max 20 MB" message. |
| I2 | Setting an invalid provider on the settings form is rejected by Zod before submit. | Playwright: hack the form to send `provider: "banana"`, expect inline error. |
| I3 | Submitting an empty quiz is allowed but every question is marked "unanswered" and score is 0. | Playwright: open a quiz, click Submit without answering, expect 0% and 0 corrects. |
| I4 | The AI key field is masked by default and has a "Show key" toggle. | Playwright: input type is `password` until toggle clicked, then `text`. |
| I5 | No console errors on the home page in production build. | Chrome DevTools: navigate to `/`, expect 0 console errors of level "error". |
| I6 | No 4xx/5xx in the network log on a clean happy-path run. | Chrome DevTools: walk signup → quiz, expect all responses 2xx/3xx. |
