import { describe, it, expect } from 'vitest'
import { coerceValue, evaluateUnaryTest, evaluateExpression } from '../../src/domain/feel'

describe('coerceValue', () => {
  it('coerces numeric types to numbers', () => {
    expect(coerceValue('8', 'integer')).toBe(8)
    expect(coerceValue('3.5', 'double')).toBe(3.5)
  })

  it('coerces booleans', () => {
    expect(coerceValue('true', 'boolean')).toBe(true)
    expect(coerceValue('false', 'boolean')).toBe(false)
  })

  it('passes strings through', () => {
    expect(coerceValue('Fall', 'string')).toBe('Fall')
  })

  it('returns undefined for empty or non-numeric-in-numeric-column input', () => {
    expect(coerceValue('', 'integer')).toBeUndefined()
    expect(coerceValue(null, 'string')).toBeUndefined()
    expect(coerceValue('abc', 'integer')).toBeUndefined()
  })

  it('treats a whitespace-only numeric input as missing (not 0)', () => {
    expect(coerceValue('   ', 'integer')).toBeUndefined()
    expect(coerceValue('\t', 'string')).toBeUndefined()
  })

  it('parses temporal typeRefs into real FEEL temporals', () => {
    const date = coerceValue('2020-01-01', 'date') as { toISODate?: () => string }
    expect(date?.toISODate?.()).toBe('2020-01-01')

    const dateTime = coerceValue('2020-01-01T10:00:00', 'dateTime') as { toISO?: () => string }
    expect(typeof dateTime?.toISO?.()).toBe('string')

    // A real FEEL temporal compares like-typed in a unary test.
    expect(evaluateUnaryTest('< date("2020-06-01")', date)).toBe(true)
    expect(evaluateUnaryTest('> date("2020-06-01")', date)).toBe(false)
  })

  it('returns undefined for an unparseable temporal value', () => {
    expect(coerceValue('not-a-date', 'date')).toBeUndefined()
  })
})

describe('evaluateUnaryTest', () => {
  it('matches string and numeric unary tests', () => {
    expect(evaluateUnaryTest('"Fall"', 'Fall')).toBe(true)
    expect(evaluateUnaryTest('"Fall"', 'Winter')).toBe(false)
    expect(evaluateUnaryTest('<= 8', 5)).toBe(true)
    expect(evaluateUnaryTest('<= 8', 9)).toBe(false)
    expect(evaluateUnaryTest('[1..10]', 5)).toBe(true)
  })

  it('returns false instead of throwing on invalid FEEL', () => {
    expect(evaluateUnaryTest('', 5)).toBe(false)
    expect(evaluateUnaryTest('<<<', 5)).toBe(false)
  })
})

describe('evaluateExpression', () => {
  it('evaluates FEEL literals and context references', () => {
    expect(evaluateExpression('"Spareribs"', {})).toBe('Spareribs')
    expect(evaluateExpression('1 + 1', {})).toBe(2)
    expect(evaluateExpression('Season', { Season: 'Fall' })).toBe('Fall')
  })

  it('returns null instead of throwing on invalid FEEL', () => {
    expect(evaluateExpression('@@@', {})).toBeNull()
  })
})
