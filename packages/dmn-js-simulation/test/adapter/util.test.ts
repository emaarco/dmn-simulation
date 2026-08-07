import { describe, it, expect } from 'vitest'
import { collectColumnBounds, collectColumnOptions, parseOutputValueList } from '../../src/adapter/util'

describe('parseOutputValueList', () => {
  it('splits a quoted FEEL list into ordered bare values', () => {
    expect(parseOutputValueList('"Decline","Review","Approve"')).toEqual(['Decline', 'Review', 'Approve'])
    expect(parseOutputValueList('')).toEqual([])
  })
})

describe('collectColumnOptions', () => {
  it('collects distinct quoted literals in order', () => {
    expect(collectColumnOptions(['"Fall"', '"Winter"', '"Fall"', '> 5'])).toEqual(['Fall', 'Winter'])
  })
})

describe('collectColumnBounds', () => {
  it('returns min/max for a fully-bounded numeric column', () => {
    // Grades partitioned into closed bands: [0..50], [51..70], [71..100].
    expect(collectColumnBounds(['[0..50]', '[51..70]', '[71..100]'], 'integer')).toEqual({ min: '0', max: '100' })
  })

  it('returns min/max for a fully-bounded date column', () => {
    const bounds = collectColumnBounds(
      ['[date("2026-03-01")..date("2026-05-31")]', '[date("2026-06-01")..date("2026-08-31")]'],
      'date',
    )
    expect(bounds).toEqual({ min: '2026-03-01', max: '2026-08-31' })
  })

  it('leaves an open side unbounded (< / > tests)', () => {
    // Seasonal-style: open below and above → no min, no max.
    expect(
      collectColumnBounds(
        ['< date("2026-03-01")', '[date("2026-03-01")..date("2026-08-31")]', '> date("2026-08-31")'],
        'date',
      ),
    ).toEqual({})
    // Only the lower side open → max only.
    expect(collectColumnBounds(['< 100', '[100..200]'], 'integer')).toEqual({ max: '200' })
    // Only the upper side open → min only.
    expect(collectColumnBounds(['[0..100]', '>= 100'], 'integer')).toEqual({ min: '0' })
  })

  it('treats a wildcard rule as fully unbounded', () => {
    expect(collectColumnBounds(['[0..50]', '-'], 'integer')).toEqual({})
  })

  it('ignores non-numeric / non-date columns', () => {
    expect(collectColumnBounds(['"Fall"', '"Winter"'], 'string')).toEqual({})
  })
})
