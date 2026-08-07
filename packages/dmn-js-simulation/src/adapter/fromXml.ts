/**
 * Parse a DMN decision table from raw XML into the domain `DecisionModel`.
 *
 * This is the fallback adapter for consumers who have DMN XML but no live
 * dmn-js instance (and it powers the end-to-end unit tests). Inside a dmn-js
 * modeler, prefer `fromModdle.ts`, which reads the already-parsed businessObject
 * and needs no DOM. Only the parts a single decision table needs are extracted;
 * FEEL is never interpreted here (see `domain/evaluateDecision.ts`).
 */

import type { DecisionModel, DmnInput, DmnOutput, DmnRule, HitPolicy } from '../domain/model'
import { collectColumnBounds, collectColumnOptions, parseOutputValueList } from './util'

/** Namespace-agnostic lookup — DMN files use a default (prefix-less) namespace. */
function byLocalName(scope: Element | Document, localName: string): Element[] {
  return Array.from(scope.getElementsByTagNameNS('*', localName))
}

function firstByLocalName(scope: Element | Document, localName: string): Element | null {
  return byLocalName(scope, localName)[0] ?? null
}

/** Text of the nested `<text>` element (used by input/output entries). */
function entryText(entry: Element | undefined): string {
  if (!entry) return ''
  const text = firstByLocalName(entry, 'text')
  return (text?.textContent ?? '').trim()
}

/**
 * Parse the first decision table (or the one matching `decisionId`) from a DMN
 * XML string.
 *
 * @throws if the XML is malformed or contains no decision table.
 */
export function parseDecisionModelFromXml(xml: string, decisionId?: string): DecisionModel {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (firstByLocalName(doc, 'parsererror')) {
    throw new Error('DMN XML could not be parsed')
  }

  const decisions = byLocalName(doc, 'decision')
  const decision = decisionId
    ? decisions.find(d => d.getAttribute('id') === decisionId)
    : decisions.find(d => firstByLocalName(d, 'decisionTable'))
  if (!decision) {
    throw new Error(
      decisionId ? `No decision with id "${decisionId}" found` : 'No decision with a decision table found',
    )
  }

  const table = firstByLocalName(decision, 'decisionTable')
  if (!table) {
    throw new Error('Selected decision has no decision table')
  }

  const hitPolicy = (table.getAttribute('hitPolicy') || 'UNIQUE').toUpperCase() as HitPolicy
  const aggregationAttr = (table.getAttribute('aggregation') || '').toUpperCase()
  const aggregation = (['SUM', 'MIN', 'MAX', 'COUNT'] as const).find(a => a === aggregationAttr)

  // Only the columns that belong to *this* table (skip nested inputData vars).
  const inputEls = byLocalName(table, 'input')
  const outputEls = byLocalName(table, 'output')
  const ruleEls = byLocalName(table, 'rule')

  const rules: DmnRule[] = ruleEls.map((rule, ri) => ({
    id: rule.getAttribute('id') || `rule_${ri}`,
    inputEntries: byLocalName(rule, 'inputEntry').map(entryText),
    outputEntries: byLocalName(rule, 'outputEntry').map(entryText),
  }))

  const inputs: DmnInput[] = inputEls.map((input, ci) => {
    const expressionEl = firstByLocalName(input, 'inputExpression')
    const expression = entryText(expressionEl ?? undefined)
    const label = input.getAttribute('label') || expression || `Input ${ci + 1}`
    const typeRef = expressionEl?.getAttribute('typeRef') || 'string'

    const columnCells = rules.map(r => r.inputEntries[ci] ?? '')
    const options = collectColumnOptions(columnCells)
    const { min, max } = collectColumnBounds(columnCells, typeRef)

    return { id: input.getAttribute('id') || `input_${ci}`, label, expression, typeRef, options, min, max }
  })

  const outputs: DmnOutput[] = outputEls.map((output, ci) => {
    const label = output.getAttribute('label') || ''
    const name = output.getAttribute('name') || label || `Output ${ci + 1}`
    const priorityValues = parseOutputValueList(entryText(firstByLocalName(output, 'outputValues') ?? undefined))
    return {
      id: output.getAttribute('id') || `output_${ci}`,
      name,
      label: label || name,
      typeRef: output.getAttribute('typeRef') || 'string',
      priorityValues,
    }
  })

  return {
    decisionId: decision.getAttribute('id') || '',
    decisionName: decision.getAttribute('name') || '',
    hitPolicy,
    aggregation,
    inputs,
    outputs,
    rules,
  }
}
