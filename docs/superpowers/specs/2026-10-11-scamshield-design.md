# ScamShield prototype design

Date: 2026-10-11

Status: Agreed concept; written specification ready for review.

## Objective

Build a hackathon prototype in 48–72 hours that assesses payment risk before money moves. Combine transaction patterns with optional payment-request context, return a recommended intervention, and explain the supporting evidence.

Prove reuse through two simulated workflows: a consumer UPI transfer and a business invoice payment. Both call the same assessment engine. No money moves in this prototype.

Pitch: A payment risk API that combines transaction patterns with payment-request context to recommend an intervention before money moves.

## Scope and success criteria

The MVP includes:

- A consumer payment simulator with synthetic customer history and optional pasted payment-request text.
- A business payment simulator with invoice fields, a synthetic vendor record, and optional pasted payment instructions.
- A shared assessment API with explicit evidence, missing-data indicators, configurable policies, and a versioned response contract.
- Jev classification of contextual signals when credentials are available.
- Gemini on Vertex AI for evidence-grounded explanations and analyst summaries when credentials are available.
- An investigation view showing assessment inputs, signals, recommendation, provider status, and actual latency.
- A replayable evaluation set comparing rules-only assessment with rules plus contextual classification.

The MVP is complete when both workflows run through the shared API, scenario and failure checks pass, and the demonstration clearly distinguishes live model outputs from fixtures. A cloud demo additionally requires a tested Cloud Run deployment and at least one verified live Vertex AI explanation.

Actual payment processing, bank integrations, account freezes, automatic fraud accusations, trained predictive models, card authorization, and regulatory compliance certification are outside scope. Screenshot extraction, Document AI, BigQuery export, and Pub/Sub integration are stretch work after the core demonstration passes.

## User flows

### Consumer transfer

1. Select a synthetic customer and enter recipient and amount in a simulated payment form.
2. Optionally paste the message requesting payment.
3. Request assessment before simulated confirmation.
4. Display the recommendation with specific evidence and unknowns.
5. For verification, ask the customer to independently check the request through an existing trusted contact. A customer acknowledgment is recorded separately and cannot by itself clear the original risk signals.
6. Allow cancellation or simulated continuation according to the configured demo policy. Review cases stay pending in the simulator.

### Business invoice payment

1. Select a synthetic vendor and enter invoice number, amount, currency, and destination account.
2. Optionally paste the email or message requesting payment.
3. Compare the destination with the stored vendor record and evaluate the text using the same engine.
4. Present evidence such as a changed destination and an urgent request to bypass verification.
5. Route the simulated payment to verification or review. Do not modify the vendor's stored account from information supplied by an unverified message.

### Investigation view

Show both flows in one case list. A case contains the normalized payment, original evidence, deterministic rule findings, model classifications, policy decision, explanation, unavailable checks, provider mode, and timings. Display synthetic-data and simulation labels persistently.

## Architecture

Use a small monorepo with a React/TypeScript frontend and a Python/FastAPI backend. Serve the built frontend and API from one container for the first Cloud Run deployment. These are proposed implementation defaults, not existing workspace dependencies.

Modules have separate responsibilities:

1. Adapters validate the UPI or invoice request and produce a shared transaction object.
2. A context loader retrieves synthetic customer or vendor history from the application database.
3. Deterministic rules evaluate transaction patterns and adapter-specific signals.
4. A Jev provider evaluates optional text against predefined semantic questions.
5. A policy engine maps available evidence to a recommendation.
6. A Gemini provider generates an explanation grounded in the recorded findings.
7. A case repository stores the assessment and explanation status.

Use SQLite for local development and PostgreSQL on Cloud SQL for the deployed demo. Keep persistence behind one repository interface and run repository integration checks on PostgreSQL before claiming cloud readiness. Cloud credentials remain on the backend. Provider calls use direct SDK/API integrations; an agent orchestration framework is unnecessary for this bounded pipeline.

The assessment path does not depend on a warehouse, asynchronous event bus, or document extraction. Gemini explanation runs as a separate bounded operation after the decision has been stored. Failure to explain does not alter the assessment.

