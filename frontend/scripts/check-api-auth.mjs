import assert from 'node:assert/strict'
import { api, setTokenProvider } from '../.test-build/api.js'

const requestBody = {
  client_request_id: 'visitor-a-request',
  payment_method: 'bank_transfer',
  use_case: 'invoice_payment',
  amount_minor: 250000,
  currency: 'INR',
  occurred_at: '2026-10-18T00:00:00Z',
  customer_id: 'business-acme',
  recipient: { identifier: 'vendor-acme' },
  context: null,
  method_details: { vendor_id: 'vendor-acme', invoice_number: 'INV-1', destination_account: 'IN88-ACME' },
}

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

const originalFetch = globalThis.fetch
try {
  // A delayed 401 from visitor A must not retry A's assessment with visitor B's token.
  {
    const release = deferred()
    const started = deferred()
    const attempts = []
    setTokenProvider(async () => 'visitor-A-token')
    globalThis.fetch = async (_url, init) => {
      attempts.push(new Headers(init.headers).get('Authorization'))
      started.resolve()
      await release.promise
      return Response.json({ detail: 'expired' }, { status: 401 })
    }
    const pending = api.assess(requestBody)
    await started.promise
    setTokenProvider(async () => 'visitor-B-token')
    release.resolve()
    await assert.rejects(pending, (error) => error.status === 401 && /session changed/.test(error.message))
    assert.deepEqual(attempts, ['Bearer visitor-A-token'])
  }

  // A delayed successful response must also be discarded when identity changes.
  {
    const release = deferred()
    const started = deferred()
    setTokenProvider(async () => 'visitor-A-token')
    globalThis.fetch = async () => {
      started.resolve()
      await release.promise
      return Response.json({ assessment_id: 'case-a' })
    }
    const pending = api.assess(requestBody)
    await started.promise
    setTokenProvider(async () => 'visitor-B-token')
    release.resolve()
    await assert.rejects(pending, (error) => error.status === 401 && /session changed/.test(error.message))
  }

  // A token lookup already in flight cannot send its result after identity changes.
  {
    const release = deferred()
    const started = deferred()
    let requests = 0
    setTokenProvider(async () => {
      started.resolve()
      await release.promise
      return 'visitor-A-token'
    })
    globalThis.fetch = async () => { requests += 1; return Response.json({ assessment_id: 'wrong-owner' }) }
    const pending = api.assess(requestBody)
    await started.promise
    setTokenProvider(async () => 'visitor-B-token')
    release.resolve()
    await assert.rejects(pending, (error) => error.status === 401 && /session changed/.test(error.message))
    assert.equal(requests, 0)
  }

  // Same-visitor token refresh remains available for a genuine expired-token response.
  {
    const tokens = []
    let requests = 0
    setTokenProvider(async (forceRefresh) => {
      tokens.push(Boolean(forceRefresh))
      return 'visitor-A-token'
    })
    globalThis.fetch = async (_url, init) => {
      requests += 1
      assert.equal(new Headers(init.headers).get('Authorization'), 'Bearer visitor-A-token')
      return requests === 1 ? Response.json({ detail: 'expired' }, { status: 401 }) : Response.json({ assessment_id: 'case-a' })
    }
    const result = await api.assess(requestBody)
    assert.equal(result.assessment_id, 'case-a')
    assert.deepEqual(tokens, [false, true])
  }

  // Sample downloads use the same generation guard and must not refresh across visitors.
  {
    const release = deferred()
    const started = deferred()
    const attempts = []
    setTokenProvider(async () => 'visitor-A-token')
    globalThis.fetch = async (_url, init) => {
      attempts.push(new Headers(init.headers).get('Authorization'))
      started.resolve()
      await release.promise
      return new Response('expired', { status: 401 })
    }
    const pending = api.downloadSample('/api/v1/invoices/samples/demo/download')
    await started.promise
    setTokenProvider(async () => 'visitor-B-token')
    release.resolve()
    await assert.rejects(pending, (error) => error.status === 401 && /session changed/.test(error.message))
    assert.deepEqual(attempts, ['Bearer visitor-A-token'])
  }

  console.log('API auth generation checks passed.')
} finally {
  setTokenProvider(null)
  globalThis.fetch = originalFetch
}
