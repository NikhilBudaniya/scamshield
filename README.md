# ScamShield

A payment-risk prototype for a 48–72-hour hackathon. One assessment API supports a consumer UPI simulator and a business invoice-payment simulator. It combines deterministic transaction rules with optional contextual classification and returns `continue`, `verify`, or `review` with recorded evidence.

All payment records are synthetic. No money moves. A `continue` recommendation is not a guarantee that a transaction is safe. Both demo adapters currently accept INR; adding currencies requires deliberate validation and matching historical data.

## Local setup

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

Open [the local application](http://127.0.0.1:8000). The local launcher binds only to the loopback interface and stores cases in `.local/scamshield.db`. Default mode uses explicit saved classification fixtures and deterministic explanations; it does not call a remote AI service.

For frontend development, run the backend and then `npm run dev` in `frontend`. Vite proxies `/api` to port 8000.

## Google Cloud and Jev configuration

Provider modes are independent. Set `CONTEXT_PROVIDER=gemini` and `GEMINI_MODE=live` for a Google Cloud-only AI demo with Gemini classification and explanations. Alternatively, keep `CONTEXT_PROVIDER=jev` and `JEV_MODE=fixture` to combine saved Jev examples with live Gemini explanations. The provider used for classification is explicit; this is not a silent fallback.

```bash
cp .env.example .env
# Edit .env locally. Set GOOGLE_CLOUD_PROJECT and the region/model available to you.
# Set a private DEMO_ACCESS_CODE and a random SESSION_SECRET.
# Set GEMINI_MODE=live and CONTEXT_PROVIDER=gemini for Google Cloud-only use.
# Keep JEV_MODE=fixture until Jev access is available.
set -a
source .env
set +a
```

With the Google Cloud CLI installed, authenticate locally using Application Default Credentials:

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project "$GOOGLE_CLOUD_PROJECT"
```

The project must have billing, the Vertex AI API, and permission to invoke the selected model. Select a model available in your project/region. Cloud Run should use its attached service account rather than a downloaded key. Secrets belong in backend environment configuration or Secret Manager, never in frontend files.

To enable Jev later, set `JEV_MODE=live` and configure `JEV_API_KEY`. The classification deadline defaults to two seconds. Failed live calls are marked unavailable and trigger verification as appropriate; they are never silently replaced with a saved successful classification.

Saved fixtures are reproducible examples, not a general-purpose text classifier. Edited or unrecognized request text must not inherit the original scenario's saved classification. The UI reports provider provenance for each case.

Official integration references: [TypeSafe API documentation](https://docs.typesafe.ai/), [Google Gen AI SDK](https://googleapis.github.io/python-genai/), and [Cloud Run source deployments](https://cloud.google.com/run/docs/deploying-source-code).

## Architecture

```text
UPI form / invoice form
          |
  validated shared request
          |
  history + rules + contextual classification
          |
     versioned policy
          |
    persisted assessment ------> separate Gemini explanation request
          |                                      |
    recommended action <---------------- evidence-based explanation
```

The case records its source evidence, missing checks, provider mode, policy version, and server-measured timings. Gemini prioritizes recorded evidence for an explanation; the server validates the selected evidence and renders the wording and next step from controlled templates. The model cannot introduce a new recipient claim or change the recommended action. Explanation failure leaves the decision intact and uses a deterministic fallback.

Simulator cancellation, continuation, and independent-check acknowledgment are browser-session demonstration state, not bank actions or durable case workflow records. Acknowledgment never erases a risk signal or clears a review recommendation.

## Deployment

The `Dockerfile` builds the frontend and serves it alongside FastAPI. It honors Cloud Run's `PORT` variable. SQLite is appropriate for a local demo; its Cloud Run filesystem is ephemeral and does not provide shared persistence across instances. Use Cloud SQL/PostgreSQL for a persistent cloud demo.

Build locally when Docker is available:

```bash
docker build -t scamshield .
docker run --rm -p 8080:8080 --env-file .env scamshield
```

For a cloud deployment, configure a dedicated service account, database URL, session secret, access code, provider modes, and secure cookies. Keep the service authenticated while testing. A proposed source deployment command is:

```bash
gcloud run deploy scamshield --source . --project "$GOOGLE_CLOUD_PROJECT" --region us-central1 --max-instances 1 --no-allow-unauthenticated
```

Use a Cloud Run deployment region such as `us-central1` rather than `global`; the Vertex model location may be `global`. Set `LOCAL_DEVELOPMENT=false` and `COOKIE_SECURE=true` for HTTPS deployment. Supply service account, database connection, and environment/secrets through your project's configuration. The command alone does not provision these dependencies. This repository does not claim a live deployment until it has been run and checked.

Run this prototype with one worker and at most one instance. Session quotas and explanation locks are process-local and reset on restart. Multiple revisions during deployment may also require users to sign in again. Shared sessions, distributed locks, and distributed rate limiting are required before scaling out.

## Verification commands

```bash
backend/.venv/bin/pip install -r backend/requirements-dev.txt
backend/.venv/bin/python -m pytest backend/tests -q
backend/.venv/bin/python backend/scripts/evaluate.py > .local/evaluation.json
cd frontend
npm run check:copy
npm run build
```

The evaluation output records 40 synthetic cases split into 20 development and 20 held-out cases. It exercises normalized requests, deterministic rules, and the policy with curated classifier fixtures. These are policy regression checks; classifier accuracy and live latency still require separate credentialed runs. PostgreSQL integration and the container deployment have not been executed in this workspace.

## Scope and evaluation

The six walkthroughs include safe-account impersonation, a legitimate large transfer, an ambiguous urgent request, changed vendor details, a normal repeat invoice, and classifier failure. Configured thresholds are demonstration settings, not calibrated banking rules.

Fixture evaluation verifies policy behavior and integration. It is not a measurement of Jev detection accuracy. Live evaluation requires credentials and independent labels. Synthetic sample sizes cannot establish real-world fraud performance.

The approved design and implementation checklist are in `docs/superpowers/`. The short pitch deck is delivered under `artifacts/`.
