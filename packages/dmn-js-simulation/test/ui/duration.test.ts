import { describe, it, expect } from 'vitest'
import { composeDuration, isDurationType, parseDuration } from '../../src/ui/duration'

describe('isDurationType', () => {
  it('recognises the DMN duration typeRefs', () => {
    expect(isDurationType('duration')).toBe(true)
    expect(isDurationType('dayTimeDuration')).toBe(true)
    expect(isDurationType('yearMonthDuration')).toBe(true)
    expect(isDurationType('date')).toBe(false)
    expect(isDurationType('string')).toBe(false)
  })
})

describe('composeDuration', () => {
  it('composes an ISO 8601 duration per unit', () => {
    expect(composeDuration('2', 'Y')).toBe('P2Y')
    expect(composeDuration('3', 'M')).toBe('P3M')
    expect(composeDuration('4', 'D')).toBe('P4D')
    expect(composeDuration('5', 'H')).toBe('PT5H')
    expect(composeDuration('6', 'Min')).toBe('PT6M')
  })

  it('returns empty string for a blank amount', () => {
    expect(composeDuration('', 'D')).toBe('')
    expect(composeDuration('   ', 'Y')).toBe('')
  })
})

describe('parseDuration', () => {
  it('round-trips a single-unit duration', () => {
    expect(parseDuration('P2Y')).toEqual({ amount: '2', unit: 'Y' })
    expect(parseDuration('PT6M')).toEqual({ amount: '6', unit: 'Min' })
    expect(parseDuration('P4D')).toEqual({ amount: '4', unit: 'D' })
  })

  it('round-trips a fractional amount (composeDuration emits these)', () => {
    expect(parseDuration(composeDuration('2.5', 'H'))).toEqual({ amount: '2.5', unit: 'H' })
    expect(parseDuration('PT1.5M')).toEqual({ amount: '1.5', unit: 'Min' })
  })

  it('returns null for blank or multi-unit durations it cannot represent', () => {
    expect(parseDuration('')).toBeNull()
    expect(parseDuration('P1Y2M')).toBeNull()
    expect(parseDuration('nonsense')).toBeNull()
  })
})
