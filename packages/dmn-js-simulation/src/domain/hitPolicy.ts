/**
 * DMN hit-policy semantics — pure, FEEL-free. Given the rules that matched and
 * their already-evaluated output objects, decide which rule(s) form the result
 * and how their outputs are combined.
 *
 * No JS/browser DMN engine covers the full policy set (`dmn-eval-js` and forks
 * are unmaintained and lack PRIORITY, OUTPUT ORDER and COLLECT aggregations), so
 * this layer is owned here. It sits on top of `feel.ts`, which handles the FEEL
 * matching; this module never touches the FEEL engine.
 */

import type { Aggregation, DecisionModel, DmnOutput } from './model'

/** A single evaluated rule output, keyed by output name. */
export type RuleOutput = Record<string, unknown>

export interface AggregationResult {
  fn: Aggregation
  /** Name of the (single) output the aggregate was computed over. */
  output: string
  /** `null` for MIN/MAX over an empty set — no real minimum/maximum exists. */
  value: number | null
}

export interface HitPolicyResult {
  /** Rules whose output forms the result after the hit policy is applied. */
  reportedRuleIndices: number[]
  /** Output objects for the reported rules (empty when an aggregation applies). */
  outputs: RuleOutput[]
  /** Present for COLLECT with an aggregation (SUM/MIN/MAX/COUNT). */
  aggregation?: AggregationResult
  /** Set when the policy's constraint is violated (e.g. UNIQUE matched twice). */
  violation?: string
}

/** Priority rank of a value within an output's list (lower = higher priority). */
function priorityRank(value: unknown, output: DmnOutput): number {
  const list = output.priorityValues
  if (!list.length) return Number.POSITIVE_INFINITY
  const idx = list.indexOf(String(value ?? ''))
  return idx === -1 ? Number.POSITIVE_INFINITY : idx
}

/**
 * Compare two matched rules by output priority (ascending = higher priority).
 * Outputs are ranked in column order; ties fall back to table order for
 * stability. Used by PRIORITY (take best) and OUTPUT ORDER (sort all).
 */
function byPriority(outputsByRule: Record<number, RuleOutput>, outputs: DmnOutput[]) {
  return (a: number, b: number): number => {
    for (const output of outputs) {
      const ra = priorityRank(outputsByRule[a][output.name], output)
      const rb = priorityRank(outputsByRule[b][output.name], output)
      if (ra !== rb) return ra - rb
    }
    return a - b
  }
}

/**
 * PRIORITY / OUTPUT ORDER need an output-value ordering (`<outputValues>`) to
 * rank rules. Without one they silently degrade to table order, which quietly
 * turns PRIORITY into FIRST and OUTPUT ORDER into RULE ORDER — flag it so the
 * user knows the ordering was not applied. Only relevant when >1 rule matched.
 */
function priorityOrderingWarning(
  policy: 'PRIORITY' | 'OUTPUT ORDER',
  model: DecisionModel,
  matchedRuleIndices: number[],
): string | undefined {
  if (matchedRuleIndices.length <= 1) return undefined
  if (model.outputs.some(o => o.priorityValues.length)) return undefined
  return `${policy} hit policy: no output values defined to order by — falling back to rule order`
}

/** Aggregate the matched rules' first output column (COLLECT + SUM/MIN/MAX/COUNT). */
function aggregate(
  fn: Aggregation,
  matched: number[],
  outputsByRule: Record<number, RuleOutput>,
  output: DmnOutput | undefined,
): AggregationResult {
  const name = output?.name ?? 'result'
  if (fn === 'COUNT') return { fn, output: name, value: matched.length }

  const numbers = matched.map(ri => Number(outputsByRule[ri][name])).filter(n => !Number.isNaN(n))

  // SUM of nothing is 0; MIN/MAX of nothing is undefined — report null rather
  // than a fabricated 0 that reads as a real result.
  if (fn === 'SUM') return { fn, output: name, value: numbers.reduce((sum, n) => sum + n, 0) }
  if (!numbers.length) return { fn, output: name, value: null }
  return { fn, output: name, value: fn === 'MIN' ? Math.min(...numbers) : Math.max(...numbers) }
}

/**
 * Apply the model's hit policy to the matched rules.
 *
 * @param matchedRuleIndices rules that matched, in table order
 * @param outputsByRule      evaluated output object per matched rule index
 */
export function applyHitPolicy(
  model: DecisionModel,
  matchedRuleIndices: number[],
  outputsByRule: Record<number, RuleOutput>,
): HitPolicyResult {
  let reportedRuleIndices: number[]
  let aggregation: AggregationResult | undefined
  let violation: string | undefined

  switch (model.hitPolicy) {
    case 'FIRST':
      reportedRuleIndices = matchedRuleIndices.slice(0, 1)
      break

    case 'UNIQUE':
      if (matchedRuleIndices.length > 1) {
        violation = `UNIQUE hit policy violated: ${matchedRuleIndices.length} rules matched (expected at most one)`
      }
      reportedRuleIndices = matchedRuleIndices.slice(0, 1)
      break

    case 'ANY': {
      const distinct = new Set(matchedRuleIndices.map(ri => JSON.stringify(outputsByRule[ri])))
      if (distinct.size > 1) {
        violation = 'ANY hit policy violated: matching rules produced different outputs'
      }
      // Every matching rule fires and they all agree, so all are equally "the
      // result" (highlight all) — but ANY yields a single output value.
      const output = matchedRuleIndices.length ? [outputsByRule[matchedRuleIndices[0]]] : []
      return { reportedRuleIndices: matchedRuleIndices, outputs: output, violation }
    }

    case 'PRIORITY':
      violation = priorityOrderingWarning('PRIORITY', model, matchedRuleIndices)
      reportedRuleIndices = [...matchedRuleIndices].sort(byPriority(outputsByRule, model.outputs)).slice(0, 1)
      break

    case 'OUTPUT ORDER':
      violation = priorityOrderingWarning('OUTPUT ORDER', model, matchedRuleIndices)
      reportedRuleIndices = [...matchedRuleIndices].sort(byPriority(outputsByRule, model.outputs))
      break

    case 'COLLECT':
      if (model.aggregation) {
        aggregation = aggregate(model.aggregation, matchedRuleIndices, outputsByRule, model.outputs[0])
      }
      reportedRuleIndices = matchedRuleIndices
      break

    case 'RULE ORDER':
    default:
      reportedRuleIndices = matchedRuleIndices
  }

  const outputs = aggregation ? [] : reportedRuleIndices.map(ri => outputsByRule[ri])
  return { reportedRuleIndices, outputs, aggregation, violation }
}
