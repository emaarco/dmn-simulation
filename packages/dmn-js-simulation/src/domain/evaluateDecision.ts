/**
 * Evaluate a parsed DMN decision table against user-supplied input values.
 *
 * This is the orchestrator that wires the pieces together: coerce inputs, run
 * each rule's FEEL unary tests to find matches (`feel.ts`), evaluate the matched
 * rules' output expressions, then let the hit policy decide the result
 * (`hitPolicy.ts`).
 */

import type { DecisionModel } from './model'
import { coerceValue, evaluateExpression, evaluateUnaryTest, type RawValue } from './feel'
import { applyHitPolicy, type HitPolicyResult, type RuleOutput } from './hitPolicy'

export type { RawValue } from './feel'
export type { AggregationResult } from './hitPolicy'

export interface EvaluationResult extends HitPolicyResult {
  /** Every rule that matched, in table order — drives row highlighting. */
  matchedRuleIndices: number[]
}

/**
 * Whether an input cell matches a value. An empty cell or a dash always matches
 * (DMN "any"); a concrete test against a missing value never matches.
 */
function inputCellMatches(cellText: string, value: unknown): boolean {
  const text = (cellText || '').trim()
  if (text === '' || text === '-') return true
  if (value === undefined || value === null) return false
  return evaluateUnaryTest(text, value)
}

/** Evaluate every output cell of a rule into an object keyed by output name. */
function ruleOutput(model: DecisionModel, ruleIndex: number, context: Record<string, unknown>): RuleOutput {
  const rule = model.rules[ruleIndex]
  const obj: RuleOutput = {}
  model.outputs.forEach((output, ci) => {
    const text = (rule.outputEntries[ci] || '').trim()
    obj[output.name] = text === '' ? null : evaluateExpression(text, context)
  })
  return obj
}

export function evaluateDecision(model: DecisionModel, rawValues: RawValue[]): EvaluationResult {
  const values = model.inputs.map((input, i) => coerceValue(rawValues[i], input.typeRef))

  // Context for output expressions: bind each input by its FEEL expression and
  // by its label so literal *or* referencing outputs both resolve.
  const context: Record<string, unknown> = {}
  model.inputs.forEach((input, i) => {
    if (values[i] === undefined) return
    if (input.expression) context[input.expression] = values[i]
    if (input.label) context[input.label] = values[i]
  })

  const matchedRuleIndices: number[] = []
  model.rules.forEach((rule, ri) => {
    if (model.inputs.every((_, ci) => inputCellMatches(rule.inputEntries[ci], values[ci]))) {
      matchedRuleIndices.push(ri)
    }
  })

  const outputsByRule: Record<number, RuleOutput> = {}
  for (const ri of matchedRuleIndices) outputsByRule[ri] = ruleOutput(model, ri, context)

  return { matchedRuleIndices, ...applyHitPolicy(model, matchedRuleIndices, outputsByRule) }
}
