# Invoice Submission Implementation Plan

> **For agentic workers:** Use executing-plans to implement this plan task-by-task. Root coordinates the smaller implementation workers and larger final reviewer already requested by the user.

**Goal:** Release a public invoice-intelligence prototype and complete the prescribed Hack2skill submission package.

**Architecture:** Firebase anonymous ID tokens identify visitors. Cloud Run verifies tokens and calls Gemini for bounded invoice extraction and assessment; Firestore stores owner-scoped cases and daily usage limits. The existing SQLite/access-code path remains for local tests.

**Tech Stack:** React/TypeScript, FastAPI/Pydantic, Firebase Auth, Firestore, Google Gen AI SDK, Cloud Run.

---

## Backend worker

- [ ] Create `backend/app/auth.py`: verify Firebase bearer token using firebase-admin; reject missing, invalid, wrong-project tokens with 401. Never trust a UID from the request body. `AUTH_MODE=access_code|firebase`, default access_code. Firebase mode requires configured project and web config; production accepts Firebase auth instead of shared-code gating.
- [ ] Add `/api/config` with only `{auth_mode, firebase_config, storage_mode, synthetic_data}`. Firebase public configuration is distinct from server credentials. No service-account key or Gemini key is returned.
- [ ] Create `backend/app/firestore_repository.py`: same repository interface as SQLite, scope all document paths to hash of verified owner, use transactional request-id index for idempotency; bounded list, no cross-owner queries. Select with `STORAGE_BACKEND=sqlite|firestore`. Runtime ADC authenticates server.
- [ ] Add transactional daily Gemini reservations to Firestore (per owner and shared daily counter) with configurable limits, default20/owner and500/global; return429 on exhausted quota without model call. Failed provider attempts count. Firestore errors fail closed503. Local process budget remains for SQLite.
- [ ] Add `backend/app/invoices.py`: multipart file endpoint `/api/v1/invoices/extract`, PDF/PNG/JPEG only, max5MiB, validate magic. Accept optional sample_id for named synthetic assets; fixtures only for exact supplied sample bytes. Strict Gemini schema with nullable fields; return warnings/missing fields and extraction status. No arbitrary model prose used as action.
- [ ] Exact response: `{extraction_id, provider_status, model, filename, fields:{invoice_number,vendor_name,amount_minor,currency,destination_account,payment_instructions}, warnings:string[], requires_review:true}`. Currency INR for current demo; field lengths bounded, amount integer positive or null. Upload does not trigger assessment. No raw document persistence.
- [ ] `/api/v1/invoices/samples` returns `{samples:[{id,title,filename,download_url,description}]}`; serve safe named assets without arbitrary paths. Create two synthetic invoices: normal vendor destination and changed destination. Support extraction with actual document bytes using selected Gemini backend and explicit timeout.
- [ ] Tests: cross-owner Firestore read/dedupe, invalid bearer rejection, durable quota exhaustion, extraction schema/size/MIME failures and no-assessment-before-confirmation. Existing tests remain passing. Mock external SDK boundaries; report live paths separately.

## Frontend worker

- [ ] Add Firebase client dependency, initialize from `/api/config`, anonymous sign-in with session persistence, attach current ID token via Authorization for protected calls. Preserve legacy access-code flow. Refresh invalid token once; clear stale case data on auth failure.
- [ ] Invoice is the default workflow. Add upload/sample choice and extraction progress/error feedback before the existing invoice form. Never auto-submit extracted invoice or trust vendor identity; require selecting known vendor and confirming fields. Unknown fields remain editable and visibly missing.
- [ ] Show file name, provenance, warnings, and “Review extracted fields” copy. Label synthetic sample and storage persistence truthfully. Support keyboard and mobile layout.
- [ ] Add per-case JSON export from the selected owned case. No side-by-side comparison feature.
- [ ] Run TypeScript build, existing copy checks; verify token/error handling and no stale visitor records.

## Coordinator: infrastructure and verification

- [ ] Install official Google Cloud SDK in ignored `.local/tools`; verify checksum. Authenticate normally, inspect existing sandbox project and billing; do not reuse production projects.
- [ ] Configure Firebase app and anonymous auth, Firestore default database (deny client access), dedicated Cloud Run service identity, API enablement and least-scope roles. Use existing service credentials through normal auth flow, no browser token extraction.
- [ ] Deploy with source exclusions, zero minimum/one maximum instance, 512MiB,1CPU,concurrency8. Configure selected Gemini backend and durable limits explicitly. Never silently switch providers to bypass quota.
- [ ] Smoke test deployed upload→extract→confirm→assess→explain; check a second visitor cannot read first visitor's cases. Verify Firestore persistence across new requests. Measure actual live timing and failures.
- [ ] Obtain larger-model final review and resolve blockers. Run `backend/.venv/bin/python -m pytest backend/tests -q`, frontend build/copy checks, and `git diff --check`.
- [ ] Publish relevant source to public GitHub after secret scan and inspect anonymous availability. Keep runtime secrets and `.local` excluded.

## Submission worker and coordinator

- [ ] Copy prescribed Slides template; preserve required sections and branding. Populate implemented architecture, measured evidence, screenshots and actual links. Export PDF below5MB, inspect every slide.
- [ ] Record a3–4minute demonstration of actual working UI. Do not substitute slide narration for functionality. Publish an accessible video URL and verify duration.
- [ ] Prepare <=1024character description that explains Firebase, Firestore, CloudRun and Gemini use. Verify each link without signed-in privileges. Complete submission only when all required artifacts are present and accurate.
