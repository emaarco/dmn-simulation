/** Render a FEEL/JS value for display in the result bar. Never throws. */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '–'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '–'
  if (typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  if (value instanceof Date) return value.toISOString()
  // Luxon temporals (FEEL date/time/duration) expose toISO() — prefer it over
  // the quoted JSON form.
  const iso = (value as { toISO?: unknown }).toISO
  if (typeof iso === 'function') return (value as { toISO: () => string | null }).toISO() ?? '–'
  try {
    // Functions/symbols make JSON.stringify return undefined; circular refs throw.
    const json = JSON.stringify(value)
    return typeof json === 'string' ? json : '–'
  } catch {
    return '–'
  }
}
