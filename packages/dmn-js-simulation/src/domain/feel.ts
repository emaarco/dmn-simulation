/**
 * Thin adapter around the `feelin` FEEL engine — the single place that imports
 * `feelin`. Isolates value coercion and the two FEEL operations a decision table
 * needs (unary tests for input cells, expressions for output cells) so the rest
 * of the code never touches the engine directly.
 */

import { unaryTest, evaluate } from 'feelin'
import { isNumericType } from './model'

/** A raw form value before it is coerced to its DMN type. */
export type RawValue = string | number | boolean | null | undefined

/**
 * FEEL temporal typeRefs → the FEEL constructor that parses their literal form.
 * Covers the DMN built-in temporal types (and their lower-cased spellings).
 */
const TEMPORAL_CONSTRUCTORS: Record<string, string> = {
  date: 'date',
  time: 'time',
  datetime: 'date and time',
  'date and time': 'date and time',
  duration: 'duration',
  daytimeduration: 'duration',
  yearmonthduration: 'duration',
}

/** Coerce a raw form value into the JS type its DMN typeRef implies. */
export function coerceValue(raw: RawValue, typeRef: string): unknown {
  if (raw === undefined || raw === null) return undefined
  // Treat a blank / whitespace-only string as "missing" (Number('  ') is 0).
  if (typeof raw === 'string' && raw.trim() === '') return undefined

  if (isNumericType(typeRef)) {
    const n = Number(raw)
    return Number.isNaN(n) ? undefined : n
  }
  if ((typeRef || '').toLowerCase() === 'boolean') {
    return raw === true || raw === 'true'
  }
  const constructor = TEMPORAL_CONSTRUCTORS[(typeRef || '').toLowerCase()]
  if (constructor) {
    // Parse the raw literal into a real FEEL temporal via its constructor so
    // temporal unary tests (e.g. `< date("2020-01-01")`) compare like-typed
    // values; `?` is then bound to the parsed temporal, not the raw string.
    const parsed = evaluateExpression(`${constructor}(value)`, { value: String(raw) })
    return parsed ?? undefined
  }
  return String(raw)
}

/**
 * Evaluate a FEEL unary test against a value (bound to `?`).
 * Returns false on any parse/evaluation error rather than throwing.
 */
export function evaluateUnaryTest(text: string, value: unknown): boolean {
  try {
    return unaryTest(text, { '?': value }).value === true
  } catch {
    return false
  }
}

/**
 * Evaluate a FEEL expression against a context.
 * Returns null on any parse/evaluation error rather than throwing.
 */
export function evaluateExpression(text: string, context: Record<string, unknown>): unknown {
  try {
    return evaluate(text, context).value
  } catch {
    return null
  }
}
