// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseDecisionModelFromXml } from '../../src/adapter/fromXml'
import { isNumericType } from '../../src/domain/model'

const exampleXml = readFileSync(resolve(process.cwd(), 'test/fixtures/example.dmn'), 'utf-8')

describe('parseDecisionModelFromXml', () => {
  it('parses inputs, outputs, rules and hit policy from the example', () => {
    const model = parseDecisionModelFromXml(exampleXml)

    expect(model.decisionName).toBe('Dish')
    expect(model.hitPolicy).toBe('FIRST')
    expect(model.inputs.map(i => i.label)).toEqual(['Season', 'Number of Guests'])
    expect(model.outputs.map(o => o.name)).toEqual(['Dish'])
    expect(model.rules).toHaveLength(5)
  })

  it('derives the correct types and dropdown options per input column', () => {
    const model = parseDecisionModelFromXml(exampleXml)
    const [season, guests] = model.inputs

    expect(season.typeRef).toBe('string')
    expect(season.options).toEqual(['Fall', 'Winter', 'Spring', 'Summer'])
    expect(guests.typeRef).toBe('integer')
    expect(guests.options).toEqual([]) // numeric column → no literal dropdown
  })

  it('selects a decision by id', () => {
    const model = parseDecisionModelFromXml(exampleXml, 'Decision_Dish')
    expect(model.decisionId).toBe('Decision_Dish')
  })

  it('throws on a missing decision id', () => {
    expect(() => parseDecisionModelFromXml(exampleXml, 'Nope')).toThrow(/No decision with id/)
  })

  it('throws on malformed XML', () => {
    expect(() => parseDecisionModelFromXml('<definitions')).toThrow()
  })

  it('parses the COLLECT aggregation attribute and output priority values', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
      <definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" id="d" name="d">
        <decision id="Decision_Risk" name="Risk">
          <decisionTable id="T" hitPolicy="COLLECT" aggregation="SUM">
            <input id="i"><inputExpression id="ie" typeRef="integer"><text>Score</text></inputExpression></input>
            <output id="o" label="Points" typeRef="integer">
              <outputValues><text>"High","Medium","Low"</text></outputValues>
            </output>
            <rule id="r1"><inputEntry id="ie1"><text>&gt; 0</text></inputEntry><outputEntry id="oe1"><text>5</text></outputEntry></rule>
          </decisionTable>
        </decision>
      </definitions>`
    const model = parseDecisionModelFromXml(xml)
    expect(model.hitPolicy).toBe('COLLECT')
    expect(model.aggregation).toBe('SUM')
    expect(model.outputs[0].priorityValues).toEqual(['High', 'Medium', 'Low'])
  })

  it('leaves aggregation undefined and priority values empty when unset', () => {
    const model = parseDecisionModelFromXml(exampleXml)
    expect(model.aggregation).toBeUndefined()
    expect(model.outputs[0].priorityValues).toEqual([])
  })
})

describe('isNumericType', () => {
  it('recognises numeric DMN types case-insensitively', () => {
    expect(isNumericType('integer')).toBe(true)
    expect(isNumericType('Double')).toBe(true)
    expect(isNumericType('string')).toBe(false)
  })
})
