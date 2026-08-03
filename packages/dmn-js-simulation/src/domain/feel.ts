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

/** Coerce a raw form value into the JS type its DMN typeRef implies. */
export function coerceValue(raw: RawValue, typeRef: string): unknown {
  if (raw === undefined || raw === null || raw === '') return undefined
  if (isNumericType(typeRef)) {
    const n = Number(raw)
    return Number.isNaN(n) ? undefined : n
  }
  if ((typeRef || '').toLowerCase() === 'boolean') {
    return raw === true || raw === 'true'
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
