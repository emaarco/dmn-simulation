/**
 * A tiny composer for ISO 8601 durations, shared by the two simulation surfaces.
 * DMN durations have no native picker, so the form offers a number field plus a
 * unit dropdown and composes the ISO literal that `coerceValue` parses via the
 * FEEL `duration(...)` constructor.
 *
 * Only single-unit durations are represented (the common case); a value the
 * widget can't express (e.g. `P1Y2M`) simply shows blank and can still be typed
 * elsewhere.
 */

export type DurationUnit = 'Y' | 'M' | 'D' | 'H' | 'Min'

export interface DurationOption {
  value: DurationUnit
  label: string
}

/** The offered units, in the dropdown order. `Min` disambiguates from months. */
export const DURATION_UNITS: DurationOption[] = [
  { value: 'Y', label: 'Years' },
  { value: 'M', label: 'Months' },
  { value: 'D', label: 'Days' },
  { value: 'H', label: 'Hours' },
  { value: 'Min', label: 'Minutes' },
]

export const DEFAULT_DURATION_UNIT: DurationUnit = 'D'

/** Whether a DMN typeRef is one of the duration types. */
export function isDurationType(typeRef: string): boolean {
  const t = (typeRef || '').toLowerCase()
  return t === 'duration' || t === 'daytimeduration' || t === 'yearmonthduration'
}

/** Compose an ISO 8601 duration from an amount + unit; blank amount → `''`. */
export function composeDuration(amount: string, unit: DurationUnit): string {
  const n = (amount ?? '').trim()
  if (n === '') return ''
  switch (unit) {
    case 'Y':
      return `P${n}Y`
    case 'M':
      return `P${n}M`
    case 'D':
      return `P${n}D`
    case 'H':
      return `PT${n}H`
    case 'Min':
      return `PT${n}M`
  }
}

/** Parse a single-unit ISO duration back into amount + unit, or null. */
export function parseDuration(value: string): { amount: string; unit: DurationUnit } | null {
  const patterns: Array<[RegExp, DurationUnit]> = [
    [/^P(\d+(?:\.\d+)?)Y$/, 'Y'],
    [/^P(\d+(?:\.\d+)?)M$/, 'M'],
    [/^P(\d+(?:\.\d+)?)D$/, 'D'],
    [/^PT(\d+(?:\.\d+)?)H$/, 'H'],
    [/^PT(\d+(?:\.\d+)?)M$/, 'Min'],
  ]
  for (const [re, unit] of patterns) {
    const m = re.exec((value ?? '').trim())
    if (m) return { amount: m[1], unit }
  }
  return null
}
