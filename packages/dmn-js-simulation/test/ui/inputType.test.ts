import { describe, it, expect } from 'vitest'
import { htmlInputType } from '../../src/ui/inputType'

describe('htmlInputType', () => {
  it('maps numeric typeRefs to a number field', () => {
    expect(htmlInputType('integer')).toBe('number')
    expect(htmlInputType('double')).toBe('number')
  })

  it('maps temporal typeRefs to native pickers', () => {
    expect(htmlInputType('date')).toBe('date')
    expect(htmlInputType('dateTime')).toBe('datetime-local')
    expect(htmlInputType('time')).toBe('time')
  })

  it('falls back to text for strings, durations and unknowns', () => {
    expect(htmlInputType('string')).toBe('text')
    expect(htmlInputType('dayTimeDuration')).toBe('text')
    expect(htmlInputType('')).toBe('text')
  })
})
