/**
 * Small parsing helpers shared by the DMN adapters (XML and moddle).
 */

import { evaluateExpression } from '../domain/feel'
import { isNumericType } from '../domain/model'

/** Split a FEEL `outputValues` list (`"a","b","c"`) into ordered bare values. */
export function parseOutputValueList(text: string | undefined | null): string[] {
  if (!text) return []
  return text
    .split(',')
    .map(part => part.trim().replace(/^"(.*)"$/, '$1'))
    .filter(part => part.length > 0)
}

/**
 * Collect the distinct string literals used in an input column across all rules,
 * so the simulation form can offer a dropdown instead of a free-text field.
 *
 * @param inputEntryTexts the raw FEEL text of this column's cell, per rule
 */
export function collectColumnOptions(inputEntryTexts: string[]): string[] {
  const options: string[] = []
  for (const cell of inputEntryTexts) {
    const match = /^"(.*)"$/.exec((cell ?? '').trim())
    if (match && !options.includes(match[1])) options.push(match[1])
  }
  return options
}

/** A rule-cell endpoint value with a numeric key for ordering (ms for dates). */
interface Endpoint {
  key: number
  value: unknown
}

/** A comparable sort key: numbers as-is, temporals as epoch millis. */
function comparableKey(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const toMillis = (value as { toMillis?: unknown }).toMillis
  if (typeof toMillis === 'function') return (value as { toMillis: () => number }).toMillis()
  return null
}

/** Format a bound back into the value the native input expects. */
function formatBound(value: unknown, numeric: boolean): string | null {
  if (numeric) return typeof value === 'number' ? String(value) : null
  const toISODate = (value as { toISODate?: unknown }).toISODate
  return typeof toISODate === 'function' ? ((value as { toISODate: () => string }).toISODate() ?? null) : null
}

/**
 * Derive a `min` / `max` hint for an input's native control from the FEEL text
 * of its column's rule cells. Supported for numeric and `date` columns only.
 *
 * A bound is emitted for a side **only when that side is closed**: if any rule
 * opens the column with a `<` / `<=` (or `>` / `>=`, or a wildcard `-`) test,
 * values beyond the extreme literal still match, so constraining the picker
 * there would wrongly exclude valid inputs — that side is left unbounded.
 */
export function collectColumnBounds(inputEntryTexts: string[], typeRef: string): { min?: string; max?: string } {
  const numeric = isNumericType(typeRef)
  const dateLike = (typeRef || '').toLowerCase() === 'date'
  if (!numeric && !dateLike) return {}

  const lowers: Endpoint[] = []
  const uppers: Endpoint[] = []
  let openLow = false
  let openHigh = false

  const point = (expr: string): Endpoint | null => {
    const value = evaluateExpression(expr.trim(), {})
    const key = comparableKey(value)
    return key === null ? null : { key, value }
  }

  for (const raw of inputEntryTexts) {
    const cell = (raw ?? '').trim()
    if (cell === '' || cell === '-') return {} // wildcard rule → any value matches

    const range = /^[[(]\s*(.+?)\s*\.\.\s*(.+?)\s*[\])]$/.exec(cell)
    if (range) {
      const lo = point(range[1])
      const hi = point(range[2])
      if (!lo || !hi) return {}
      lowers.push(lo)
      uppers.push(hi)
      continue
    }

    const comparison = /^(<=|>=|<|>)\s*(.+)$/.exec(cell)
    if (comparison) {
      const p = point(comparison[2])
      if (!p) return {}
      if (comparison[1][0] === '<') {
        openLow = true
        uppers.push(p)
      } else {
        openHigh = true
        lowers.push(p)
      }
      continue
    }

    // Equality, or a comma list of concrete values (no commas inside number/date
    // literals, so a plain split is safe here).
    for (const part of cell.split(',')) {
      const p = point(part)
      if (!p) return {}
      lowers.push(p)
      uppers.push(p)
    }
  }

  const out: { min?: string; max?: string } = {}
  if (!openLow && lowers.length) {
    const min = lowers.reduce((a, b) => (b.key < a.key ? b : a))
    const formatted = formatBound(min.value, numeric)
    if (formatted != null) out.min = formatted
  }
  if (!openHigh && uppers.length) {
    const max = uppers.reduce((a, b) => (b.key > a.key ? b : a))
    const formatted = formatBound(max.value, numeric)
    if (formatted != null) out.max = formatted
  }
  return out
}
