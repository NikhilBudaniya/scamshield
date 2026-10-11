import type { Recommendation, Signal } from './types.js'

const contextualDescriptions: Record<string, string> = {
  safe_account: 'a request to move money to a so-called safe account',
  impersonation: 'wording that may impersonate a trusted person or institution',
  urgency: 'pressure to act urgently',
  secrecy: 'a request to keep the payment secret',
  upfront_fee: 'a request for an upfront fee or payment',
  bypass_verification: 'an instruction to bypass established verification',
}

export function describeContextSignal(signal: Signal): string {
  const description = contextualDescriptions[signal.code]
  if (!description) return 'The classifier recorded a message-context signal.'

  const probability = signal.probability
  if (typeof probability !== 'number') {
    return signal.value === true
      ? `The classifier marked wording related to ${description}. This is a text classification, not a finding of fraud.`
      : `The classifier did not mark wording related to ${description}.`
  }

  const likelihood = `${Math.round(probability * 100)}% likelihood of ${description}`
  if (probability < 0.6) {
    return `The classifier assigned a ${likelihood}. This is below the configured Verify threshold and is retained as low-likelihood context, not intervention evidence or a fraud probability.`
  }
  if (probability < 0.8) {
    return `The classifier assigned a ${likelihood}. This meets the provisional Verify threshold, but describes message wording only and is not a probability of fraud.`
  }
  return `The classifier assigned a ${likelihood}. This is a high-likelihood wording signal for policy combinations; it is not a probability of fraud.`
}

export type SimulatorAction = 'acknowledge' | 'cancel' | 'continue'

export function simulatorActions(recommendation: Recommendation, state?: string): SimulatorAction[] {
  if (state === 'cancelled' || state === 'continued') return []
  if (recommendation === 'review') return ['cancel']
  if (recommendation === 'verify') return state === 'verification_acknowledged' ? ['cancel'] : ['acknowledge', 'cancel']
  return ['cancel', 'continue']
}
