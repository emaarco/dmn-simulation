/**
 * DRD (whole-graph) evaluation: chain multiple decisions where one decision's
 * output feeds another's input, following DMN information requirements.
 *
 * Pure and framework-free, like the rest of `domain/`. The graph model is built
 * by `adapter/fromModdle.ts`; here we only topologically order the decisions,
 * evaluate each (decision table via `evaluateDecision`, or a literal expression
 * via the FEEL engine) and thread results into downstream contexts.
 */

import type { DecisionModel } from './model'
import type { RawValue } from './feel'
import { coerceValue, evaluateExpression } from './feel'
import { evaluateDecision, type EvaluationResult } from './evaluateDecision'

export interface DecisionRequirementsDiagramInputData {
  id: string
  /** Variable name the value is bound to (what input expressions reference). */
  name: string
  /** Human-friendly label shown in the form (the InputData name; falls back to `name`). */
  label: string
  typeRef: string
}

export type DecisionLogic =
  { kind: 'decisionTable'; model: DecisionModel } | { kind: 'literalExpression'; expression: string } | { kind: 'none' }

export interface DecisionRequirementsDiagramDecision {
  id: string
  name: string
  /** Variable name the result is bound to for downstream decisions. */
  variableName: string
  requiredDecisionIds: string[]
  requiredInputIds: string[]
  logic: DecisionLogic
}

export interface DecisionRequirementsDiagramModel {
  inputData: DecisionRequirementsDiagramInputData[]
  decisions: DecisionRequirementsDiagramDecision[]
}

export interface DecisionEvaluation {
  decisionId: string
  /** The value bound into downstream contexts (scalar, list or object). */
  value: unknown
  /** Present for decision-table decisions — drives per-table row highlighting. */
  table?: EvaluationResult
  /**
   * The concrete input values fed to a decision-table decision (in table input
   * order), resolved from the graph context. Lets the table view reflect the
   * exact scenario when the user drills into this decision.
   */
  inputs?: RawValue[]
  /** Set when the decision was not evaluated (unresolved dependency / cycle). */
  skipped?: boolean
}

export interface DecisionRequirementsDiagramEvaluationResult {
  /** Decision ids in evaluation (topological) order. */
  order: string[]
  /** Result per decision id. */
  results: Record<string, DecisionEvaluation>
}

/** The single value a decision contributes downstream, given its table result. */
function decisionTableValue(model: DecisionModel, evaluation: EvaluationResult): unknown {
  if (evaluation.aggregation) return evaluation.aggregation.value
  if (evaluation.outputs.length === 0) return null
  if (model.outputs.length === 1) {
    const name = model.outputs[0].name
    const values = evaluation.outputs.map(output => output[name])
    return values.length === 1 ? values[0] : values
  }
  return evaluation.outputs.length === 1 ? evaluation.outputs[0] : evaluation.outputs
}

/**
 * Topologically order the decisions by their decision→decision requirements
 * (Kahn's algorithm). Decisions left over form a cycle and are returned last so
 * the caller can mark them skipped.
 */
function topologicalOrder(decisions: DecisionRequirementsDiagramDecision[]): { order: string[]; cyclic: string[] } {
  const ids = new Set(decisions.map(d => d.id))
  const indegree = new Map<string, number>()
  const dependents = new Map<string, string[]>()

  for (const d of decisions) indegree.set(d.id, 0)
  for (const d of decisions) {
    for (const req of d.requiredDecisionIds) {
      if (!ids.has(req)) continue // requirement outside this graph — ignore
      indegree.set(d.id, (indegree.get(d.id) ?? 0) + 1)
      dependents.set(req, [...(dependents.get(req) ?? []), d.id])
    }
  }

  const queue = decisions.filter(d => (indegree.get(d.id) ?? 0) === 0).map(d => d.id)
  const order: string[] = []
  while (queue.length) {
    const id = queue.shift() as string
    order.push(id)
    for (const dep of dependents.get(id) ?? []) {
      indegree.set(dep, (indegree.get(dep) ?? 0) - 1)
      if ((indegree.get(dep) ?? 0) === 0) queue.push(dep)
    }
  }

  const cyclic = decisions.filter(d => !order.includes(d.id)).map(d => d.id)
  return { order, cyclic }
}

/**
 * Evaluate a DRD against concrete input-data values.
 *
 * @param inputValues raw values keyed by InputData **id**
 */
export function evaluateDecisionRequirementsDiagram(
  model: DecisionRequirementsDiagramModel,
  inputValues: Record<string, RawValue>,
): DecisionRequirementsDiagramEvaluationResult {
  // Seed the FEEL context with the coerced input-data values, bound by name.
  const context: Record<string, unknown> = {}
  for (const input of model.inputData) {
    const coerced = coerceValue(inputValues[input.id], input.typeRef)
    if (coerced !== undefined) context[input.name] = coerced
  }

  const byId = new Map(model.decisions.map(d => [d.id, d]))
  const { order, cyclic } = topologicalOrder(model.decisions)
  const results: Record<string, DecisionEvaluation> = {}

  for (const id of order) {
    const decision = byId.get(id) as DecisionRequirementsDiagramDecision
    const evaluation = evaluateDecisionNode(decision, context)
    results[id] = evaluation
    if (!evaluation.skipped) context[decision.variableName] = evaluation.value
  }

  for (const id of cyclic) {
    results[id] = { decisionId: id, value: null, skipped: true }
  }

  return { order, results }
}

function evaluateDecisionNode(
  decision: DecisionRequirementsDiagramDecision,
  context: Record<string, unknown>,
): DecisionEvaluation {
  const { logic } = decision

  if (logic.kind === 'decisionTable') {
    // Resolve each table input from the context via its FEEL input expression.
    const values: RawValue[] = logic.model.inputs.map(input => {
      if (!input.expression) return undefined
      const resolved = evaluateExpression(input.expression, context)
      return resolved as RawValue
    })
    const table = evaluateDecision(logic.model, values)
    return { decisionId: decision.id, value: decisionTableValue(logic.model, table), table, inputs: values }
  }

  if (logic.kind === 'literalExpression') {
    return { decisionId: decision.id, value: evaluateExpression(logic.expression, context) }
  }

  return { decisionId: decision.id, value: null, skipped: true }
}
