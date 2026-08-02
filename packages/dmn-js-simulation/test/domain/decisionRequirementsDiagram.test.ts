import { describe, it, expect } from 'vitest'
import {
  evaluateDecisionRequirementsDiagram,
  type DecisionRequirementsDiagramModel,
} from '../../src/domain/decisionRequirementsDiagram'

/** Two literal-expression decisions: B depends on A depends on Age. */
function linearModel(): DecisionRequirementsDiagramModel {
  return {
    inputData: [{ id: 'InputData_Age', name: 'Age', label: 'Age', typeRef: 'integer' }],
    decisions: [
      // Declared out of order on purpose to exercise the topological sort.
      {
        id: 'B',
        name: 'B',
        variableName: 'B',
        requiredDecisionIds: ['A'],
        requiredInputIds: [],
        logic: { kind: 'literalExpression', expression: 'A + 1' },
      },
      {
        id: 'A',
        name: 'A',
        variableName: 'A',
        requiredDecisionIds: [],
        requiredInputIds: ['InputData_Age'],
        logic: { kind: 'literalExpression', expression: 'Age * 2' },
      },
    ],
  }
}

describe('evaluateDecisionRequirementsDiagram', () => {
  it('evaluates decisions in dependency order and threads results downstream', () => {
    const result = evaluateDecisionRequirementsDiagram(linearModel(), { InputData_Age: 10 })
    expect(result.order).toEqual(['A', 'B'])
    expect(result.results.A.value).toBe(20) // Age * 2
    expect(result.results.B.value).toBe(21) // A + 1
  })

  it('coerces raw string input values by their typeRef', () => {
    const result = evaluateDecisionRequirementsDiagram(linearModel(), { InputData_Age: '5' })
    expect(result.results.A.value).toBe(10)
    expect(result.results.B.value).toBe(11)
  })

  it('marks decisions in a cycle as skipped instead of looping', () => {
    const cyclic: DecisionRequirementsDiagramModel = {
      inputData: [],
      decisions: [
        {
          id: 'X',
          name: 'X',
          variableName: 'X',
          requiredDecisionIds: ['Y'],
          requiredInputIds: [],
          logic: { kind: 'literalExpression', expression: 'Y' },
        },
        {
          id: 'Y',
          name: 'Y',
          variableName: 'Y',
          requiredDecisionIds: ['X'],
          requiredInputIds: [],
          logic: { kind: 'literalExpression', expression: 'X' },
        },
      ],
    }
    const result = evaluateDecisionRequirementsDiagram(cyclic, {})
    expect(result.order).toEqual([])
    expect(result.results.X.skipped).toBe(true)
    expect(result.results.Y.skipped).toBe(true)
  })

  it('ignores requirements that point outside the graph', () => {
    const model: DecisionRequirementsDiagramModel = {
      inputData: [],
      decisions: [
        {
          id: 'A',
          name: 'A',
          variableName: 'A',
          requiredDecisionIds: ['External'],
          requiredInputIds: [],
          logic: { kind: 'literalExpression', expression: '1 + 1' },
        },
      ],
    }
    const result = evaluateDecisionRequirementsDiagram(model, {})
    expect(result.order).toEqual(['A'])
    expect(result.results.A.value).toBe(2)
  })
})
