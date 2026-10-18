# Live release verification — 18 October 2026

Public app: https://scamshield-304420617883.us-central1.run.app

Cloud Run revision: `scamshield-00003-fhv`.

- 59 backend tests passed; the larger-model final review found no release-critical blockers in the provider fixes.
- Two synthetic PDF invoices completed live Vertex Gemini 2.5 Flash-Lite extraction, context classification and explanation. The routine invoice returned Continue; the changed destination invoice returned Review.
- Firebase anonymous identities were created through the public auth service. Unauthenticated API access returned 401.
- Firestore case readback and retry idempotency passed; a second visitor received 404 for another visitor's case and an empty case list. Direct Firestore reads using the visitor token returned 403.
- Browser cases created on revision 2 were retrieved after revision 3 deployed. Live provider labels and the saved destination mismatch were visible.
- The initial live checks found and resolved an unsupported extraction schema constraint and contradictory explanation instructions. Both were retested against the real provider.
- These are functional integration checks on synthetic inputs, not fraud accuracy, production readiness or latency benchmarks. Historical fixture evaluation remains separate.
- The deployed app enforces 9 model attempts per visitor per UTC day, 50 globally per UTC day and 200 lifetime attempts. Failed attempts count. The ₹100 billing alert does not enforce an exact spending cutoff.

## Historical local verification — 11 October 2026

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
