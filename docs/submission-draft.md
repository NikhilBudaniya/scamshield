# ScamShield — Hack2skill submission draft

**Status:** Draft only. The local invoice walkthrough is verified in fixture mode. Live Gemini extraction and cloud persistence are not verified; Cloud Run deployment, public repository URL, product URL and demo video are pending. Do not submit until the public links pass anonymous-browser checks.
**Observed deadline:** 18 October 2026, 23:59 IST.

**Registered team name:** pulse
**Team leader:** Nikhil Kumar
**Challenge selection:** Select the applicable option in the live form.

## Description for the submission form

ScamShield is a human-reviewed invoice-risk prototype. In the local fixture-mode walkthrough, a person selects or uploads a synthetic invoice, reviews candidate fields, chooses a known vendor record and requests an assessment. Deterministic rules compare the confirmed destination with vendor details and transaction history. The policy returns continue, verify or review with visible evidence and missing checks. No payment is executed. Live Gemini extraction is unverified. Firebase Auth and Firestore code are implemented, but live credentials and persistence checks remain unverified; Cloud Run deployment is pending credit coverage. All sample data is synthetic.

**Character count:** 667 / 1,024 maximum.

## Submission requirements and current status

- Prescribed AI Builder Cup template copied to the connected Drive account; the original remains untouched.
- Local invoice review: verified with a saved synthetic fixture. The screenshot shows fixture mode, not live Gemini extraction.
- Tests: 52 backend tests pass in the current release check. This is software verification, not a fraud-performance measure.
- Firebase Auth and Firestore: implemented; live credentials and hosted persistence remain unverified.
- Cloud Run deployment: pending credit coverage and deployment checks.
- Public GCP / Cloud Run product URL: pending deployment and anonymous-browser verification.
- Public GitHub repository URL: pending confirmation and public-access verification.
- Demo video: pending recording. The current form asks for 3–4 minutes.
- No external submission has been made.

## Technical and cost language

The local app uses synthetic INR consumer and invoice forms, FastAPI, SQLite, fixture-first providers and a shared policy engine. Its invoice walkthrough uses a saved fixture. Gemini extraction with human confirmation is the intended live path; it has not been verified. Firebase Auth and Firestore code are implemented, while live credentials and persistence checks remain unverified. Cloud Run deployment is pending credit coverage.

Gemini Developer API free-tier quota may apply to eligible models, subject to current eligibility, rate limits and data-use terms. Google’s pricing page says free-tier content may be used to improve Google products; use synthetic data only. Cloud usage and quotas depend on project configuration. No paid services are provisioned and no cost estimate is available. Reference: [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing), checked 18 October 2026.

## Claims to keep out until measured

Do not claim that the prototype prevents fraud, executes payments, has verified live Gemini behavior, or achieves specific accuracy or latency. The current release check reports 52 passing backend tests. A historical 40-case synthetic policy evaluation used curated fixture outputs. Neither establishes live-model or real-world fraud performance.
