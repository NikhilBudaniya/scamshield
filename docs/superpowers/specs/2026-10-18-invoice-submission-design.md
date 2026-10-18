# Invoice intelligence submission release

Date: 2026-10-18

The user selected invoice enhancement instead of the proposed rules/AI comparison, requested public GCP hosting, and supplied mandatory Hack2skill submission requirements. This release prioritizes the invoice workflow while retaining the shared payment-risk API and UPI demo.

## Working flow

A visitor opens the public app and obtains a Firebase anonymous identity without account registration. They choose a synthetic sample invoice or upload a PDF/PNG/JPEG of at most 5 MiB. Gemini extracts invoice number, vendor name, amount/currency, destination account and payment instructions into a strict schema. Missing or ambiguous fields stay empty with warnings. The visitor reviews and edits these fields, chooses a known synthetic vendor record, and explicitly submits the payment assessment. Extracted identity never automatically becomes trusted vendor identity. No payment is executed.

The existing rules compare the requested destination with the vendor record and consider transaction history. Context classification remains an explicit Gemini request with bounded inputs. Evidence and grounded explanations remain visible. The visitor can download their case as JSON; this export is a convenience, not an accuracy comparison. Uploaded bytes are transient; raw documents are not persisted. Synthetic examples are clearly labeled.

## Required Google technologies

- Firebase Authentication: anonymous visitor identity, ID token sent in Authorization header and verified by the backend. Existing access-code mode remains available for local demos.
- Firestore: durable case storage, owner-scoped idempotency, and transactional daily model-use quotas. Client database access is denied; server uses its runtime identity.
- Cloud Run: frontend and FastAPI served from a single container, scales to zero, maximum one instance initially.
- Gemini: document extraction, contextual signal classification, and evidence ordering for controlled explanation text. Selected backend is explicit; never silently switch from free Developer API to paid Vertex.

## Public reliability and boundaries

Each visitor sees only their own cases. Persistence survives Cloud Run replacement. Model failures are reported as unavailable; extraction failure does not produce invented invoice fields. The user can continue with the manual invoice form. Per-user daily limits and a shared daily cap protect the demo; quotas are durable across instance restarts. Limit file MIME/magic, byte size and extracted field lengths; never log documents, tokens, or keys. Retain truthful live/fixture provenance. Fixture samples remain available for a labeled walkthrough if live AI is unavailable.

## Submission acceptance

Use the prescribed template at https://docs.google.com/presentation/d/13rg7vW43mEH6DkpuusAE6fdoEylSFz8waNpE4RLzoUg/edit and deliver PDF under 5 MB. The current submission form requires a challenge selection, public GCP/Cloud Run URL, public GitHub URL, a 3–4 minute working-demo video URL, and a description of at most 1024 characters. Template has thirteen substantive content sections plus instruction/blank/closing slides. Follow the template structure instead of the prior six-slide pitch.

Verify links in a fresh anonymous browser. Keep service and integrations functional through evaluation. Do not claim classifier accuracy based on curated fixtures. Show measured test counts and actual live request timings only after execution. Prepare submission fields and artifacts; final form submission requires a complete working package.
