import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, messageForError, setTokenProvider, statusForError } from './api'
import { getFirebaseIdToken, initializeAnonymousSession, renewAnonymousSession } from './firebase'
import { describeContextSignal, simulatorActions } from './signal-copy'
import type { AppConfig, AssessmentRequest, CaseRecord, InvoiceExtraction, InvoiceSample, KnownVendor, Recommendation, Scenario } from './types'

type Flow = 'consumer_transfer' | 'invoice_payment'
type Draft = Omit<AssessmentRequest, 'amount_minor' | 'context'> & { amount: string; context_text: string; context_enabled: boolean; context_source: string; evidence_id: string }
type LocalOutcome = { state: 'verification_acknowledged' | 'continued' | 'cancelled'; updatedAt: string }

const freshId = () => globalThis.crypto?.randomUUID?.() ?? `case-${Date.now()}-${Math.random().toString(36).slice(2)}`
const nowIso = () => new Date().toISOString()
const str = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const money = (minor: number, currency = 'INR') => new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(minor / 100)
const humanize = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

function describeSignal(signal: CaseRecord['signals'][number], currency: string): string {
  const value = record(signal.value)
  if (signal.code === 'new_recipient') return `Recipient ${str(value.recipient, 'provided')} does not appear in this profile’s stored recipient history.`
  if (signal.code === 'unusual_amount') {
    const amount = typeof value.amount_minor === 'number' ? money(value.amount_minor, currency) : 'the entered amount'
    const median = typeof value.historical_median_minor === 'number' ? money(value.historical_median_minor, currency) : 'an unavailable median'
    const count = typeof value.history_count === 'number' ? `, based on ${value.history_count} same-currency payments` : ''
    return `${amount} is more than three times the historical median of ${median}${count}.`
  }
  if (signal.code === 'high_frequency') return `${typeof value.earlier_payments_10m === 'number' ? value.earlier_payments_10m : 'Several'} earlier payment${value.earlier_payments_10m === 1 ? '' : 's'} appear in the preceding ten minutes.`
  if (signal.code === 'changed_vendor_account') return `Requested destination ${str(value.requested_destination, 'provided')} differs from the saved vendor destination ${str(value.known_destination, 'on record')}.`
  if (['safe_account', 'impersonation', 'urgency', 'secrecy', 'upfront_fee', 'bypass_verification'].includes(signal.code)) {
    return describeContextSignal(signal)
  }
  if (typeof signal.value === 'string') return signal.value
  return Object.entries(value).map(([key, item]) => `${humanize(key)}: ${typeof item === 'number' && key.endsWith('_minor') ? money(item, currency) : String(item)}`).join(' · ') || 'A signal was recorded.'
}

function describeMissing(code: string): string {
  const descriptions: Record<string, string> = {
    customer_payment_history: 'Customer payment history was unavailable, so history-based checks could not run.',
    insufficient_same_currency_history_for_amount: 'Fewer than five same-currency payments were available for the configured historical amount comparison.',
    context_classification_not_requested: 'No request text was provided, so contextual classification was not requested.',
    context_classification_unavailable: 'Request text was provided, but the configured classifier could not evaluate it.',
    vendor_destination_history: 'No saved destination was available for this vendor.',
    vendor_identity_mismatch: 'The selected vendor is not linked to this business profile in the demo records.',
    gemini_explanation_unavailable: 'Explanation generation was unavailable; a deterministic evidence-based fallback is shown.',
  }
  return descriptions[code] ?? `${humanize(code)} could not be checked for this assessment.`
}

function statusLabel(mode: string): string {
  if (mode === 'fixture') return 'Saved fixture'
  if (mode === 'live') return 'Live provider'
  if (mode === 'unavailable') return 'Unavailable'
  return 'Not requested'
}

function extractionWarningCopy(code: string): string {
  const fieldNames: Record<string, string> = {
    invoice_number: 'invoice number', vendor_name: 'vendor name', amount_minor: 'invoice amount',
    currency: 'currency', destination_account: 'bank destination', payment_instructions: 'payment instructions',
  }
  if (code.startsWith('missing_')) {
    const field = code.slice('missing_'.length)
    return `The ${fieldNames[field] ?? humanize(field).toLowerCase()} was not found clearly. Review and enter it below.`
  }
  const messages: Record<string, string> = {
    fixture_mode_supports_only_exact_synthetic_samples: 'This saved-fixture setup only extracts the exact synthetic sample documents. Enter the invoice details manually.',
    gemini_extraction_not_configured: 'Live invoice extraction is not configured. You can still enter and assess the invoice manually.',
    extraction_unavailable: 'The extraction provider could not process this document. You can still enter and assess the invoice manually.',
    unsupported_currency: 'This demo currently assesses INR invoices. Review the amount and currency before submitting.',
  }
  return messages[code] ?? `${humanize(code)}. Review the fields below before submitting.`
}

function classificationLabel(source: string, statuses: Record<string, string>): string {
  const key = source.startsWith('gemini') ? (source === 'gemini_classification' ? 'gemini_classifier' : 'gemini') : 'jev'
  const status = statuses[key] ?? 'not_requested'
  return status === 'fixture' ? 'saved fixture · wording likelihood' : status === 'live' ? 'live classifier · wording likelihood' : 'provider wording likelihood'
}

function localOutcomeLabel(recommendation: Recommendation, outcome?: LocalOutcome): string {
  if (outcome?.state === 'cancelled') return 'Canceled in simulator'
  if (outcome?.state === 'continued') return recommendation === 'verify' ? 'Continued in simulator · Verify recommendation remains' : 'Continued in simulator'
  if (outcome?.state === 'verification_acknowledged') return 'Independent check acknowledged · Verify still required'
  return recommendation === 'review' ? 'Pending analyst review' : 'No simulated outcome recorded'
}

function downloadCaseJson(item: CaseRecord) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `scamshield-case-${item.assessment_id}.json`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ProviderStrip({ providerStatus }: { providerStatus: Record<string, string> }) {
  const entries = [
    ['Context check', providerStatus.gemini_classifier && providerStatus.gemini_classifier !== 'not_requested' ? providerStatus.gemini_classifier : providerStatus.jev],
    ['Explanation', providerStatus.gemini],
  ] as const
  return <div className="decision-providers" aria-label="Provider status">{entries.map(([name, mode]) => <div className="decision-provider" key={name}><span>{name}</span><strong className={mode}>{statusLabel(mode)}</strong></div>)}</div>
}

