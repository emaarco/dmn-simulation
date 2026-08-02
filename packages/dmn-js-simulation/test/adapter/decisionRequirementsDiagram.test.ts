import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DmnModdle } from 'dmn-moddle'
import { definitionsToDecisionRequirementsDiagramModel, type ModdleElement } from '../../src/adapter/fromModdle'
import { evaluateDecisionRequirementsDiagram } from '../../src/domain/decisionRequirementsDiagram'

const discountXml = readFileSync(resolve(process.cwd(), 'test/fixtures/chaining/discount.dmn'), 'utf-8')
const loanXml = readFileSync(resolve(process.cwd(), 'test/fixtures/chaining/loanApproval.dmn'), 'utf-8')

async function decisionRequirementsDiagramModelFrom(xml: string) {
  const { rootElement } = await new DmnModdle().fromXML(xml)
  return definitionsToDecisionRequirementsDiagramModel(rootElement as ModdleElement)
}

describe('definitionsToDecisionRequirementsDiagramModel + evaluateDecisionRequirementsDiagram (chained DRD)', () => {
  it('builds the graph: two inputs, two decisions with the right requirements', async () => {
    const model = await decisionRequirementsDiagramModelFrom(discountXml)
    expect(model.inputData.map(i => i.name).sort()).toEqual(['Age', 'Amount'])

    const level = model.decisions.find(d => d.id === 'Decision_Level')!
    const discount = model.decisions.find(d => d.id === 'Decision_Discount')!
    expect(level.requiredInputIds).toEqual(['InputData_Age'])
    expect(discount.requiredDecisionIds).toEqual(['Decision_Level'])
    expect(discount.requiredInputIds).toEqual(['InputData_Amount'])
    expect(level.logic.kind).toBe('decisionTable')
  })

  it('chains Level → Discount for a young customer over the threshold', async () => {
    const model = await decisionRequirementsDiagramModelFrom(discountXml)
    const result = evaluateDecisionRequirementsDiagram(model, { InputData_Age: 25, InputData_Amount: 150 })
    expect(result.order).toEqual(['Decision_Level', 'Decision_Discount'])
    expect(result.results.Decision_Level.value).toBe('young')
    expect(result.results.Decision_Discount.value).toBe(5)
    // The sub-table result is available for row highlighting.
    expect(result.results.Decision_Discount.table?.reportedRuleIndices).toEqual([0])
  })

  it('chains for a senior customer', async () => {
    const model = await decisionRequirementsDiagramModelFrom(discountXml)
    const result = evaluateDecisionRequirementsDiagram(model, { InputData_Age: 40, InputData_Amount: 150 })
    expect(result.results.Decision_Level.value).toBe('senior')
    expect(result.results.Decision_Discount.value).toBe(10)
  })

  it('falls through to the catch-all rule below the amount threshold', async () => {
    const model = await decisionRequirementsDiagramModelFrom(discountXml)
    const result = evaluateDecisionRequirementsDiagram(model, { InputData_Age: 25, InputData_Amount: 50 })
    expect(result.results.Decision_Level.value).toBe('young')
    expect(result.results.Decision_Discount.value).toBe(0)
    expect(result.results.Decision_Discount.table?.reportedRuleIndices).toEqual([2])
  })
})

describe('3-level chain (loanApproval.dmn): Age → AgeGroup → Risk → Approval', () => {
  it('builds a three-decision graph with the right requirement edges', async () => {
    const model = await decisionRequirementsDiagramModelFrom(loanXml)
    expect(model.inputData.map(i => i.name).sort()).toEqual(['Age', 'Income', 'RequestedAmount'])
    expect(model.decisions.map(d => d.id).sort()).toEqual(['Decision_AgeGroup', 'Decision_Approval', 'Decision_Risk'])

    const approval = model.decisions.find(d => d.id === 'Decision_Approval')!
    expect(approval.requiredDecisionIds).toEqual(['Decision_Risk'])
    expect(approval.requiredInputIds).toEqual(['InputData_RequestedAmount'])
  })

  it('evaluates every level in dependency order and threads results end to end', async () => {
    const model = await decisionRequirementsDiagramModelFrom(loanXml)

    const rejected = evaluateDecisionRequirementsDiagram(model, {
      InputData_Age: 20,
      InputData_Income: 20000,
      InputData_RequestedAmount: 5000,
    })
    expect(rejected.order).toEqual(['Decision_AgeGroup', 'Decision_Risk', 'Decision_Approval'])
    expect(rejected.results.Decision_AgeGroup.value).toBe('young')
    expect(rejected.results.Decision_Risk.value).toBe('high')
    expect(rejected.results.Decision_Approval.value).toBe('rejected')

    const approved = evaluateDecisionRequirementsDiagram(model, {
      InputData_Age: 40,
      InputData_Income: 70000,
      InputData_RequestedAmount: 50000,
    })
    expect(approved.results.Decision_AgeGroup.value).toBe('adult')
    expect(approved.results.Decision_Risk.value).toBe('low')
    expect(approved.results.Decision_Approval.value).toBe('approved')

    const review = evaluateDecisionRequirementsDiagram(model, {
      InputData_Age: 40,
      InputData_Income: 40000,
      InputData_RequestedAmount: 50000,
    })
    expect(review.results.Decision_Risk.value).toBe('medium')
    expect(review.results.Decision_Approval.value).toBe('review')
  })
})