## Shared API contract

Expose `POST /api/v1/assessments`, `GET /api/v1/assessments`, `GET /api/v1/assessments/{id}`, and `POST /api/v1/assessments/{id}/explanation`. The explanation endpoint is idempotent once an explanation is stored and permits only one in-flight generation per case.

The creation request includes:

- `client_request_id`: identifier used for retry deduplication.
- `payment_method`: `upi` or `bank_transfer` in the MVP.
- `use_case`: `consumer_transfer` or `invoice_payment`.
- `amount_minor`: positive integer in the currency's minor units; never floating-point money.
- `currency`: ISO currency code; demo fixtures use INR. Compare historical amounts only within the same currency.
- `occurred_at`: timezone-aware timestamp.
- `customer_id`: synthetic customer or business identifier.
- `recipient`: identifier and optional display name.
- `context`: optional request text, with source and evidence identifier.
- `method_details`: adapter-validated fields such as UPI address or invoice/vendor/account details.

History, beneficiary age, and the vendor's known destination are retrieved from stored records rather than trusted from the payment form. External integrations would require authenticated sources; the MVP operates on seeded records.

The response includes:

- `assessment_id`, `schema_version`, and `policy_version`.
- `recommendation`: `continue`, `verify`, or `review`.
- `signals`: stable signal code, source, observed value, supporting evidence IDs, and classification probability where the provider supplies one.
- `missing_data`: checks that could not run because information was absent.
- `provider_status`: `live`, `fixture`, `unavailable`, or `not_requested` for each provider.
- `explanation_status`: `pending`, `ready`, or `fallback`.
- `timings_ms`: total decision time and stage timings measured by the server.

Do not invent a combined fraud probability or present classifier confidence as a validated probability of fraud. `continue` means no configured intervention threshold was met, not that the transaction is guaranteed safe.

The same `client_request_id` and normalized request return the existing assessment; conflicting reuse returns HTTP 409. Invalid requests return HTTP 422. Failed persistence returns HTTP 503 and leaves the simulated payment pending.

## Rules and policy

Rules are deterministic and return evidence, not prose-only judgments. Initial synthetic demo rules are:

- New recipient: no matching recipient in the customer's stored history.
- Unusual amount: at least five historical payments in the same currency and current amount exceeds three times their median.
- High frequency: at least three earlier payments within the preceding ten minutes.
- Changed vendor account: requested destination differs from a known destination for the selected vendor.

These are explicitly demo thresholds, versioned in configuration rather than claimed production defaults.

Jev questions cover impersonation, safe-account language, urgency, secrecy, upfront-fee demands, and instructions to bypass established verification. Classification findings refer to actual evidence IDs. Any displayed quotation must be checked as an exact substring of the source; unsupported quotations are removed.

Initial policy precedence:

1. `review` for a changed vendor account, or a safe-account classification with probability at least 0.8 accompanied by a new recipient, or an explicit contextual pair with both probabilities at least 0.8. Allowed pairs are impersonation plus secrecy, impersonation plus bypassing verification, and upfront-fee demand plus bypassing verification. Urgency and secrecy alone do not trigger review.
2. `verify` for one contextual red flag at least 0.6, a new recipient, an unusual amount, or high frequency, unless review already applies.
3. `continue` otherwise, while explicitly retaining missing-data indicators.

Provider probability thresholds are provisional demo settings. Evaluate threshold changes on a separate development split; keep evaluation examples held out. Low-probability or contradictory contextual findings remain visible as uncertainty, not confirmed fraud evidence.

If context is submitted but classification fails, return at least `verify` with a degraded-service reason unless stronger rules already require review. If no context is submitted, use available transaction rules and mark contextual checks as not run. Missing history disables history-dependent checks; it does not create a normal-history finding.

## Model boundaries and resilience

Jev receives a compact context and predefined semantic questions. Validate the actual provider request/response contract against current official documentation during implementation. Its outputs cannot choose payment actions directly or override deterministic facts.

