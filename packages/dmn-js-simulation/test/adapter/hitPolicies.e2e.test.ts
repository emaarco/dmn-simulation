// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseDecisionModelFromXml } from '../../src/adapter/fromXml'
import { evaluateDecision } from '../../src/domain/evaluateDecision'

/**
 * End-to-end evaluation for every hit policy, parsed from the shared fixtures.
 * These fixtures existed but were only checked for structural moddle-vs-XML
 * equality — never actually evaluated. This closes that gap.
 */
function load(name: string) {
  return parseDecisionModelFromXml(
    readFileSync(resolve(process.cwd(), `test/fixtures/hit-policies/${name}.dmn`), 'utf-8'),
  )
}

describe('UNIQUE (unique.dmn)', () => {
  const m = load('unique')
  it('reports the single matching tier without a violation', () => {
    const r = evaluateDecision(m, [3000])
    expect(r.matchedRuleIndices).toEqual([1])
    expect(r.outputs).toEqual([{ Tier: 'Silver' }])
    expect(r.violation).toBeUndefined()
  })
})

describe('ANY (any.dmn)', () => {
  const m = load('any')
  it('highlights all agreeing rules but returns a single value', () => {
    const r = evaluateDecision(m, [25])
    expect(r.matchedRuleIndices).toEqual([0, 1])
    expect(r.reportedRuleIndices).toEqual([0, 1])
    expect(r.outputs).toEqual([{ Access: 'Granted' }])
    expect(r.violation).toBeUndefined()
  })
})

describe('PRIORITY (priority.dmn)', () => {
  const m = load('priority')
  it('picks the highest-priority output among all matches', () => {
    // Score 550 matches Review, Decline and Approve; Decline ranks highest.
    const r = evaluateDecision(m, [550])
    expect(r.matchedRuleIndices).toEqual([0, 1, 2])
    expect(r.reportedRuleIndices).toEqual([1])
    expect(r.outputs).toEqual([{ Decision: 'Decline' }])
  })
})

describe('OUTPUT ORDER (output-order.dmn)', () => {
  const m = load('output-order')
  it('lists every match sorted by output-value priority', () => {
    const r = evaluateDecision(m, [40])
    expect(r.matchedRuleIndices).toEqual([0, 1])
    expect(r.reportedRuleIndices).toEqual([1, 0])
    expect(r.outputs).toEqual([{ Warning: 'Extreme Heat' }, { Warning: 'Heat' }])
  })
})

describe('RULE ORDER (rule-order.dmn)', () => {
  const m = load('rule-order')
  it('lists every match in table order', () => {
    const r = evaluateDecision(m, [40])
    expect(r.reportedRuleIndices).toEqual([0, 1])
    expect(r.outputs).toEqual([{ Warning: 'Heat' }, { Warning: 'Extreme Heat' }])
  })
})

describe('COLLECT unaggregated (collect.dmn)', () => {
  const m = load('collect')
  it('collects every matching output as a list', () => {
    const r = evaluateDecision(m, [250])
    expect(r.matchedRuleIndices).toEqual([0, 1, 2])
    expect(r.outputs).toEqual([
      { Promotion: 'Free Shipping' },
      { Promotion: 'Gift Wrap' },
      { Promotion: '10% Voucher' },
    ])
    expect(r.aggregation).toBeUndefined()
  })
})