function draftFromRequest(request: AssessmentRequest, flow: Flow): Draft {
  const context = request.context
  return {
    ...request,
    use_case: flow,
    amount: (request.amount_minor / 100).toString(),
    context_enabled: !!context?.text,
    context_text: context?.text ?? '',
    context_source: context?.source ?? (flow === 'consumer_transfer' ? 'message' : 'invoice_email'),
    evidence_id: context?.evidence_id ?? (flow === 'consumer_transfer' ? 'transfer-message-1' : 'invoice-instructions-1'),
    recipient: { ...request.recipient },
    method_details: { ...request.method_details },
  }
}

function blankDraft(flow: Flow): Draft {
  const draft = draftFromRequest({
    client_request_id: '', payment_method: flow === 'consumer_transfer' ? 'upi' : 'bank_transfer', use_case: flow,
    amount_minor: 2500000, currency: 'INR', occurred_at: nowIso(), customer_id: flow === 'consumer_transfer' ? 'customer-asha' : 'business-acme',
    recipient: { identifier: '', display_name: '' }, context: null,
    method_details: flow === 'consumer_transfer' ? { upi_address: '' } : { vendor_id: '', invoice_number: '', destination_account: '' },
  }, flow)
  return flow === 'invoice_payment' ? { ...draft, amount: '' } : draft
}

