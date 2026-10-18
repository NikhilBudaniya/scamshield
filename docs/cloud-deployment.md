# Public demo deployment

**Status:** deployed and verified on 18 October 2026. [Public prototype](https://scamshield-304420617883.us-central1.run.app), revision `scamshield-00003-fhv`. Two synthetic invoice cases passed live extraction, classification and explanation; case readback, idempotency, visitor isolation and denied direct Firestore access passed. Browser cases survived a revision change. See [verification](verification.md).

## Deployed topology

One Cloud Run service serves the built frontend and FastAPI API. Firebase Authentication creates anonymous visitor identities; the browser sends an ID token and the backend verifies it before accessing visitor data. Firestore stores assessment cases and idempotency records under owner-scoped paths, and transactionally reserves model calls against daily per-visitor, daily global, and lifetime global limits. Gemini is the selected provider for invoice extraction and contextual analysis when `GEMINI_MODE=live`. Synthetic invoice fixtures remain available when live Gemini is not configured.

The initial Cloud Run target is request-based billing, zero minimum instances, one maximum instance, one Uvicorn worker, 512 MiB memory, one CPU, and concurrency eight. These settings help limit idle runtime use but do not cap billing. Build artifacts, Firestore, and model calls can incur charges. Eligibility for free credits and free model usage is still being investigated; no cost guarantee is made.

The application does not use Cloud SQL for this release. SQLite remains for local development only because Cloud Run's filesystem is ephemeral. Firestore is the deployed durable case store. Uploaded invoice bytes are held only for the extraction request and are not stored.

## Required application configuration

The private Cloud Run runtime configuration should set:

```text
AUTH_MODE=firebase
STORAGE_BACKEND=firestore
ENVIRONMENT=production
LOCAL_DEVELOPMENT=false
FIREBASE_PROJECT_ID=PROJECT_ID
FIREBASE_API_KEY=FIREBASE_WEB_API_KEY
FIREBASE_AUTH_DOMAIN=PROJECT_ID.firebaseapp.com
FIREBASE_APP_ID=FIREBASE_WEB_APP_ID
GOOGLE_CLOUD_PROJECT=PROJECT_ID
DAILY_MODEL_LIMIT_PER_USER=9
DAILY_MODEL_LIMIT_GLOBAL=50
TOTAL_MODEL_LIMIT_GLOBAL=200
GEMINI_BACKEND=vertex
GOOGLE_CLOUD_LOCATION=global
GEMINI_MODE=live
CONTEXT_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash-lite
GEMINI_TIMEOUT_SECONDS=20
GEMINI_CLASSIFICATION_TIMEOUT_SECONDS=15
```

Use the Firebase web app's actual public client values; never put server credentials in the frontend config. `FIREBASE_PROJECT_ID` may fall back to `GOOGLE_CLOUD_PROJECT`. Enable Firebase anonymous authentication. The production startup check rejects Firebase mode with SQLite so cases and quotas remain durable. Configure Firestore rules to deny direct client reads and writes; the backend uses Application Default Credentials through its Cloud Run service identity.

Choose the Gemini backend explicitly. Developer API mode uses `GEMINI_BACKEND=developer` and `GEMINI_API_KEY`; Vertex mode uses `GEMINI_BACKEND=vertex`, `GOOGLE_CLOUD_PROJECT`, a location, and the runtime identity. Do not configure automatic fallback between them. Set `CONTEXT_PROVIDER=gemini` to use Gemini for payment-message classification; otherwise the default classifier remains Jev. Keep `GEMINI_MODE=fixture` until a real request has been verified. The conservative live-model settings use `gemini-2.5-flash-lite`, at most 9 attempts per user and 50 attempts globally per UTC day, and 200 total attempts across the life of the Firestore database. Reservations increment all three counters atomically before a model call, including calls that fail. At exhaustion, the API returns 429; Firestore errors fail closed with 503. These are request limits, not a hard billing cap.

Invoice uploads are limited to 5 MiB, 10 PDF pages, or 20 megapixels for PNG/JPEG images. PDFs are parsed before provider use; malformed or encrypted PDFs are rejected. The backend sends accepted file bytes to the selected Gemini provider only in live mode and does not persist the uploaded bytes.

Do not put API keys, access codes, tokens, or service-account JSON in source, Docker layers, `.env.example`, or a public submission. `FIREBASE_API_KEY` is the Firebase browser configuration value; Gemini keys and service credentials are server-side secrets. Before deployment, confirm the deployment mechanism places any Gemini key in Secret Manager rather than a plain environment file. The current helper accepts a private environment YAML; it does not itself configure Secret Manager bindings, so live-key deployment needs that secret wiring to be completed and reviewed.

For access-code mode instead of Firebase, use `AUTH_MODE=access_code`, set a strong `DEMO_ACCESS_CODE` and `SESSION_SECRET` of at least 32 characters, and set `COOKIE_SECURE=true`. Firebase mode is the intended public visitor flow. Never set `LOCAL_DEVELOPMENT=true` in Cloud Run.

## Local setup and deployment helper

The local offline path is described in the repository [README](../README.md). Keep `AUTH_MODE=access_code`, `STORAGE_BACKEND=sqlite`, and fixture provider modes there. `.env` is loaded only when explicitly sourced.

The optional project-local Google Cloud SDK, if installed, belongs under `.local/tools/google-cloud-sdk` and is ignored by Git and cloud builds. `.gcloudignore` excludes environment files, local databases, tool caches, generated materials, and dependency caches. Inspect the source upload list before deploying:

```bash
gcloud meta list-files-for-upload
```

Authenticate through the normal Google Cloud CLI login flow. Never copy browser cookies or tokens into scripts. Use explicit project arguments for mutating commands. The helper command is:

```bash
bash scripts/deploy-cloud-run.sh PROJECT_ID /absolute/path/to/private-runtime.yaml us-central1
```

The helper deploys publicly reachable HTTPS to Cloud Run; Firebase bearer-token verification protects API data. It uses one maximum instance and zero minimum instances. The helper does not provision Firebase, Firestore, APIs, billing, IAM roles, or model access. Inspect the script and Cloud Run configuration before using it. Do not embed a personal project identifier in shared docs or examples.

## Cloud prerequisites

- Choose a dedicated sandbox project and confirm billing and free-credit eligibility. Avoid using a production project.
- Enable Cloud Run, Cloud Build, Artifact Registry, Firebase Authentication, and Firestore only in the selected project as required by the deployment.
- Configure Firebase anonymous sign-in and the public web app values used by `/api/config`.
- Create a dedicated `scamshield-runtime` service identity. Firestore server clients use IAM; `roles/datastore.user` provides read/write data access. It is broad at the project level, so use a least-privilege custom role or supported database-level IAM condition when feasible. The backend hashes verified visitor UIDs into owner-scoped paths.
- Firebase ID-token verification checks revocation (`check_revoked=True`), which requires the Authentication user-read permission `firebaseauth.users.get` and performs an additional network check. Grant that permission through the narrowest suitable role/custom role; Firebase documents the check and its extra request in [Manage User Sessions](https://firebase.google.com/docs/auth/admin/manage-sessions?hl=en) and the permission in [Firebase IAM permissions](https://firebase.google.com/docs/projects/iam/permissions).
- Keep Firestore client access denied with deny-all client rules; all application data access goes through the verified backend owner identity. Firestore's [server-client IAM guidance](https://docs.cloud.google.com/firestore/docs/security/iam) describes `roles/datastore.user` and related permissions.
- Vertex mode needs the selected model invocation permissions; Developer API mode needs the Gemini key securely mounted.
- Store private runtime configuration outside the repository. Store any model API key in Secret Manager and bind access to the runtime identity.
- Start with fixture mode if live provider permission, pricing, or key wiring is not verified.

## Acceptance checks

1. The public Cloud Run URL loads over HTTPS in a fresh browser session and Firebase anonymous sign-in succeeds.
2. Missing and invalid bearer tokens receive 401; the backend derives owner identity only from the verified token.
3. A second visitor cannot list, fetch, explain, or reuse the first visitor's cases or idempotency keys.
4. The synthetic samples download, extract, and show fixture provenance only for exact sample bytes; arbitrary uploads in fixture mode remain unavailable.
5. PDF, PNG, and JPEG uploads are checked against MIME and file signatures and rejected above 5 MiB, 10 pages, or 20 megapixels. Malformed and encrypted PDFs fail before provider use. Upload does not create an assessment until a person confirms fields and submits one.
6. A live Gemini result is shown only after an actual provider response. Test extraction, classification, explanation, timeout, invalid response, and selected backend behavior without any silent paid-backend fallback.
7. Firestore cases survive a Cloud Run restart. Daily per-user/global and lifetime global attempt quotas persist and return 429 before another model call. Storage failure returns 503.
8. The service identity cannot access unrelated resources; Firestore denies browser-direct data access.
9. Submission materials state the actually tested auth, storage, provider mode, URL, and cost caveats.

## Cost and lifecycle

The approved planning budget is ₹100 total out-of-pocket through 6 November 2026. A project-scoped ₹100 billing budget has alerts at 25%, 50%, 90% and 100%, for 18 October through 6 November inclusive. Cloud Run uses zero minimum and one maximum instance; Firestore uses its free-tier-eligible default database. Vertex Gemini usage is billed unless covered by applicable credits. Credit coverage has not been confirmed. No zero-cost guarantee is made. Review [Cloud Run pricing](https://cloud.google.com/run/pricing), [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing), and [Vertex AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) before enabling live calls. Budgets generally alert rather than enforce a hard stop; quotas in this app restrict model requests but do not cap all project charges.

Firestore cases and daily/lifetime usage counts persist beyond instance replacement. Access-code session state and single-flight explanation locks are process-local; use Firebase mode for the public service. The initial one-instance setting is a deployment constraint, not distributed locking or an availability guarantee. Review billing and model counters during evaluation; request approval before raising the spending budget. Keep the prototype available through evaluation. After evaluation, remove resources only when authorized.
