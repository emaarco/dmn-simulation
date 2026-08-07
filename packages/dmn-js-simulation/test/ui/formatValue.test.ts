import { describe, it, expect } from 'vitest'
import { formatValue } from '../../src/ui/formatValue'

describe('formatValue', () => {
  it('renders primitives', () => {
    expect(formatValue('Spareribs')).toBe('Spareribs')
    expect(formatValue(42)).toBe('42')
    expect(formatValue(true)).toBe('true')
    expect(formatValue(10n)).toBe('10')
  })

  it('renders null/undefined and non-finite numbers as a dash', () => {
    expect(formatValue(null)).toBe('–')
    expect(formatValue(undefined)).toBe('–')
    expect(formatValue(NaN)).toBe('–')
    expect(formatValue(Infinity)).toBe('–')
  })

  it('renders Date and Luxon-style temporals as ISO', () => {
    expect(formatValue(new Date('2020-01-01T00:00:00Z'))).toBe('2020-01-01T00:00:00.000Z')
    expect(formatValue({ toISO: () => '2020-01-01T00:00:00.000Z' })).toBe('2020-01-01T00:00:00.000Z')
  })

  it('never throws on functions, symbols or circular objects', () => {
    expect(formatValue(() => 1)).toBe('–')
    expect(formatValue(Symbol('x'))).toBe('–')
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(formatValue(circular)).toBe('–')
  })

  it('renders plain objects/arrays as compact JSON', () => {
    expect(formatValue({ a: 1 })).toBe('{"a":1}')
    expect(formatValue([1, 2])).toBe('[1,2]')
  })
})
