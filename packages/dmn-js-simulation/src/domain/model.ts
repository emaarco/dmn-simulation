/**
 * The plain, framework-free model a single DMN decision table is simulated
 * against. It carries only what evaluation needs — inputs, outputs, rules (as
 * raw FEEL text) and the hit policy. FEEL is never interpreted here (see
 * `feel.ts`); the model is never read from dmn-js or XML here (see `adapter/`).
 */

export type HitPolicy = 'UNIQUE' | 'FIRST' | 'ANY' | 'PRIORITY' | 'COLLECT' | 'RULE ORDER' | 'OUTPUT ORDER'

export interface DmnInput {
  id: string
  /** Human label shown in the form (falls back to the input expression). */
  label: string
  /** The FEEL input expression, i.e. the variable name (e.g. `Season`). */
  expression: string
  /** DMN typeRef of the input (`string`, `integer`, `boolean`, …). */
  typeRef: string
  /** Distinct string literals used in this column — drives a dropdown. */
  options: string[]
}

export interface DmnOutput {
  id: string
  /** Key used in the result object — output name, else label, else fallback. */
  name: string
  label: string
  typeRef: string
  /**
   * Allowed output values in priority order (highest first), from
   * `<outputValues>`. Drives PRIORITY and OUTPUT ORDER; empty when unset.
   */
  priorityValues: string[]
}

/** COLLECT aggregator (`aggregation` attribute); undefined = plain list. */
export type Aggregation = 'SUM' | 'MIN' | 'MAX' | 'COUNT'

export interface DmnRule {
  id: string
  /** Raw FEEL unary-test text per input column (aligned to `inputs`). */
  inputEntries: string[]
  /** Raw FEEL expression text per output column (aligned to `outputs`). */
  outputEntries: string[]
}

export interface DecisionModel {
  decisionId: string
  decisionName: string
  hitPolicy: HitPolicy
  /** COLLECT aggregator, if any (`SUM`/`MIN`/`MAX`/`COUNT`). */
  aggregation?: Aggregation
  inputs: DmnInput[]
  outputs: DmnOutput[]
  rules: DmnRule[]
}

const NUMERIC_TYPES = new Set(['integer', 'long', 'int', 'number', 'double', 'decimal', 'float'])

/** Whether a DMN typeRef should be edited as a number field. */
export function isNumericType(typeRef: string): boolean {
  return NUMERIC_TYPES.has((typeRef || '').toLowerCase())
}
