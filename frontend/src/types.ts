export type Recommendation = 'continue' | 'verify' | 'review'
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export interface AssessmentRequest {
  client_request_id: string
  payment_method: 'upi' | 'bank_transfer'
  use_case: 'consumer_transfer' | 'invoice_payment'
  amount_minor: number
  currency: string
  occurred_at: string
  customer_id: string
  recipient: { identifier: string; display_name?: string }
  context?: { text: string; source: string; evidence_id: string } | null
  method_details: Record<string, JsonValue>
  scenario_id?: string | null
}

export interface Scenario {
  id: string
  title: string
  description: string
  expected_recommendation: Recommendation
  request: AssessmentRequest
}

export interface Signal {
  code: string
  source: string
  value: JsonValue
  evidence_ids: string[]
  probability?: number | null
}

export interface CaseRecord {
  assessment_id: string
  created_at: string
  schema_version: string
  policy_version: string
  request: AssessmentRequest
  recommendation: Recommendation
  signals: Signal[]
  missing_data: string[]
  provider_status: Record<string, string>
  explanation_status: 'pending' | 'ready' | 'fallback' | string
  explanation: { summary: string; next_step: string; analyst_summary: string } | null
  timings_ms: { decision: number; rules: number; classification: number; explanation?: number }
}

export interface ScenarioResponse { scenarios: Scenario[] }
export interface AssessmentsResponse { assessments: CaseRecord[] }
