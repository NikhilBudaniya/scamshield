import type {
  AppConfig,
  AssessmentRequest,
  AssessmentsResponse,
  CaseRecord,
  InvoiceExtraction,
  InvoiceSamplesResponse,
  ScenarioResponse,
  VendorsResponse,
} from './types'

type TokenProvider = (forceRefresh?: boolean) => Promise<string | null>
let tokenProvider: TokenProvider | null = null
let authGeneration = 0

export function setTokenProvider(provider: TokenProvider | null) {
  authGeneration += 1
  tokenProvider = provider
}

function authChangedError(): Error & { status: number } {
  const error = new Error('The visitor session changed while this request was in progress.') as Error & { status?: number }
  error.status = 401
  return error as Error & { status: number }
}

function assertAuthGeneration(expected: number) {
  if (expected !== authGeneration) throw authChangedError()
}

async function readToken(provider: TokenProvider, forceRefresh: boolean): Promise<string | null> {
  try { return await provider(forceRefresh) }
  catch {
    const error = new Error('The visitor identity could not be refreshed.') as Error & { status?: number }
    error.status = 401
    throw error
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const requestGeneration = authGeneration
  const requestTokenProvider = tokenProvider
  const isForm = typeof FormData !== 'undefined' && init?.body instanceof FormData
  const headers = new Headers(init?.headers)
  if (!isForm && init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const send = async (forceRefresh = false) => {
    assertAuthGeneration(requestGeneration)
    if (requestTokenProvider) {
      const token = await readToken(requestTokenProvider, forceRefresh)
      assertAuthGeneration(requestGeneration)
      if (token) headers.set('Authorization', `Bearer ${token}`)
      else headers.delete('Authorization')
    }
    assertAuthGeneration(requestGeneration)
    const response = await fetch(path, { ...init, credentials: 'include', headers })
    assertAuthGeneration(requestGeneration)
    return response
  }
  let response = await send()
  if ((response.status === 401 || response.status === 403) && requestTokenProvider) {
    assertAuthGeneration(requestGeneration)
    response = await send(true)
  }
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const body = await response.json() as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
      else if (body.detail) detail = JSON.stringify(body.detail)
    } catch { /* retain status-based message */ }
    assertAuthGeneration(requestGeneration)
    const error = new Error(detail) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  const result = await response.json() as T
  assertAuthGeneration(requestGeneration)
  return result
}

export const api = {
  config: () => request<AppConfig>('/api/config'),
  scenarios: () => request<ScenarioResponse>('/api/v1/scenarios'),
  assessments: () => request<AssessmentsResponse>('/api/v1/assessments'),
  vendors: () => request<VendorsResponse>('/api/v1/invoices/vendors'),
  invoiceSamples: () => request<InvoiceSamplesResponse>('/api/v1/invoices/samples'),
  extractInvoice: (file: File, sampleId?: string) => {
    const body = new FormData()
    body.append('file', file)
    if (sampleId) body.append('sample_id', sampleId)
    return request<InvoiceExtraction>('/api/v1/invoices/extract', { method: 'POST', body })
  },
  assess: (body: AssessmentRequest) => request<CaseRecord>('/api/v1/assessments', { method: 'POST', body: JSON.stringify(body) }),
  explain: (id: string) => request<CaseRecord>(`/api/v1/assessments/${encodeURIComponent(id)}/explanation`, { method: 'POST', body: '{}' }),
  session: (access_code: string) => request<{ authenticated: boolean; access_mode: 'protected' | 'local_unprotected'; expires_in_seconds?: number }>('/api/session', { method: 'POST', body: JSON.stringify({ access_code }) }),
  downloadSample: async (url: string) => {
    const requestGeneration = authGeneration
    const requestTokenProvider = tokenProvider
    const headers = new Headers()
    const send = async (forceRefresh = false) => {
      assertAuthGeneration(requestGeneration)
      if (requestTokenProvider) {
        const token = await readToken(requestTokenProvider, forceRefresh)
        assertAuthGeneration(requestGeneration)
        if (token) headers.set('Authorization', `Bearer ${token}`)
      }
      assertAuthGeneration(requestGeneration)
      const response = await fetch(url, { credentials: 'include', headers })
      assertAuthGeneration(requestGeneration)
      return response
    }
    let response = await send()
    if ((response.status === 401 || response.status === 403) && requestTokenProvider) {
      assertAuthGeneration(requestGeneration)
      response = await send(true)
    }
    if (!response.ok) {
      const error = new Error(`Could not download sample (${response.status})`) as Error & { status?: number }
      error.status = response.status
      throw error
    }
    const blob = await response.blob()
    assertAuthGeneration(requestGeneration)
    return blob
  },
}

export function messageForError(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

export function statusForError(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: number }).status : undefined
}
