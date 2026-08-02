// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { DmnModdle } from 'dmn-moddle'
import { decisionTableToModel, type ModdleElement } from '../../src/adapter/fromModdle'
import { parseDecisionModelFromXml } from '../../src/adapter/fromXml'
import { evaluateDecision } from '../../src/domain/evaluateDecision'

const fixturesDir = resolve(process.cwd(), 'test/fixtures')

/** Read a fixture and return the first decision table businessObject. */
async function firstDecisionTable(xml: string): Promise<ModdleElement> {
  const moddle = new DmnModdle()
  const { rootElement } = await moddle.fromXML(xml)
  const decisions = (rootElement.drgElement ?? []).filter((e: ModdleElement) => e.$type === 'dmn:Decision')
  const decision = decisions.find(
    (d: ModdleElement) => (d.decisionLogic as ModdleElement)?.$type === 'dmn:DecisionTable',
  )
  return decision.decisionLogic as ModdleElement
}

const exampleXml = readFileSync(resolve(fixturesDir, 'example.dmn'), 'utf-8')

describe('decisionTableToModel', () => {
  it('reads inputs, outputs, rules and hit policy from the example businessObject', async () => {
    const model = decisionTableToModel(await firstDecisionTable(exampleXml))
    expect(model.decisionName).toBe('Dish')
    expect(model.hitPolicy).toBe('FIRST')
    expect(model.inputs.map(i => i.label)).toEqual(['Season', 'Number of Guests'])
    expect(model.inputs[0].options).toEqual(['Fall', 'Winter', 'Spring', 'Summer'])
    expect(model.outputs.map(o => o.name)).toEqual(['Dish'])
    expect(model.rules).toHaveLength(5)
  })

  it('rejects a non-decision-table businessObject', () => {
    expect(() => decisionTableToModel({ $type: 'dmn:LiteralExpression' })).toThrow(/Expected a dmn:DecisionTable/)
  })

  it('produces the same DecisionModel as the XML adapter for every fixture', async () => {
    const files = ['example.dmn', ...readdirSync(resolve(fixturesDir, 'hit-policies')).map(f => `hit-policies/${f}`)]
    for (const file of files) {
      const xml = readFileSync(resolve(fixturesDir, file), 'utf-8')
      const fromModdle = decisionTableToModel(await firstDecisionTable(xml))
      const fromXml = parseDecisionModelFromXml(xml)
      expect(fromModdle, `mismatch for ${file}`).toEqual(fromXml)
    }
  })

  it('the moddle-derived model evaluates identically to the XML-derived one', async () => {
    const model = decisionTableToModel(await firstDecisionTable(exampleXml))
    expect(evaluateDecision(model, ['Winter', 8]).outputs).toEqual([{ Dish: 'Roastbeef' }])
    expect(evaluateDecision(model, ['Summer', 999]).matchedRuleIndices).toEqual([4])
  })
})
