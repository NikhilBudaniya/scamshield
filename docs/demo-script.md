# ScamShield — 3–4 minute product walkthrough

**Target duration:** 3:03 (183 seconds). The narration is 440 words and 183.03 seconds; visual cuts follow the spoken chapters.
**Recording status:** Edited walkthrough assembled from actual Cloud Run UI captures, with generated narration and explanatory captions. It is not a continuous screen recording. Product flow was verified on Cloud Run revision 3.
**Capture policy:** Use the actual Cloud Run captures in `artifacts/screenshots/`. Crop and zoom for legibility, but do not add, remove or change UI content. Captions and voice-over may clarify the view. All sample invoices are synthetic.

## Scenes and narration

### 0:00–0:33 — The review problem

**Show:** `live-01-start.jpg`; the opening caption labels this as an edited walkthrough using synthetic data.

**Say:** “An invoice can look familiar while its payment destination has changed. ScamShield gives a person a review step before an invoice reaches a simulated assessment. The goal is to compare invoice details with a known vendor record and keep the evidence behind the recommendation visible. This walkthrough uses synthetic invoices on the public demo, including invented vendor names, account identifiers and amounts. The interface keeps the person in control of the next step. The app never sends a payment.”

### 0:33–0:58 — Upload and extract

**Show:** `live-02-extracted.jpg`. Focus the crop on the upload, Live Gemini status and candidate invoice fields.

**Say:** “I’ll upload a synthetic invoice. Vertex AI Gemini 2.5 Flash-Lite returns candidate fields for the vendor, invoice number, amount and destination account. The result stays visible for a person to review, and the provider status appears beside the uploaded file. The upload alone does not create an assessment, and extracted identity does not select or verify a vendor by itself.”

### 0:58–1:24 — Human confirmation

**Show:** `live-03-confirmed.jpg`, showing the selected known vendor and destination details.

**Say:** “I check the extracted values, select the known synthetic vendor record and confirm the destination. The reviewer can edit candidate fields before submitting. A mismatch remains visible even after the fields are confirmed. Here, the requested bank account differs from the saved vendor account. ScamShield keeps those two values visible so the reviewer can see the discrepancy before deciding what to do.”

### 1:24–1:56 — Changed account and explanation

**Show:** 1:24–1:41 `live-04-assessed.jpg`, then 1:41–1:56 `live-05-explained.jpg`. Emphasize Review, changed vendor account, bypass language and the displayed evidence summary. Gemini classifies the message; a deterministic template writes the summary.

**Say:** “After submission, the policy returns Review. The account change is one recorded signal. Gemini classifies the request message, which asks the recipient to bypass a callback. The policy turns validated evidence codes into a fixed explanation and recommends pausing the simulated payment while the reviewer checks through a trusted, independent contact. The displayed summary uses a deterministic template; Gemini does not write it. This is evidence for human review, not a finding that fraud has occurred.”

### 1:56–2:25 — Routine invoice and history

**Show:** 1:56–2:10 `live-06-normal.jpg`, then 2:10–2:25 `live-07-history.jpg`. Show Continue beside Review and the two saved cases. Do not present visitor isolation as a visual demo.

**Say:** “A second synthetic invoice uses the saved vendor destination and returns Continue because no configured hold was met. Continue means no configured rule requested intervention; it is not an approval or a safety guarantee. Case history retains both the routine invoice and the changed-account review, so a reviewer can compare their outcomes. The case report can be downloaded. The Firestore records remained available after a Cloud Run revision change.”

### 2:25–3:03 — Architecture and limits

**Show:** 2:25–2:55 `live-05-explained.jpg` with architecture caption, then 2:55–3:03 the same actual UI capture with the public app and repository URLs in the caption.

**Say:** “The app runs on Cloud Run, uses Firebase anonymous authentication and Firestore, and calls Vertex AI Gemini 2.5 Flash-Lite. Tests confirmed one visitor cannot read another visitor’s cases. The runtime limits model attempts to nine per visitor per day, fifty globally per day and two hundred total. A one-hundred-rupee budget alert runs through November sixth; alerts do not stop charges. Fifty-nine backend tests passed, but test counts do not measure fraud accuracy. This is a human-reviewed prototype using synthetic data, not a payment system. The repository and live demo are linked here.”

## Release evidence

- Two synthetic invoice flows completed with live Gemini extraction, contextual classification and deterministic evidence summary. The routine case returned Continue; the changed destination case returned Review.
- Firestore readback, retry idempotency and case persistence across a Cloud Run revision change passed.
- Cross-visitor case lookup returned 404, unauthenticated API access returned 401, and direct browser access to Firestore returned 403. These are test results; the video does not stage a second-browser isolation demonstration.
- The 59 backend tests are regression checks, not a model-accuracy benchmark.
- Cloud billing is enabled. The ₹100 alert is not a spending cap; Vertex AI, Firestore and Cloud Run use may incur charges.
