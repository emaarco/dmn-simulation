// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseDecisionModelFromXml } from '../../src/adapter/fromXml'
import { evaluateDecision } from '../../src/domain/evaluateDecision'

/**
 * End-to-end tests for the orchestrator: parse → FEEL matching → output
 * evaluation → hit policy, exercised through real DMN XML. Isolated FEEL and
 * hit-policy behaviour is covered in domain/feel.test.ts / domain/hitPolicy.test.ts.
 */
const exampleXml = readFileSync(resolve(process.cwd(), 'test/fixtures/example.dmn'), 'utf-8')
const dish = parseDecisionModelFromXml(exampleXml)

describe('evaluateDecision — FIRST decision table (example.dmn)', () => {
  it('fires the first matching rule and returns its output', () => {
    const r = evaluateDecision(dish, ['Fall', 8])
    expect(r.matchedRuleIndices).toEqual([0])
    expect(r.reportedRuleIndices).toEqual([0])
    expect(r.outputs).toEqual([{ Dish: 'Spareribs' }])
  })

  it('evaluates numeric unary tests (<= / >)', () => {
    expect(evaluateDecision(dish, ['Winter', 8]).outputs).toEqual([{ Dish: 'Roastbeef' }])
    expect(evaluateDecision(dish, ['Spring', 4]).outputs).toEqual([{ Dish: 'Dry Aged Gourmet Steak' }])
    expect(evaluateDecision(dish, ['Spring', 5]).outputs).toEqual([{ Dish: 'Stew' }])
  })

  it('treats an empty input cell as a wildcard match', () => {
    // Rule 5 (Summer) has an empty guest-count cell — any count matches.
    const r = evaluateDecision(dish, ['Summer', 999])
    expect(r.matchedRuleIndices).toEqual([4])
    expect(r.outputs).toEqual([{ Dish: 'Light Salad and a nice Steak' }])
  })

  it('reports no match when nothing fires', () => {
    const r = evaluateDecision(dish, ['Fall', 20])
    expect(r.matchedRuleIndices).toEqual([])
    expect(r.outputs).toEqual([])
  })

  it('does not match a concrete test when the input is missing', () => {
    expect(evaluateDecision(dish, ['', '']).matchedRuleIndices).toEqual([])
  })
})

describe('evaluateDecision — date input (end-to-end)', () => {
  const dateModel = parseDecisionModelFromXml(readFileSync(resolve(process.cwd(), 'test/fixtures/date.dmn'), 'utf-8'))

  it('coerces a date input and matches temporal unary tests', () => {
    expect(evaluateDecision(dateModel, ['2020-01-15']).outputs).toEqual([{ Season: 'First Half' }])
    expect(evaluateDecision(dateModel, ['2020-07-15']).outputs).toEqual([{ Season: 'Summer' }])
    expect(evaluateDecision(dateModel, ['2020-11-15']).outputs).toEqual([{ Season: 'Second Half' }])
  })

  it('reports no match for an unparseable date', () => {
    expect(evaluateDecision(dateModel, ['not-a-date']).matchedRuleIndices).toEqual([])
  })
})

describe('evaluateDecision — COLLECT with SUM aggregation (end-to-end)', () => {
  const sumXml = `<?xml version="1.0" encoding="UTF-8"?>
    <definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="d" name="d">
      <decision id="Decision_Points" name="Points">
        <decisionTable id="T" hitPolicy="COLLECT" aggregation="SUM">
          <input id="i"><inputExpression id="ie" typeRef="integer"><text>Cart</text></inputExpression></input>
          <output id="o" label="Points" name="Points" typeRef="integer" />
          <rule id="r1"><inputEntry id="e1"><text>&gt;= 50</text></inputEntry><outputEntry id="oe1"><text>5</text></outputEntry></rule>
          <rule id="r2"><inputEntry id="e2"><text>&gt;= 100</text></inputEntry><outputEntry id="oe2"><text>10</text></outputEntry></rule>
          <rule id="r3"><inputEntry id="e3"><text>&gt;= 200</text></inputEntry><outputEntry id="oe3"><text>20</text></outputEntry></rule>
        </decisionTable>
      </decision>
    </definitions>`

  it('matches every applicable rule and aggregates their outputs', () => {
    const model = parseDecisionModelFromXml(sumXml)
    const r = evaluateDecision(model, [250])
    expect(r.matchedRuleIndices).toEqual([0, 1, 2])
    expect(r.aggregation).toEqual({ fn: 'SUM', output: 'Points', value: 35 })
    expect(r.outputs).toEqual([])
  })
})