Gemini receives normalized evidence and the policy recommendation, then produces a short explanation and analyst summary. User-supplied messages are treated as evidence, never instructions. The explanation cannot change the recommendation or introduce claims about recipient identity that the evidence does not establish.

Set an initial two-second contextual-classification deadline and an eight-second explanation deadline. Avoid retries on the synchronous decision path. These are application timeout settings, not promises of model latency. Show a deterministic evidence-based fallback explanation on generation failure.

Support `live` and `fixture` provider modes. Fixture mode uses explicit saved outputs for named synthetic scenarios, is labeled in the UI and API, and supports a reproducible offline demo. Never silently replace a failed live provider with a fixture output.

Use synthetic data only in the hackathon deployment. Do not log full payment-request text or secrets in service logs. Limit text to 8,000 characters and reject oversized requests. Keep demonstration access behind a server-enforced access code exchanged for an HttpOnly session; cap assessment requests per session and avoid an unrestricted public model proxy.

## Demonstration and evaluation

Prepare six named scenarios:

1. Fake bank safe-account request to a new UPI recipient: review.
2. Legitimate large consumer payment: verify because of amount or recipient history, with no unsupported scam accusation.
3. Urgent ambiguous family request to a new recipient: verify.
4. Invoice requesting payment to changed vendor bank details: review.
5. Normal repeat vendor invoice with matching details: continue.
6. Context-provider timeout: verify with an explicit degraded-service reason.

Expected scenario outcomes describe the policy when expected signals are present. Test live classification accuracy separately so a misclassification cannot be hidden by fixture selection.

Create 40 synthetic examples balanced across consumer and business workflows, including ordinary, suspicious, ambiguous, and missing-context cases. Use 20 for development and 20 for held-out evaluation. Keep paraphrases of the same scenario within one split to limit leakage. This small set demonstrates behavior and reproducibility; it does not establish real-world fraud accuracy.

Compare rules-only and rules-plus-Jev on identical inputs. Report intervention recall on labeled suspicious cases, intervention rate on legitimate cases, ambiguous-case routing, provider failures, and incremental contextual detections. Do not claim a matched false-positive-rate comparison unless threshold sweeps actually establish one. Label fixture evaluation separately from live-model evaluation.

Measure decision and explanation latency separately. For each live configuration, record at least 100 requests at concurrency one, then 100 at concurrency five, noting region, input size, warm/cold state, provider version, failures, and sample count. Report p50 and p95 over all completed responses, including degraded responses, alongside failure rates. Report actual available usage or a clearly labeled cost estimate.

Verification covers adapter normalization, currency and money validation, policy precedence, absent history, missing context, invalid model responses, timeouts, retry deduplication, instruction-like text inside evidence, case persistence, and both end-to-end simulator flows. Do not display model-specific latency or accuracy until measured.

## Delivery sequence

| Time | Deliverable |
| --- | --- |
| Hours 0–8 | Contracts, fixtures, two adapters, deterministic rules, and policy checks |
| Hours 8–20 | Shared API, persistence, consumer and invoice simulators, investigation view |
| Hours 20–32 | Jev integration, Vertex AI explanations, explicit fallback behavior |
| Hours 32–40 | Held-out evaluation, latency measurement, evidence and error-state polish |
| Hours 40–48 | Cloud deployment, end-to-end checks, three-minute demo rehearsal |
| Hours 48–72 | Buffer for integration issues; optional invoice extraction or analytics export |

Secure Jev access and a Google Cloud project with Vertex AI access early. If credentials are unavailable, complete and label the offline demonstration, and report live integration as unverified. Do not represent fixture mode as a functioning cloud AI deployment.

## Three-minute judging narrative

Start with a suspicious UPI transfer and show the exact contextual evidence. Switch to an invoice with changed bank details and show that the same API and policy engine handles it. Finish with a legitimate repeat payment and the evaluation view, emphasizing proportional interventions, unknowns, and measured behavior.

## Review outcome

This document defines a single prototype with two adapters, not separate products. Its limits are explicit: synthetic records, provisional thresholds, a small evaluation set, and no payment execution. The next artifact is the implementation plan after written-spec review.
