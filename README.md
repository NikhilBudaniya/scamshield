# ScamShield

ScamShield is a synthetic invoice-payment review prototype. A visitor can upload a PDF, PNG, or JPEG invoice (up to 5 MiB; PDFs up to 10 pages and images up to 20 megapixels), review extracted fields, select a known synthetic vendor, and explicitly request a payment-risk assessment. Malformed and encrypted PDFs are rejected before provider use. Deterministic rules compare the destination with the saved vendor record and available transaction history. Gemini is an optional extraction and contextual-analysis provider. Every case requires human review; no payment is executed and no result proves fraud or safety.

Try the [public prototype](https://scamshield-304420617883.us-central1.run.app). It runs on Cloud Run with Firebase anonymous authentication, Firestore, and Vertex AI Gemini 2.5 Flash-Lite. Two synthetic invoice flows were verified end to end on 18 October 2026. The local fixture workflow is also available without cloud credentials or model calls.

The [recorded demo](https://www.loom.com/share/76e58b695b58433f998c84a59b3d0d2b) shows the deployed app using synthetic invoices. The [submission release](https://github.com/NikhilBudaniya/scamshield/releases/tag/hackathon-prototype) contains the prescribed pitch deck.

## Local offline demo

Requires Python 3.12 or later and Node.js 22 or later.

```bash
python3 -m venv backend/.venv
backend/.venv/bin/pip install -r backend/requirements.txt
cd frontend
npm ci
npm run build
cd ..
bash scripts/start-local.sh
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). The launcher binds to loopback and stores local cases in `.local/scamshield.db`. Defaults use SQLite, offline classification fixtures, and deterministic explanations. The two downloadable synthetic invoices can be extracted from their exact sample bytes in fixture mode. Other uploads report that extraction is unavailable; no remote model is called.

The local server has no access-code gate unless `DEMO_ACCESS_CODE` is set. For a protected local session, copy `.env.example` to `.env`, set a private `DEMO_ACCESS_CODE`, and generate a secret with `python3 -c 'import secrets; print(secrets.token_hex(32))'`. Set `SESSION_SECRET` to that value, keep `AUTH_MODE=access_code`, `LOCAL_DEVELOPMENT=true`, and `COOKIE_SECURE=false`, then explicitly load the file before starting:

```bash
cp .env.example .env
chmod 600 .env
# Edit .env locally; do not commit it.
set -a
source .env
set +a
bash scripts/start-local.sh
```

The application does not automatically load `.env`. Provider modes remain in fixture mode unless you explicitly change them. Do not use real financial documents or personal data in this prototype.

For frontend development, start the backend and run `npm run dev` in `frontend`; Vite proxies `/api` to port 8000.

## Configuration

The important modes are:

| Purpose | Local default | Public GCP target |
| --- | --- | --- |
| Authentication | `AUTH_MODE=access_code` (or local unprotected when no code is set) | `AUTH_MODE=firebase` with anonymous Firebase Authentication |
| Storage | `STORAGE_BACKEND=sqlite` | `STORAGE_BACKEND=firestore` |
| Gemini | `GEMINI_MODE=fixture` | `GEMINI_MODE=live`, `GEMINI_BACKEND=vertex` |
| Context classifier | `CONTEXT_PROVIDER=jev`, `JEV_MODE=fixture` | `CONTEXT_PROVIDER=gemini`; Jev is disabled in the public deployment |

`GET /api/config` is public and returns the selected auth/storage modes and Firebase client configuration. In Firebase mode, protected API requests require `Authorization: Bearer <Firebase ID token>`; the backend verifies the token and scopes data to its verified UID. In access-code mode, protected calls use the HTTP-only session cookie. Server API keys and service credentials are never returned by `/api/config`.

For Firebase mode, configure `FIREBASE_PROJECT_ID`, `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, and `FIREBASE_APP_ID`. The project ID falls back to `GOOGLE_CLOUD_PROJECT`. Enable anonymous sign-in in Firebase Authentication. Managed production Firebase mode requires `STORAGE_BACKEND=firestore`; startup rejects SQLite so cases and quotas cannot silently become ephemeral. Firestore access is server-side through Application Default Credentials; configure rules so browsers cannot read or write application records directly.

For live Gemini, select one backend explicitly. `GEMINI_BACKEND=developer` uses `GEMINI_API_KEY`; `GEMINI_BACKEND=vertex` uses `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and the runtime's Google credentials. No automatic switch between Developer API and Vertex occurs. Gemini API free usage or credits are not guaranteed; the deployed project has billing enabled and credit coverage is unconfirmed. Review current [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) and [Vertex AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) for the selected project before enabling live mode.

The durable Firestore model-attempt limits are 9 per verified visitor and 50 globally per UTC day, with 200 attempts across the lifetime of the Firestore database. Failed live attempts count toward all limits. SQLite mode instead uses a process-local budget. Provider calls use bounded timeouts. Fixture output is not a measurement of model accuracy.

See [.env.example](.env.example) for all local settings and [docs/cloud-deployment.md](docs/cloud-deployment.md) for the public setup and cost controls.

## API workflow

1. Fetch `/api/config` and initialize the selected auth mode.
2. Fetch `/api/v1/invoices/samples` and `/api/v1/invoices/vendors`.
3. Upload the `file` plus optional `sample_id` to `/api/v1/invoices/extract` as multipart form data. Extraction returns nullable structured fields, warnings, and provider provenance; it does not create an assessment.
4. Let the person edit and confirm the extracted values, select the known vendor record, and submit `/api/v1/assessments`.
5. Review evidence and missing checks, then request the separate explanation if desired.

Uploads accept PDF, PNG, and JPEG, enforce MIME/signature checks, a 5 MiB limit, a 10-page PDF limit, and a 20-megapixel image limit, and are not persisted. Malformed or encrypted PDFs are rejected before provider calls. Synthetic fixture extraction is bound to exact sample bytes. An extracted vendor name never becomes a trusted vendor identity automatically.

## Deployment status and limitations

The deployed public topology is one Cloud Run service serving the frontend and FastAPI, Firebase Authentication for visitor identity, Firestore for persistent owner-scoped cases and model quotas, and Gemini for extraction and contextual analysis. Use zero minimum and one maximum Cloud Run instance for the initial demo. These settings do not cap billing. Cloud Run, build artifacts, Gemini, and Google Cloud services can incur charges; free credits or eligibility remain under investigation.

Live extraction, context classification, and explanation passed for a routine invoice (Continue) and a changed destination invoice (Review). Case readback, retry idempotency, anonymous authentication, cross-visitor isolation, and denied direct Firestore access were verified. Browser cases remained available after a Cloud Run revision change. SQLite is suitable for local use only; Cloud Run's filesystem is ephemeral. See the deployment checklist for the exact environment values and acceptance checks.

## Verification

```bash
backend/.venv/bin/pip install -r backend/requirements-dev.txt
backend/.venv/bin/python -m pytest backend/tests -q
mkdir -p .local
backend/.venv/bin/python backend/scripts/evaluate.py > .local/evaluation.json
cd frontend
npm run check:copy
npm run build
```

The 40-case evaluation is a fixture-based policy regression set split into disjoint development and held-out families. It does not measure classifier accuracy or live model performance. The current release has 59 passing backend tests and two live synthetic integration cases. Neither is a real-world fraud benchmark. The public demo has bounded model quotas; exhausted quotas return an explicit error.
