# ScamShield — Hack2skill submission draft

**Team:** pulse
**Team leader:** Nikhil Kumar
**Challenge selection:** Choose the applicable option in the live form.
**Submission status:** Public app, repository and 3:03 demo video are public. Full synthetic invoice smoke checks passed on Cloud Run revision 3.
**Observed deadline:** 18 October 2026, 23:59 IST.

## Form description

ScamShield combines AI classification of invoice payment requests with deterministic transaction checks. Vertex AI Gemini 2.5 Flash-Lite extracts invoice fields and classifies impersonation, safe-account claims, urgency, secrecy, upfront fees and verification bypass. A person confirms the fields; rules check amount, history, vendor identity and destination account. Policy maps the evidence to Continue, Verify or Review. Gemini can order recorded evidence for explanations rendered by deterministic templates. Cloud Run hosts the application and API, Firebase provides anonymous authentication, and Firestore stores visitor-scoped cases and request quotas. Two synthetic invoice paths completed live: a routine invoice returned Continue and a changed destination returned Review. The prototype uses synthetic examples and moves no money.

## Submission requirements and current status

- Public repository: https://github.com/NikhilBudaniya/scamshield
- Public Cloud Run app: https://scamshield-304420617883.us-central1.run.app
- Demo video (3:03): https://github.com/NikhilBudaniya/scamshield/releases/download/hackathon-prototype/scamshield-demo.mp4
- Tests: 59 backend tests passed in the current release check. They verify software behavior, not fraud-detection performance.
- Cloud Run service: deployed and publicly reachable at the URL above.
- Live service check: two synthetic invoice flows completed with live Vertex Gemini extraction and contextual classification. A requested explanation used Gemini-ranked evidence and deterministic templates. One case returned Continue; the changed destination case returned Review.
- Firestore check: case readback and retry idempotency passed. Both cases remained available across a Cloud Run revision change. Visitor isolation returned 404 for a cross-owner lookup; unauthenticated API access returned 401, and direct browser reads from Firestore returned 403.
- No submission has been made through the external form.

## Product and architecture

ScamShield accepts a synthetic invoice, extracts candidate vendor, invoice, amount and destination fields, and waits for a person to review and confirm them. The assessment compares the confirmed destination with known vendor details and transaction evidence. Deterministic policy produces Continue, Verify or Review and retains the supporting signals and missing checks. When requested separately, Gemini prioritizes recorded evidence and deterministic templates render an explanation. The simulator moves no money.

The deployed stack is a React and TypeScript client served with FastAPI on Cloud Run, Firebase anonymous authentication, Firestore for owner-scoped case records and quota state, and Vertex AI Gemini 2.5 Flash-Lite for extraction, context classification and evidence prioritization. Deterministic templates render requested explanations. The runtime restricts model attempts to 9 per user per day, 50 globally per day and 200 total. These are request limits, not billing caps.

Jev is a candidate structured decision model for a low-latency classification path. The Jev adapter in the repository passes fixture tests, but it is disabled on the live GCP service and has no project latency or quality measurements. The roadmap is to benchmark it against Gemini on reviewed cases using p50/p95 latency, precision, recall, false-positive rate and calibration before considering activation. The adapter is based on TypeSafe's [Jev and System One model description](https://typesafe.ai/blog/introducing-system-one-models-and-jev).

UK Finance's [Fraud Report 2026](https://www.ukfinance.org.uk/system/files/2026-06/UK%20Finance%20Fraud%20Report%202026.pdf), page 41, reports that UK invoice and mandate fraud in 2025 involved £41.3m in gross losses across 2,305 cases; 68% of lost value was on business and other non-personal accounts. Reported totals include value later recovered. These are UK invoice and mandate fraud figures, not a global estimate.

## Cost and data limits

Project billing is enabled. A ₹100 budget alert is configured through 6 November 2026. Budget alerts notify; they do not stop charges. No credit coverage is confirmed, so live Cloud Run, Firestore and Vertex AI usage may incur charges. Keep demo inputs synthetic and avoid real invoices or bank details. Upload size limits and provider status should be shown as implemented in the deployed build before making claims about them.

## Claims to keep out

Do not claim that ScamShield prevents fraud, executes payments, or achieves a particular accuracy or latency. The 59-test count is a backend regression result, not an AI benchmark. The two live synthetic flows verify this release path, not real-world fraud performance. Do not call the ₹100 budget a spending cap.
