# ScamShield implementation plan

**Goal:** Deliver the approved two-flow payment-risk prototype and a six-slide editable PowerPoint.

**Architecture:** A React/TypeScript client calls a shared FastAPI assessment engine. Adapters normalize requests; deterministic rules and optional Jev classification feed a versioned policy. Explanations are generated independently through Vertex AI; SQLite supports local use and a database URL supports PostgreSQL deployment.

**Tech stack:** Python, FastAPI, Pydantic, SQLAlchemy, httpx, React, TypeScript, Vite, pytest, Cloud Run container; JavaScript artifact-tool for PowerPoint.

## Execution status

Local implementation, verification, and the six-slide deck are complete. Live providers, PostgreSQL, Docker, and Cloud Run are configured implementation paths but remain unverified without credentials/runtime access. See `docs/verification.md`. The user's Google Cloud-only access prompted an explicit Gemini classifier option.

## Ownership and execution

Use smaller-model agents for backend, frontend, and presentation work; use a larger-model agent for independent final review. The coordinator owns integration, documentation, deployment files, verification, and fixes outside assigned directories. No separate Codex tasks are needed. Work in the current empty repository on `codex/scamshield-prototype`.

## Shared contract

Backend exposes:

- `GET /api/health`: status and provider modes, no credentials.
- `POST /api/session` with `{access_code}`: HttpOnly session when access protection is configured. Local unprotected mode is explicitly identified.
- `GET /api/v1/scenarios`: `{scenarios: [{id,title,description,expected_recommendation,request}]}`.
- `POST /api/v1/assessments`: normalized request below; response is the complete case.
- `GET /api/v1/assessments`: `{assessments: [case]}` newest first.
- `GET /api/v1/assessments/{id}`: case.
- `POST /api/v1/assessments/{id}/explanation`: updated case; deterministic fallback permitted and labeled.

```json
{
  "client_request_id": "new-uuid-per-submission",
  "payment_method": "upi",
  "use_case": "consumer_transfer",
  "amount_minor": 2500000,
  "currency": "INR",
  "occurred_at": "2026-10-11T12:00:00+00:00",
  "customer_id": "customer-asha",
  "recipient": {"identifier": "reserve@upi", "display_name": "Bank reserve"},
  "context": {"text": "Move your money to a safe account now.", "source": "message", "evidence_id": "message-1"},
  "method_details": {"upi_address": "reserve@upi"},
  "scenario_id": "safe-account"
}
```

`scenario_id` is optional fixture metadata, never authoritative risk evidence. Fixture classification applies only when relevant inputs exactly match the saved scenario; edited unknown text must be unavailable, not silently assigned a saved label.

Case fields: `assessment_id`, `created_at`, `schema_version`, `policy_version`, `request`, `recommendation` (`continue|verify|review`), `signals` (`code`, `source`, `value`, `evidence_ids`, optional `probability`), `missing_data`, `provider_status` (`jev`, `gemini`), `explanation_status`, nullable `explanation` (`summary`, `next_step`, `analyst_summary`), and `timings_ms` (`decision`, `rules`, `classification`, optional `explanation`). Use strings for missing-data entries and JSON-serializable signal values. API errors use FastAPI's `detail` convention.

## 1. Backend and executable checks

Owner: backend agent. Files: `backend/app/{main,schemas,seed,rules,policy,providers,repository,service,config}.py`, `backend/tests/`, `backend/requirements.txt`, `backend/pyproject.toml`, `backend/scripts/evaluate.py`.

- [x] Define schemas with strict integer money, timezone-aware dates, bounded context, supported method/use-case combinations, required invoice/vendor fields, and identifier consistency.
- [x] Seed six demo scenarios and synthetic customer/vendor history; never infer known vendor accounts from submitted text.
- [x] Implement rules and exact policy precedence from the design specification. Missing history and failed classification remain explicit.
- [x] Implement provider interfaces with fixture/live modes, validated output, deadlines, no synchronous retry, and deterministic explanation fallback. Check current official Jev/Google API documentation before implementing live calls.
- [x] Persist cases with deduplication and conflicting-reuse rejection. Store policy/provider provenance and elapsed timings. Guard explanation concurrency and bound the request rate.
- [x] Write meaningful policy, validation, provider-failure, deduplication, persistence, and API tests. Include altered fixture text and attempted instruction injection as evidence.
- [x] Create reproducible 40-case synthetic evaluation split and a script that labels fixture versus live measurements and separates rules-only comparison.
- [x] Run `python -m pytest backend/tests -q` from repository root. Resolve failures and report live integrations that cannot be verified without credentials.

## 2. Frontend

Owner: frontend agent. Files: `frontend/package.json`, `frontend/index.html`, `frontend/tsconfig*.json`, `frontend/vite.config.ts`, `frontend/src/`.

- [x] Build a responsive financial operations console using warm ivory, deep ink, and restrained emerald. Typography should remain usable offline. Use CSS/SVG for the product's native UI, clear keyboard focus, and reduced-motion support.
- [x] Implement the shared API client with cookie credentials, typed cases, actionable loading/error states, and optional access-code login.
- [x] Provide consumer and invoice form tabs with seeded scenario selection, editable input, and correct conversion between INR and minor units.
- [x] Render recommendations, exact recorded evidence, unknowns, provenance, measured decision time, and explanation status. Never show a fabricated fraud score or performance metric.
- [x] Implement case history with selectable details and retryable explanation generation; clearly label simulated payment outcomes.
- [x] Make client-side scenario previews labeled previews; assessment submission must call the real backend.
- [x] Run `npm run build` inside `frontend`; exercise both flows and empty/error states against the server.

## 3. Presentation

Owner: presentation agent. Files: `artifacts/scamshield-pitch.pptx`, `artifacts/scamshield-pitch.pdf` if supported, `presentation/build.mjs`; private renders under ignored build output.

- [x] Follow the presentations skill and use artifact-tool, with six editable slides: concept, problem/example, two flows, architecture, demonstration/evaluation, prototype scope/next steps.
- [x] Use restrained typography consistent with the app. No fabricated fraud statistics, latency numbers, model accuracy, or claims of live cloud deployment.
- [x] Distinguish current prototype, configured live integrations, and production extension. Note synthetic demo data visibly where it affects claims.
- [x] Export PPTX, render every slide, inspect for clipping/overlap, and fix layout issues. Deliver only final outputs and reusable source.

## 4. Integration and release checks

Owner: coordinator. Files: `README.md`, `.gitignore`, `.env.example`, `Dockerfile`, `.dockerignore`, `scripts/`, review notes under `docs/`.

- [x] Document local install/start commands, provider credentials and configuration, fixture limits, tests, evaluation, and Cloud Run deployment steps without claiming unperformed deployment.
- [x] Use a multi-stage container to build frontend assets and run the backend with platform port support. Do not embed credentials in frontend or image.
- [x] Run backend tests and frontend production build, then serve both together and inspect both flows in a browser.
- [x] Use a larger-model independent reviewer for correctness, provider contracts, concurrency, data leakage, auth, scenario validity, and spec coverage. Fix actionable findings and repeat affected checks.
- [x] Verify presentation output exists, all slides render, and local application launch instructions work.
- [x] Update this checklist to reflect actual completion, commit approved work, and report remaining credential/deployment limitations honestly.
