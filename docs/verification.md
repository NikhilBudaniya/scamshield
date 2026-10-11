# Local verification record

Date: 2026-10-11

Implementation was delegated to GPT-6 Luna workers; an independent GPT-6 Astra reviewer inspected the implementation and presentation. The coordinator reproduced and resolved review findings before delivery.

## Executed checks

- Backend: `backend/.venv/bin/python -m pytest backend/tests -q` — 34 tests passed, including Developer API/Vertex selection, missing credentials, both classification and explanation paths, and ambient SDK backend flags. Dependency deprecation warnings remain; no failing tests.
- Python modules: `python -m compileall -q backend/app` — passed.
- Frontend: `npm run check:copy` — contextual probability wording and simulator action checks passed.
- Frontend: `npm run build` — TypeScript and Vite production build passed.
- Evaluation: `backend/scripts/evaluate.py` — 40 synthetic normalized requests; 20 development and 20 held-out examples, each with 10 consumer and 10 invoice cases. Classifier outputs are curated fixtures. Results are policy regressions, not model accuracy.
- Browser: submitted a suspicious consumer transfer, generated its explanation, submitted a changed-destination invoice, and submitted a normal repeat invoice. Observed review, review, and continue respectively.
- Browser: edited a scenario's payment-request message and confirmed it did not inherit its original classification. Classification became unavailable and the case required verification.
- Browser: acknowledgment preserved Verify and its original signals; simulated continuation was absent for Verify. Desktop layout inspected at 1440px; mobile inspected at 390px with no horizontal body overflow. Temporary viewport overrides were reset.
- Presentation: six editable PowerPoint slides, all rendered and visually inspected. Corresponding six-page PDF exported and inspected. No measured live performance claim appears in the deck.
- Shell launcher syntax and Git whitespace checks passed.

## Review findings resolved

- Low-probability semantic findings no longer become affirmative explanatory claims or UI evidence descriptions.
- Explanations accept validated evidence-code ordering rather than arbitrary model-authored actions or unsupported claims.
- Insufficient same-currency history is reported as an unavailable check.
- Unsupported demo currencies are rejected.
- Edited fixture text does not inherit saved labels.
- Invoice vendor identity remains distinct from destination account details.
- Explicit auth handling, single-process deployment limits, per-session limits, and provider timeouts are documented.
- Simulator acknowledgment does not clear Verify or permit continued payment; displayed outcomes are explicitly local simulation state.
- The frontend copy-check command uses a TypeScript-supported module resolution mode.
- Developer API selection explicitly passes `vertexai=False`, preventing ambient Vertex/enterprise SDK flags from redirecting requests to Vertex. Regression tests construct the installed SDK client without making network calls.

## Unverified external paths

No live Jev, Vertex AI, or Gemini Developer API call was performed. A read-only Brave inspection found an existing AI Studio project labeled Free tier with an existing API key. Credentials have not been copied into the app. No PostgreSQL instance, Docker build, or Cloud Run deployment was available for execution. Those configuration/integration paths exist but must not be described as verified production support.

The running local demo uses fixture classification and deterministic explanations with SQLite. All input records are synthetic; no real payment is executed.
