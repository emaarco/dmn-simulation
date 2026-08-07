/**
 * Pick the HTML `<input type>` best suited to a DMN typeRef, so the form offers
 * a native picker where the browser has one. The value each native control emits
 * (an ISO string) is exactly what `coerceValue` parses via the FEEL temporal
 * constructors, so nothing downstream has to change.
 */
import { isNumericType } from '../domain/model'

/** DMN temporal typeRefs → the native input that produces their ISO literal. */
const TEMPORAL_INPUT_TYPES: Record<string, string> = {
  date: 'date',
  datetime: 'datetime-local',
  'date and time': 'datetime-local',
  time: 'time',
  // Durations have no native picker — the user types an ISO 8601 duration.
}

export function htmlInputType(typeRef: string): string {
  if (isNumericType(typeRef)) return 'number'
  return TEMPORAL_INPUT_TYPES[(typeRef || '').toLowerCase()] ?? 'text'
}
