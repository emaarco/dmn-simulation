/**
 * Small parsing helpers shared by the DMN adapters (XML and moddle).
 */

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
