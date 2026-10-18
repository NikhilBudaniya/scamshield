# ScamShield — 3–4 minute demo script

**Recording status:** Not recorded. Use this script only after the invoice upload flow, Gemini extraction, Firebase identity, Firestore persistence and Cloud Run URL pass the release checks. If any live step is unavailable, label it as unavailable and do not stage or imply a successful call. Use synthetic invoices only.

**Target length:** About 3 minutes 30 seconds. The current Hack2skill form asks for a 3–4 minute video.

## 0:00–0:25 — The invoice risk

**Say:** “Invoice fraud can change the destination account while the invoice looks routine. ScamShield asks a human to check extracted invoice details against a known vendor before a simulated payment assessment.”

**Show:** The public app in a fresh anonymous browser session. Identify it as a prototype and point out the synthetic-data label.

## 0:25–1:00 — Upload and extract

**Do:** Select the supplied synthetic invoice sample or upload a synthetic PDF, PNG or JPEG no larger than 5 MiB. Start extraction.

**Say:** “Gemini returns candidate invoice fields in a bounded schema. Extraction does not submit a payment or create an assessment. The provider label shows whether this result came from a live Gemini request or a fixture.”

**Show:** Filename, extraction status, extracted values and warnings. If the live call fails, show the unavailable state and use the manual form only if the app offers it.

## 1:00–1:45 — Human confirmation

**Do:** Review the vendor, invoice number, amount, currency and destination. Correct a field if needed, choose the known synthetic vendor record, and confirm the destination.

**Say:** “Extracted identity is still untrusted evidence. A person reviews the values and selects the vendor record. ScamShield compares the confirmed destination with that saved record.”

**Show:** The confirmed fields and the known vendor details. For the changed-account sample, make the requested and saved destinations easy to compare.

## 1:45–2:25 — Assessment and evidence

**Do:** Submit the assessment after confirmation.

**Say:** “Deterministic rules evaluate the confirmed payment facts. The policy returns Continue, Verify or Review and keeps the supporting evidence and missing checks visible. Gemini can help extract and classify evidence, but it does not authorize payment or override the policy.”

**Show:** Recommendation, changed-destination signal, provider status and explanation status. State clearly that no money moves.

## 2:25–2:55 — Case history and ownership

**Do:** Open case history, download the case JSON if the verified build supports it, then open a second private browser session and show that it has its own anonymous identity and cannot read the first session’s cases.

**Say:** “Firestore keeps the case record under the visitor identity. The second session cannot see the first visitor’s case.”

**Show:** Only if this isolation check has passed against the deployed service. Do not make the ownership claim from a local SQLite run.

## 2:55–3:30 — Stack and limits

**Say:** “The target stack uses Firebase anonymous authentication, Firestore for cases and quotas, Cloud Run for the app and API, and Gemini for extraction and evidence analysis. This is an invoice-review prototype with synthetic data. It does not execute payments or establish fraud accuracy. The links below lead to the public repository, live demo and full walkthrough.”

**Show:** The verified public GitHub repository and Cloud Run URL, then end on the tested app. Share the video only after it is between three and four minutes and plays without a signed-in account.

## Final release checks

- Verify the public Cloud Run link in a fresh browser with no Google sign-in.
- Complete one uploaded invoice flow through extraction, human confirmation, assessment and case retrieval.
- Verify Firestore persistence after a new request and verify cross-visitor isolation.
- Keep the provider mode, Firebase auth mode and storage mode visible and accurate.
- Check the live video duration and public playback access.
- Replace all pending submission links only with URLs tested from an anonymous session.
