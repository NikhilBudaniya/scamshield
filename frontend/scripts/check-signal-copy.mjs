import assert from 'node:assert/strict'
import { describeContextSignal, simulatorActions } from '../.test-build/signal-copy.js'

const signal = (probability, value) => ({
  code: 'safe_account', source: 'jev_classification', value,
  evidence_ids: ['message-1'], probability,
})

const low = describeContextSignal(signal(0.18, false))
assert.match(low, /below the configured Verify threshold/)
assert.match(low, /not intervention evidence or a fraud probability/)
assert.doesNotMatch(low, /message contains wording/i)

const verify = describeContextSignal(signal(0.72, true))
assert.match(verify, /meets the provisional Verify threshold/)
assert.match(verify, /not a probability of fraud/)

const high = describeContextSignal(signal(0.96, true))
assert.match(high, /high-likelihood wording signal/)
assert.match(high, /not a probability of fraud/)

assert.deepEqual(simulatorActions('verify'), ['acknowledge', 'cancel'])
assert.deepEqual(simulatorActions('verify', 'verification_acknowledged'), ['cancel'])
assert.deepEqual(simulatorActions('review'), ['cancel'])
assert.deepEqual(simulatorActions('continue'), ['cancel', 'continue'])
assert.deepEqual(simulatorActions('continue', 'continued'), [])
assert.deepEqual(simulatorActions('verify', 'cancelled'), [])

console.log('Contextual signal copy and simulator action checks passed.')
