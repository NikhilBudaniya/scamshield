import type { AssessmentRequest, AssessmentsResponse, CaseRecord, ScenarioResponse } from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } })
  if (!response.ok) {
    let detail = `Request failed (${response.status})`
    try {
      const body = await response.json() as { detail?: unknown }
      if (typeof body.detail === 'string') detail = body.detail
      else if (body.detail) detail = JSON.stringify(body.detail)
    } catch { /* retain status-based message */ }
    const error = new Error(detail) as Error & { status?: number }
    error.status = response.status
    throw error
  }
  return response.json() as Promise<T>
}

export const api = {
  scenarios: () => request<ScenarioResponse>('/api/v1/scenarios'),
  assessments: () => request<AssessmentsResponse>('/api/v1/assessments'),
  assess: (body: AssessmentRequest) => request<CaseRecord>('/api/v1/assessments', { method: 'POST', body: JSON.stringify(body) }),
  explain: (id: string) => request<CaseRecord>(`/api/v1/assessments/${encodeURIComponent(id)}/explanation`, { method: 'POST', body: '{}' }),
  session: (access_code: string) => request<{ status: string }>('/api/session', { method: 'POST', body: JSON.stringify({ access_code }) }),
}

export function messageForError(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Something went wrong. Please try again.'
}

export function statusForError(error: unknown): number | undefined {
  return typeof error === 'object' && error !== null && 'status' in error ? (error as { status?: number }).status : undefined
}