function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [cases, setCases] = useState<CaseRecord[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState('')
  const [flow, setFlow] = useState<Flow>('invoice_payment')
  const [draft, setDraft] = useState<Draft>(() => blankDraft('invoice_payment'))
  const [scenarioId, setScenarioId] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingCases, setLoadingCases] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [explaining, setExplaining] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [needsAccessCode, setNeedsAccessCode] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [accessCode, setAccessCode] = useState('')
  const [signingIn, setSigningIn] = useState(false)
  const [activeView, setActiveView] = useState<'assess' | 'cases'>('assess')
  const [localOutcomes, setLocalOutcomes] = useState<Record<string, LocalOutcome>>({})
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [vendors, setVendors] = useState<KnownVendor[]>([])
  const [samples, setSamples] = useState<InvoiceSample[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [selectedSampleId, setSelectedSampleId] = useState('')
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [extraction, setExtraction] = useState<InvoiceExtraction | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [firebaseReconnect, setFirebaseReconnect] = useState(false)
  const [firebaseConfigError, setFirebaseConfigError] = useState('')
  const sessionEpoch = useRef(0)
  const flowRef = useRef<Flow>('invoice_payment')

  const selectedCase = useMemo(() => cases.find((item) => item.assessment_id === selectedCaseId) ?? cases[0], [cases, selectedCaseId])
  const visibleScenarios = useMemo(() => scenarios.filter((scenario) => scenario.request?.use_case === flow), [scenarios, flow])

  const requireAccessCode = useCallback(() => {
    sessionEpoch.current += 1
    setTokenProvider(null)
    setCases([])
    setSelectedCaseId('')
    setLocalOutcomes({})
    setScenarios([])
    setVendors([]); setSamples([])
    setFlow('invoice_payment')
    flowRef.current = 'invoice_payment'
    setScenarioId('')
    setDraft(blankDraft('invoice_payment'))
    setActiveView('assess')
    setNotice('')
    setError('')
    setFirebaseReconnect(false)
    setAccessCode('')
    setAccessError('Your session expired. Enter the access code to continue.')
    setNeedsAccessCode(true)
    setSelectedVendorId('')
    setSelectedSampleId('')
    setInvoiceFile(null)
    setExtraction(null)
    setExtracting(false); setSubmitting(false); setExplaining(false); setSigningIn(false)
    setLoading(false); setLoadingCases(false)
  }, [])

  const clearVisitorData = useCallback((message: string) => {
    sessionEpoch.current += 1
    setTokenProvider(null)
    setCases([]); setSelectedCaseId(''); setLocalOutcomes({}); setScenarios([]); setVendors([]); setSamples([])
    setFlow('invoice_payment'); setScenarioId(''); setDraft(blankDraft('invoice_payment')); setSelectedVendorId('')
    flowRef.current = 'invoice_payment'
    setSelectedSampleId(''); setInvoiceFile(null); setExtraction(null); setActiveView('assess'); setNotice('')
    setError(message); setFirebaseReconnect(true)
    setNeedsAccessCode(false)
    setExtracting(false); setSubmitting(false); setExplaining(false); setSigningIn(false)
    setLoading(false); setLoadingCases(false)
  }, [])

  const loadProtectedData = useCallback(async (expectedEpoch = sessionEpoch.current) => {
    const [scenarioResult, assessmentResult, vendorResult, sampleResult] = await Promise.all([
      api.scenarios(), api.assessments(), api.vendors(), api.invoiceSamples(),
    ])
    if (expectedEpoch !== sessionEpoch.current) return false
    setScenarios(scenarioResult.scenarios); setCases(assessmentResult.assessments)
    setSelectedCaseId(assessmentResult.assessments[0]?.assessment_id ?? '')
    setVendors(vendorResult.vendors); setSamples(sampleResult.samples)
    setScenarioId('')
    setDraft(blankDraft('invoice_payment'))
    return true
  }, [])

  const loadCases = useCallback(async (quiet = false) => {
    const requestEpoch = sessionEpoch.current
    if (!quiet) setLoadingCases(true)
    try {
      const result = await api.assessments()
      if (requestEpoch !== sessionEpoch.current) return
      setCases(result.assessments)
      setSelectedCaseId((current) => result.assessments.some((item) => item.assessment_id === current) ? current : result.assessments[0]?.assessment_id ?? '')
    } catch (reason) {
      if (requestEpoch !== sessionEpoch.current) return
      if (statusForError(reason) === 401 || statusForError(reason) === 403) config?.auth_mode === 'firebase' ? clearVisitorData('Your anonymous session expired. Reconnect to reload this visitor’s workspace.') : requireAccessCode()
      else if (!quiet) setError(messageForError(reason))
    } finally { if (requestEpoch === sessionEpoch.current) setLoadingCases(false) }
  }, [clearVisitorData, config?.auth_mode, requireAccessCode])

  useEffect(() => {
    let mounted = true
    const requestEpoch = sessionEpoch.current
    ;(async () => {
      let authMode = 'access_code'
      let firebaseReady = false
      try {
        const loadedConfig = await api.config()
        if (!mounted || requestEpoch !== sessionEpoch.current) return
        authMode = loadedConfig.auth_mode
        setConfig(loadedConfig)
        if (loadedConfig.auth_mode === 'firebase') {
          if (!loadedConfig.firebase_config) throw new Error('Firebase sign-in is not configured on this deployment.')
          await initializeAnonymousSession(loadedConfig.firebase_config)
          if (!mounted || requestEpoch !== sessionEpoch.current) return
          setTokenProvider(getFirebaseIdToken)
          firebaseReady = true
          await loadProtectedData(requestEpoch)
        } else {
          await loadProtectedData(requestEpoch)
        }
      } catch (reason) {
        if (!mounted || requestEpoch !== sessionEpoch.current) return
        if ((statusForError(reason) === 401 || statusForError(reason) === 403) && authMode === 'firebase') clearVisitorData('Could not establish an anonymous session. Reconnect to start a fresh visitor session.')
        else if (statusForError(reason) === 401 || statusForError(reason) === 403) requireAccessCode()
        else if (reason instanceof Error && reason.message.includes('not configured')) setFirebaseConfigError(reason.message)
        else if (authMode === 'firebase' && !firebaseReady) clearVisitorData(`Anonymous sign-in failed: ${messageForError(reason)}`)
        else setError(messageForError(reason))
      } finally { if (mounted && requestEpoch === sessionEpoch.current) setLoading(false) }
    })()
    return () => { mounted = false }
  // Auth configuration is loaded once; protected records are deliberately fetched only after auth bootstrap.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectScenario = (id: string) => {
    setScenarioId(id)
    const scenario = scenarios.find((item) => item.id === id)
    if (scenario) {
      setDraft(draftFromRequest(scenario.request, flow))
      if (flow === 'invoice_payment') setSelectedVendorId('')
    } else setDraft(blankDraft(flow))
    setError('')
  }

  const changeFlow = (next: Flow) => {
    flowRef.current = next
    setFlow(next)
    const scenario = scenarios.find((item) => item.request.use_case === next)
    setScenarioId(scenario?.id ?? '')
    setDraft(scenario ? draftFromRequest(scenario.request, next) : blankDraft(next))
    setSelectedVendorId('')
    setError('')
  }

  const setMethodField = (key: string, value: string) => setDraft((current) => ({ ...current, method_details: { ...current.method_details, [key]: value } }))

  const selectVendor = (vendorId: string) => {
    const vendor = vendors.find((item) => item.vendor_id === vendorId)
    setSelectedVendorId(vendorId)
    if (!vendor) return
    setDraft((current) => ({ ...current, customer_id: vendor.customer_id, recipient: { ...current.recipient, identifier: vendor.vendor_id, display_name: vendor.vendor_name }, method_details: { ...current.method_details, vendor_id: vendor.vendor_id } }))
  }

  const applyExtraction = (result: InvoiceExtraction) => {
    const f = result.fields
    setExtraction(result)
    setScenarioId('')
    setDraft((current) => ({
      ...current,
      amount: f.amount_minor ? (f.amount_minor / 100).toString() : '',
      currency: f.currency ?? '',
      method_details: { ...current.method_details, invoice_number: f.invoice_number ?? '', destination_account: f.destination_account ?? '' },
      recipient: { ...current.recipient, display_name: f.vendor_name ?? '' },
      context_enabled: Boolean(f.payment_instructions),
      context_text: f.payment_instructions ?? '', context_source: 'invoice_instructions', evidence_id: `invoice-instructions-${result.extraction_id}`,
    }))
    setNotice(result.provider_status === 'unavailable'
      ? 'Extraction is unavailable for this document. Enter invoice details manually; no assessment has run.'
      : 'Review the extracted fields, select a known vendor, and submit the assessment when ready.')
  }

  const runExtraction = async (file: File, sampleId?: string) => {
    const requestEpoch = sessionEpoch.current
    const requestFlow = flowRef.current
    setError(''); setNotice(''); setExtracting(true); setInvoiceFile(file); setSelectedSampleId(sampleId ?? '')
    if (file.size > 5 * 1024 * 1024) { setError('Choose a document smaller than 5 MiB.'); setExtracting(false); return }
    try {
      const result = await api.extractInvoice(file, sampleId)
      if (requestEpoch !== sessionEpoch.current || flowRef.current !== requestFlow) return
      applyExtraction(result)
    }
    catch (reason) {
      if (requestEpoch !== sessionEpoch.current) return
      if (statusForError(reason) === 401 || statusForError(reason) === 403) {
        config?.auth_mode === 'firebase' ? clearVisitorData('Your anonymous session expired. Reconnect to reload this visitor’s workspace.') : requireAccessCode()
        return
      }
      if (flowRef.current !== requestFlow) return
      setExtraction(null)
      setError(messageForError(reason))
    } finally { if (requestEpoch === sessionEpoch.current) setExtracting(false) }
  }

  const extractSelectedSample = async () => {
    const requestEpoch = sessionEpoch.current
    const requestFlow = flowRef.current
    const sample = samples.find((item) => item.id === selectedSampleId)
    if (!sample) { setError('Choose a synthetic invoice sample first.'); return }
    setError(''); setNotice(''); setExtracting(true)
    try {
      const blob = await api.downloadSample(sample.download_url)
      if (requestEpoch !== sessionEpoch.current || flowRef.current !== requestFlow) return
      const mime = sample.filename.toLowerCase().endsWith('.pdf') ? 'application/pdf' : sample.filename.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
      const file = new File([blob], sample.filename, { type: mime })
      setInvoiceFile(file)
      const result = await api.extractInvoice(file, sample.id)
      if (requestEpoch !== sessionEpoch.current || flowRef.current !== requestFlow) return
      applyExtraction(result)
    } catch (reason) {
      if (requestEpoch !== sessionEpoch.current) return
      if (statusForError(reason) === 401 || statusForError(reason) === 403) {
        config?.auth_mode === 'firebase' ? clearVisitorData('Your anonymous session expired. Reconnect to reload this visitor’s workspace.') : requireAccessCode()
        return
      }
      if (flowRef.current !== requestFlow) return
      setError(messageForError(reason))
    } finally { if (requestEpoch === sessionEpoch.current) setExtracting(false) }
  }

  const reconnectFirebase = async () => {
    if (!config?.firebase_config) return
    const requestEpoch = sessionEpoch.current
    setSigningIn(true); setError('')
    setTokenProvider(null)
    try {
      await renewAnonymousSession(config.firebase_config)
      if (requestEpoch !== sessionEpoch.current) return
      setTokenProvider(getFirebaseIdToken)
      const restored = await loadProtectedData(requestEpoch)
      if (restored && requestEpoch === sessionEpoch.current) setFirebaseReconnect(false)
    } catch (reason) {
      if (requestEpoch === sessionEpoch.current) clearVisitorData(`Could not reconnect: ${messageForError(reason)}`)
    }
    finally { if (requestEpoch === sessionEpoch.current) setSigningIn(false) }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    const amount = Number(draft.amount)
    if (!Number.isFinite(amount) || amount <= 0) { setError('Enter an amount greater than zero.'); return }
    if (flow === 'consumer_transfer' && !draft.recipient.identifier.trim()) { setError('Enter the recipient UPI address.'); return }
    if (flow === 'invoice_payment' && (!selectedVendorId || !str(draft.method_details.invoice_number).trim() || !str(draft.method_details.destination_account).trim())) {
      setError('Select a known vendor and confirm the invoice number and requested destination account.'); return
    }
    if (flow === 'invoice_payment' && draft.currency.trim().toUpperCase() !== 'INR') { setError('This prototype assesses INR invoices. Set the currency to INR before submitting.'); return }
    if (draft.context_enabled && draft.context_text.length > 8000) { setError('Keep payment instructions under 8,000 characters.'); return }
    const submitted: AssessmentRequest = {
      client_request_id: freshId(), payment_method: flow === 'consumer_transfer' ? 'upi' : 'bank_transfer', use_case: flow,
      amount_minor: Math.round(amount * 100), currency: draft.currency || 'INR', occurred_at: nowIso(), customer_id: draft.customer_id,
      recipient: { ...draft.recipient, identifier: flow === 'invoice_payment' ? selectedVendorId : draft.recipient.identifier.trim() },
      context: draft.context_enabled && draft.context_text.trim() ? { text: draft.context_text, source: draft.context_source || 'message', evidence_id: draft.evidence_id } : null,
      method_details: { ...draft.method_details }, scenario_id: scenarioId || null,
    }
    const requestEpoch = sessionEpoch.current
    setSubmitting(true)
    try {
      const record = await api.assess(submitted)
      if (requestEpoch !== sessionEpoch.current) return
      setCases((current) => [record, ...current.filter((item) => item.assessment_id !== record.assessment_id)])
      setSelectedCaseId(record.assessment_id)
      setActiveView('assess')
      setNotice('Assessment recorded. Payment remains simulated and has not moved.')
      void loadCases(true)
    } catch (reason) {
      if (requestEpoch !== sessionEpoch.current) return
      setError(messageForError(reason))
      if (statusForError(reason) === 401 || statusForError(reason) === 403) config?.auth_mode === 'firebase' ? clearVisitorData('Your anonymous session expired. Reconnect to reload this visitor’s workspace.') : requireAccessCode()
    } finally { if (requestEpoch === sessionEpoch.current) setSubmitting(false) }
  }

  const requestExplanation = async () => {
    if (!selectedCase) return
    const requestEpoch = sessionEpoch.current
    const caseId = selectedCase.assessment_id
    setExplaining(true); setError('')
    try {
      const updated = await api.explain(caseId)
      if (requestEpoch !== sessionEpoch.current) return
      setCases((current) => current.map((item) => item.assessment_id === updated.assessment_id ? updated : item))
    } catch (reason) {
      if (requestEpoch !== sessionEpoch.current) return
      setError(messageForError(reason))
      if (statusForError(reason) === 401 || statusForError(reason) === 403) config?.auth_mode === 'firebase' ? clearVisitorData('Your anonymous session expired. Reconnect to reload this visitor’s workspace.') : requireAccessCode()
    }
    finally { if (requestEpoch === sessionEpoch.current) setExplaining(false) }
  }

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    const requestEpoch = sessionEpoch.current
    event.preventDefault(); setSigningIn(true); setError(''); setAccessError('')
    try {
      const session = await api.session(accessCode)
      if (requestEpoch !== sessionEpoch.current) return
      if (session.access_mode === 'protected' && !session.authenticated) throw new Error('The server did not establish a protected session.')
      const loaded = await loadProtectedData(requestEpoch)
      if (!loaded || requestEpoch !== sessionEpoch.current) return
      setLocalOutcomes({})
      setNeedsAccessCode(false); setAccessCode('')
    } catch (reason) {
      if (requestEpoch !== sessionEpoch.current) return
      if (statusForError(reason) === 401 || statusForError(reason) === 403) requireAccessCode()
      setAccessError(messageForError(reason))
    }
    finally { if (requestEpoch === sessionEpoch.current) setSigningIn(false) }
  }

  const setView = (view: 'assess' | 'cases') => { setActiveView(view); setMobileNavOpen(false); if (view === 'cases') void loadCases() }
  const recordOutcome = (caseId: string, state: LocalOutcome['state']) => setLocalOutcomes((current) => ({ ...current, [caseId]: { state, updatedAt: new Date().toISOString() } }))

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        <a className="brand" href="#main" aria-label="ScamShield home">
          <span className="brand-mark" aria-hidden="true"><svg viewBox="0 0 32 32"><path d="M16 2.5 27 7v8.1c0 7.1-4.7 12.4-11 14.4C9.7 27.5 5 22.2 5 15.1V7l11-4.5Z"/><path d="m11.2 15.6 3.2 3.1 6.7-7"/></svg></span>
          <span className="brand-type">scam<span>shield</span><small>PAYMENT INTELLIGENCE</small></span>
        </a>
        <div className="side-label">WORKSPACE</div>
        <nav aria-label="Main navigation" className="main-nav">
          <button className={`nav-link ${activeView === 'assess' ? 'active' : ''}`} onClick={() => setView('assess')}><span className="nav-icon">⌁</span> New assessment</button>
          <button className={`nav-link ${activeView === 'cases' ? 'active' : ''}`} onClick={() => setView('cases')}><span className="nav-icon">▤</span> Case history <span className="nav-count">{cases.length}</span></button>
        </nav>
        <div className="side-divider" />
        <div className="side-label">DEMO ENVIRONMENT</div>
        <div className="demo-card"><span className="live-dot" /><div><strong>Synthetic data</strong><small>Sandbox · no money moves</small></div></div>
        <div className="sidebar-spacer" />
        <div className="sidebar-foot"><span className="avatar">AR</span><div><strong>Risk operations</strong><small>{config?.auth_mode === 'firebase' ? 'Anonymous visitor' : 'Analyst workspace'}</small></div></div>
      </aside>

      <main id="main" className="main-area">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen((open) => !open)}>☰</button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{activeView === 'assess' ? 'Payment assessment' : 'Investigation history'}</strong></div>
          <div className="top-actions"><span className="sandbox-tag"><span /> SYNTHETIC · NO PAYMENTS</span></div>
        </header>

        <div className="content-wrap">
          <section className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-line" /> PAYMENT RISK WORKSPACE</div><h1>{activeView === 'assess' ? <>Before the money<br className="title-break" /> moves.</> : <>Every decision,<br className="title-break" /> accounted for.</>}</h1><p>{activeView === 'assess' ? 'Assess a payment request against known patterns and its surrounding context.' : 'Review the evidence and interventions recorded across both payment flows.'}</p></div>
            <div className="heading-note"><span className="note-icon">↗</span><div><strong>One engine. Two workflows.</strong><small>UPI transfer + invoice payment</small></div></div>
          </section>

          {error && <div className="alert alert-error" role="alert"><span>!</span><div><strong>Couldn’t complete that request</strong><p>{error}</p></div><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
          {notice && <div className="alert alert-success" role="status"><span>✓</span><div>{notice}</div><button onClick={() => setNotice('')} aria-label="Dismiss notice">×</button></div>}
          {firebaseConfigError && <div className="alert alert-error" role="alert"><span>!</span><div><strong>Sign-in unavailable</strong><p>{firebaseConfigError}</p></div></div>}
          {firebaseReconnect && <div className="firebase-reconnect"><div><strong>Visitor session needs to reconnect</strong><small>Your previous cases were cleared from this view. Reconnect to load only this visitor’s records.</small></div><button className="secondary-button" onClick={() => void reconnectFirebase()} disabled={signingIn}>{signingIn ? 'Reconnecting…' : 'Reconnect session'}</button></div>}

          {activeView === 'assess' ? (
            <div className="workspace-grid">
              <section className="form-column" aria-label="Assessment inputs">
                <div className="section-topline"><div><span className="step-number">01</span><h2>Payment details</h2></div><span className="required-note"><i /> Required for assessment</span></div>
                <div className="flow-switch" role="tablist" aria-label="Payment workflow">
                  <button role="tab" aria-selected={flow === 'consumer_transfer'} className={flow === 'consumer_transfer' ? 'selected' : ''} onClick={() => changeFlow('consumer_transfer')}><span className="flow-icon">↗</span><span>UPI transfer<small>Consumer payment</small></span></button>
                  <button role="tab" aria-selected={flow === 'invoice_payment'} className={flow === 'invoice_payment' ? 'selected' : ''} onClick={() => changeFlow('invoice_payment')}><span className="flow-icon invoice">▧</span><span>Invoice payment<small>Business payment</small></span></button>
                </div>

                {flow === 'invoice_payment' && <section className="form-card invoice-intake" aria-labelledby="invoice-intake-title">
                  <div className="form-card-heading"><div><h3 id="invoice-intake-title">Start with an invoice</h3><p>Extract fields, then review and edit before you assess.</p></div><span className="form-step">01</span></div>
                  {samples.length > 0 && <div className="sample-picker">
                    <div className="sample-label"><span className="sample-spark">✳</span><div><strong>Synthetic walkthrough</strong><small>Clearly labeled sample documents</small></div></div>
                    <div className="sample-row"><select aria-label="Choose a synthetic invoice" disabled={extracting} value={selectedSampleId} onChange={(event) => { setSelectedSampleId(event.target.value); setInvoiceFile(null); setExtraction(null); setSelectedVendorId(''); setDraft((current) => ({ ...current, amount: '', method_details: { ...current.method_details, invoice_number: '', destination_account: '' }, recipient: { ...current.recipient, display_name: '' }, context_enabled: false, context_text: '', context_source: 'invoice_instructions', evidence_id: `invoice-instructions-${freshId()}` })) }}><option value="">Choose a sample invoice…</option>{samples.map((sample) => <option key={sample.id} value={sample.id}>{sample.title}</option>)}</select><button className="secondary-button" type="button" onClick={() => void extractSelectedSample()} disabled={!selectedSampleId || extracting}>{extracting ? 'Extracting…' : 'Use sample'}</button></div>
                    {samples.find((sample) => sample.id === selectedSampleId) && <p className="sample-description">{samples.find((sample) => sample.id === selectedSampleId)?.description}</p>}
                  </div>}
                  <div className="upload-divider"><span>OR UPLOAD A DOCUMENT</span></div>
                  <label className="upload-zone" htmlFor="invoice-file"><span className="upload-icon">↑</span><span><strong>{invoiceFile ? invoiceFile.name : 'Choose an invoice to upload'}</strong><small>PDF, PNG or JPEG · 5 MiB · PDF up to 10 pages · images up to 20 MP</small></span><input id="invoice-file" type="file" disabled={extracting} accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" onChange={(event) => { const file = event.target.files?.[0]; if (file) { setSelectedSampleId(''); setInvoiceFile(file); setExtraction(null); setSelectedVendorId(''); setDraft((current) => ({ ...current, amount: '', method_details: { ...current.method_details, invoice_number: '', destination_account: '' }, recipient: { ...current.recipient, display_name: '' }, context_enabled: false, context_text: '', context_source: 'invoice_instructions', evidence_id: `invoice-instructions-${freshId()}` })); setError(''); } }} /></label>
                  {invoiceFile && !extraction && <div className="upload-selected"><span>Document ready for extraction</span><button className="secondary-button" type="button" onClick={() => void runExtraction(invoiceFile)} disabled={extracting}>{extracting ? <><span className="spinner" /> Extracting…</> : 'Extract fields →'}</button></div>}
                  {extraction && <div className="extraction-result"><div className="extraction-meta"><span className={`provider-tag ${extraction.provider_status}`}>{extraction.provider_status === 'fixture' ? 'SAVED FIXTURE' : extraction.provider_status === 'live' ? 'LIVE GEMINI' : 'PROVIDER UNAVAILABLE'}</span><span>{extraction.filename}</span></div><p>{extraction.provider_status === 'unavailable' ? 'Enter missing invoice fields manually below. Nothing is assessed until you submit.' : 'Review extracted fields below. Nothing is assessed until you submit.'}</p>{extraction.warnings.length > 0 && <ul>{extraction.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{extractionWarningCopy(warning)}</li>)}</ul>}</div>}
                  <p className="privacy-note">Uploaded document bytes are processed transiently and are not stored with the case. Case records persist according to the configured storage mode.</p>
                </section>}

                <form onSubmit={submit}>
                  <div className="form-card">
      <div className="form-card-heading"><div><h3>Transaction</h3><p>Use a demo profile and enter the payment as requested.</p></div><span className="form-step">A</span></div>
                    <label className="field-label" htmlFor="scenario">Start from a demo scenario <span className="optional">OPTIONAL</span></label>
                    <select id="scenario" value={scenarioId} onChange={(event) => selectScenario(event.target.value)}>
                      <option value="">Custom assessment</option>
                      {visibleScenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.title}</option>)}
                    </select>
                    {scenarioId && scenarios.find((item) => item.id === scenarioId) && <div className="scenario-note"><span>↳</span>{scenarios.find((item) => item.id === scenarioId)?.description}<em>Preview only · submit to assess</em></div>}
                    <div className="field-grid two-col">
                      <div><label className="field-label" htmlFor="profile">Synthetic profile</label><input id="profile" value={draft.customer_id} onChange={(event) => setDraft({ ...draft, customer_id: event.target.value })} readOnly={flow === 'invoice_payment'} required />{flow === 'invoice_payment' && <small className="field-help">Set by the selected vendor record.</small>}</div>
                      <div><label className="field-label" htmlFor="amount">Amount <span className="currency-chip">{draft.currency ? `${draft.currency} ₹` : 'Currency required'}</span></label><div className="amount-input"><span>{draft.currency === 'INR' ? '₹' : ''}</span><input id="amount" type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} required /><small>{draft.currency || '—'}</small></div></div>
                    </div>
                    {flow === 'invoice_payment' && <div className="field-grid two-col"><div><label className="field-label" htmlFor="currency">Invoice currency</label><input id="currency" maxLength={3} autoCapitalize="characters" value={draft.currency} onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })} aria-describedby="currency-help" required /><small id="currency-help" className="field-help">{extraction && !draft.currency ? 'Currency was not available from extraction. Enter INR explicitly to continue.' : 'This prototype assesses INR invoices. Review or edit the extracted currency.'}</small></div></div>}
                    {flow === 'consumer_transfer' ? <div className="field-grid two-col">
                      <div><label className="field-label" htmlFor="recipient">Recipient UPI ID</label><input id="recipient" autoComplete="off" placeholder="name@bank" value={draft.recipient.identifier} onChange={(event) => setDraft({ ...draft, recipient: { ...draft.recipient, identifier: event.target.value }, method_details: { ...draft.method_details, upi_address: event.target.value } })} required /></div>
                      <div><label className="field-label" htmlFor="recipient-name">Recipient name <span className="optional">OPTIONAL</span></label><input id="recipient-name" value={draft.recipient.display_name ?? ''} onChange={(event) => setDraft({ ...draft, recipient: { ...draft.recipient, display_name: event.target.value } })} /></div>
                    </div> : <>
                      <div className="field-grid two-col">
                        <div><label className="field-label" htmlFor="vendor">Known vendor <span className="optional">SELECT EXPLICITLY</span></label><select id="vendor" value={selectedVendorId} onChange={(event) => selectVendor(event.target.value)} required><option value="">Select from demo vendor records…</option>{vendors.map((vendor) => <option key={vendor.vendor_id} value={vendor.vendor_id}>{vendor.vendor_name} · {vendor.customer_id}</option>)}</select><small className="field-help">{selectedVendorId ? `Saved destination: ${vendors.find((item) => item.vendor_id === selectedVendorId)?.known_destination ?? 'not available'}. The invoice destination remains separately editable.` : 'Extracted vendor names do not select or verify a vendor.'}</small></div>
                        <div><label className="field-label" htmlFor="invoice">Invoice number</label><input id="invoice" value={str(draft.method_details.invoice_number)} onChange={(event) => setMethodField('invoice_number', event.target.value)} required /></div>
                      </div>
                      <div className="field-grid two-col">
                        <div><label className="field-label" htmlFor="account">Requested destination account</label><input id="account" value={str(draft.method_details.destination_account)} onChange={(event) => setMethodField('destination_account', event.target.value)} required /></div>
                        <div><label className="field-label" htmlFor="payee">Name shown on invoice <span className="optional">EDITABLE</span></label><input id="payee" value={draft.recipient.display_name ?? ''} onChange={(event) => setDraft({ ...draft, recipient: { ...draft.recipient, display_name: event.target.value } })} /></div>
                      </div>
                    </>}
                  </div>

                  <div className="form-card context-card">
                    <div className="form-card-heading"><div><h3>Payment request context</h3><p>Optional message or instructions associated with this payment.</p></div><span className="form-step">B</span></div>
                    <label className="toggle-row"><span><strong>Include request context</strong><small>Context checks are clearly marked by provider mode.</small></span><input type="checkbox" checked={draft.context_enabled} onChange={(event) => setDraft({ ...draft, context_enabled: event.target.checked })} /><i aria-hidden="true" /></label>
                    {draft.context_enabled && <div className="context-input-wrap"><label className="field-label" htmlFor="context">Original request text <span className="character-count">{draft.context_text.length}/8,000</span></label><textarea id="context" rows={4} maxLength={8000} placeholder="Paste the message or instructions that came with this payment…" value={draft.context_text} onChange={(event) => setDraft({ ...draft, context_text: event.target.value })} /><div className="context-meta"><span>Evidence ID <code>{draft.evidence_id}</code></span><span>Stored as submitted evidence</span></div></div>}
                  </div>
                  <div className="form-footer"><span><span className="lock-icon">▣</span> No payment will be initiated.</span><button className="primary-button" type="submit" disabled={submitting || loading || extracting}>{submitting ? <><span className="spinner" /> Assessing…</> : extracting ? 'Wait for extraction…' : <>Assess payment <span>→</span></>}</button></div>
                </form>
              </section>

              <aside className="evidence-column" aria-label="Assessment decision">
                {selectedCase ? <><div className="prior-case-label"><span>↻</span><div><strong>Recorded assessment</strong><small>This result reflects the submitted values. Submit again after editing the form.</small></div></div><CaseDetail item={selectedCase} onExplain={requestExplanation} explaining={explaining} localOutcome={localOutcomes[selectedCase.assessment_id]} onOutcome={(state) => recordOutcome(selectedCase.assessment_id, state)} /></> : <div className="empty-evidence">
                  <div className="empty-art"><span className="empty-ring ring-one" /><span className="empty-ring ring-two" /><span className="empty-center">✳</span><span className="empty-orbit orbit-a">evidence</span><span className="empty-orbit orbit-b">decision</span></div>
                  <span className="eyebrow">DECISION PANEL</span><h2>Your assessment<br />will appear here.</h2><p>Recorded signals, missing checks, provider mode and the policy recommendation will be shown together.</p><div className="empty-rule"><span>01</span> Submit a payment request to begin</div><div className="empty-rule"><span>02</span> Inspect the evidence behind the outcome</div><div className="empty-caption">NO FRAUD SCORE · EVIDENCE FIRST</div>
                </div>}
              </aside>
            </div>
          ) : <section className="history-page">
            <div className="history-header"><div><span className="eyebrow">INVESTIGATION LOG</span><h2>Assessment history</h2><p>Cases from the consumer and invoice simulators, newest first.</p></div><div className="history-total"><strong>{cases.length}</strong><span>recorded cases</span></div></div>
            {loadingCases ? <div className="loading-state"><span className="spinner" /> Loading cases…</div> : cases.length ? <div className="history-layout"><div className="case-list">{cases.map((item) => <button className={`case-row ${selectedCase?.assessment_id === item.assessment_id ? 'selected' : ''}`} key={item.assessment_id} onClick={() => setSelectedCaseId(item.assessment_id)}><span className={`status-mark ${item.recommendation}`} /> <span className="case-row-main"><strong>{item.request.use_case === 'invoice_payment' ? 'Invoice payment' : 'UPI transfer'}</strong><small>{item.request.recipient.display_name || item.request.recipient.identifier} · {money(item.request.amount_minor, item.request.currency)}</small><small className="case-date">{new Date(item.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</small></span><span className={`recommendation-pill ${item.recommendation}`}>{humanize(item.recommendation)}</span></button>)}</div><div className="history-detail">{selectedCase && <CaseDetail item={selectedCase} onExplain={requestExplanation} explaining={explaining} localOutcome={localOutcomes[selectedCase.assessment_id]} onOutcome={(state) => recordOutcome(selectedCase.assessment_id, state)} />}</div></div> : <div className="history-empty"><span>▤</span><h3>No assessments recorded yet</h3><p>Submit a simulated UPI transfer or invoice to create the first case.</p><button className="secondary-button" onClick={() => setView('assess')}>Start an assessment →</button></div>}
          </section>}
          <footer className="page-footer"><span>SCAMSHIELD PROTOTYPE <i /> SYNTHETIC DATA ONLY</span><span>{config?.storage_mode ? `Case storage: ${humanize(config.storage_mode)} · ` : ''}Policy decisions support review. They do not guarantee safety.</span></footer>
        </div>
      </main>
      {needsAccessCode && <div className="modal-backdrop"><form className="access-modal" onSubmit={signIn}><div className="modal-mark">⌑</div><span className="eyebrow">RESTRICTED DEMO</span><h2>Enter access code</h2><p>This demo workspace requires an access code. Your code is sent only to the ScamShield server.</p>{accessError && <p className="access-error" role="alert">{accessError}</p>}<label className="field-label" htmlFor="access-code">Access code</label><input id="access-code" type="password" autoComplete="current-password" value={accessCode} onChange={(event) => { setAccessCode(event.target.value); setAccessError('') }} required autoFocus /><button className="primary-button" disabled={signingIn}>{signingIn ? 'Connecting…' : 'Continue securely →'}</button></form></div>}
    </div>
  )
}

