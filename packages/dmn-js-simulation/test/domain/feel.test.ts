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
