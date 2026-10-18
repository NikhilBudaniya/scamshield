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

export interface AppConfig {
  auth_mode: 'firebase' | 'access_code' | string
  firebase_config: {
    apiKey: string
    authDomain: string
    projectId: string
    appId: string
    [key: string]: string
  } | null
  storage_mode: string
  synthetic_data: boolean
}

export interface InvoiceSample {
  id: string
  title: string
  filename: string
  download_url: string
  description: string
}

export interface InvoiceSamplesResponse { samples: InvoiceSample[] }

export interface KnownVendor {
  vendor_id: string
  vendor_name: string
  customer_id: string
  known_destination: string
}

export interface VendorsResponse { vendors: KnownVendor[] }

export interface InvoiceExtraction {
  extraction_id: string
  provider_status: 'live' | 'fixture' | 'unavailable' | string
  model: string | null
  filename: string
  fields: {
    invoice_number: string | null
    vendor_name: string | null
    amount_minor: number | null
    currency: string | null
    destination_account: string | null
    payment_instructions: string | null
  }
  warnings: string[]
  requires_review: true
}