function CaseDetail({ item, onExplain, explaining, localOutcome, onOutcome }: { item: CaseRecord; onExplain: () => void; explaining: boolean; localOutcome?: LocalOutcome; onOutcome: (state: LocalOutcome['state']) => void }) {
  const recommendation = item.recommendation
  const statusCopy: Record<Recommendation, { kicker: string; heading: string; body: string }> = {
    review: { kicker: 'REVIEW REQUIRED', heading: 'Pause this payment.', body: 'The configured policy found evidence that calls for analyst review.' },
    verify: { kicker: 'VERIFY FIRST', heading: 'Check through a trusted channel.', body: 'Confirm the request independently before you continue.' },
    continue: { kicker: 'NO INTERVENTION THRESHOLD MET', heading: 'No configured hold.', body: 'Available checks did not meet an intervention threshold. This does not guarantee the payment is safe.' },
  }
  const copy = statusCopy[recommendation]
  const actions = simulatorActions(recommendation, localOutcome?.state)
  const request = item.request
  return <div className="case-detail">
    <div className={`decision-banner ${recommendation}`}><div className="decision-top"><span className="decision-icon">{recommendation === 'review' ? '!' : recommendation === 'verify' ? '↗' : '✓'}</span><span>{copy.kicker}</span><span className="policy-chip">POLICY {item.policy_version}</span></div><h2>{copy.heading}</h2><p>{copy.body}</p><div className="decision-payment"><div><small>{request.use_case === 'invoice_payment' ? 'INVOICE PAYMENT' : 'UPI TRANSFER'} <i /> SIMULATED</small><strong>{money(request.amount_minor, request.currency)}</strong></div><div className="recipient-short"><small>TO</small><strong>{request.recipient.display_name || request.recipient.identifier || 'Unnamed recipient'}</strong></div></div><ProviderStrip providerStatus={item.provider_status} /></div>
    <div className="detail-section"><div className="detail-section-head"><h3>Evidence recorded</h3><span>{item.signals.length} {item.signals.length === 1 ? 'signal' : 'signals'}</span></div>
      {item.signals.length ? <div className="signal-list">{item.signals.map((signal, index) => <div className="signal-item" key={`${signal.code}-${index}`}><span className="signal-index">{String(index + 1).padStart(2, '0')}</span><div className="signal-copy"><strong>{humanize(signal.code)}</strong><p>{describeSignal(signal, request.currency)}</p><div className="signal-meta"><span>{humanize(signal.source)}</span>{signal.evidence_ids?.map((id) => <code key={id}>{id}</code>)}</div></div>{typeof signal.probability === 'number' && <span className="probability">{Math.round(signal.probability * 100)}%<small>{classificationLabel(signal.source, item.provider_status)}</small></span>}</div>)}</div> : <div className="quiet-empty">No signals were recorded for this assessment.</div>}
    </div>
    <div className="detail-section compact-section"><div className="detail-section-head"><h3>Checks not run</h3><span>{item.missing_data.length} unknowns</span></div>{item.missing_data.length ? <ul className="missing-list">{item.missing_data.map((entry, index) => <li key={`${entry}-${index}`}><span>?</span>{describeMissing(entry)}</li>)}</ul> : <p className="quiet-empty inline-empty">No unavailable checks recorded.</p>}</div>
    {request.context?.text && <div className="detail-section context-evidence"><div className="detail-section-head"><h3>Request context</h3><span>ORIGINAL EVIDENCE</span></div><blockquote>{request.context.text}</blockquote><div className="signal-meta"><span>{humanize(request.context.source)}</span><code>{request.context.evidence_id}</code></div></div>}
    <div className="detail-section explanation-section"><div className="detail-section-head"><h3>Decision explanation</h3><span className={`explanation-state ${item.explanation_status}`}>{humanize(item.explanation_status)}</span></div>{item.explanation ? <><p className="explanation-summary">{item.explanation.summary}</p>{item.explanation.next_step && <div className="next-step"><span>↳</span><p>{item.explanation.next_step}</p></div>}<details className="analyst-summary"><summary>Analyst summary</summary><p>{item.explanation.analyst_summary}</p></details></> : <div className="explanation-empty"><p>{item.explanation_status === 'pending' ? 'An evidence-grounded explanation has not been generated for this case.' : 'Explanation is unavailable. The recorded policy decision remains unchanged.'}</p><button className="secondary-button" onClick={onExplain} disabled={explaining}>{explaining ? <><span className="spinner" /> Generating…</> : 'Generate explanation →'}</button></div>}</div>
    <div className="detail-section provenance-section"><div className="detail-section-head"><h3>Run details</h3><span>SERVER RECORDED</span></div><div className="provider-grid">{Object.entries(item.provider_status).map(([provider, mode]) => <div className="provider-cell" key={provider}><span>{provider.toUpperCase()}</span><strong className={`provider-mode ${mode}`}>{humanize(mode)}</strong></div>)}<div className="provider-cell"><span>DECISION TIME</span><strong>{typeof item.timings_ms.decision === 'number' ? `${item.timings_ms.decision} ms` : 'Not recorded'}</strong></div><div className="provider-cell"><span>SCHEMA</span><strong>v{item.schema_version}</strong></div></div><div className="case-id">CASE ID <code>{item.assessment_id}</code></div><button className="text-button case-export" type="button" onClick={() => downloadCaseJson(item)}>Download case JSON ↓</button></div>
    <div className="sim-actions"><div className={`sim-state ${recommendation} ${localOutcome?.state ?? ''}`}><span>{localOutcome?.state === 'cancelled' ? '×' : localOutcome?.state === 'continued' ? '✓' : localOutcome?.state === 'verification_acknowledged' ? '↗' : '◉'}</span><div><strong>{localOutcomeLabel(recommendation, localOutcome)}</strong><small>{localOutcome?.state === 'verification_acknowledged' ? 'The Verify recommendation and original signals remain in place.' : localOutcome?.state === 'cancelled' ? 'The recorded recommendation and evidence remain unchanged; no money moved.' : localOutcome?.state === 'continued' ? 'The recorded recommendation and evidence remain unchanged; no money moved.' : recommendation === 'review' ? 'This case remains pending analyst review.' : 'These demo actions are kept in this browser session only.'}</small></div></div>{actions.length > 0 && <div className="sim-action-buttons">{actions.includes('acknowledge') && <button className="secondary-button" onClick={() => onOutcome('verification_acknowledged')}>I checked via an independently sourced contact</button>}{actions.includes('cancel') && <button className="text-button" onClick={() => onOutcome('cancelled')}>Cancel in simulator</button>}{actions.includes('continue') && <button className="primary-button" onClick={() => onOutcome('continued')}>Continue in simulator →</button>}</div>}{recommendation === 'review' && <div className="review-pending">REVIEW RECOMMENDATION · CONTINUATION UNAVAILABLE</div>}</div>
  </div>
}

export default App
