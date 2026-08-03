/**
 * Cross-view bridge for a single dmn-js Modeler/Viewer.
 *
 * The DRD view and the decision-table view are separate viewer instances with
 * separate injectors; the only thing they share is the parent Manager (dmn-js
 * injects it as `_parent`). This bridge hangs off that shared parent so a DRD
 * simulation run can be reflected when the user drills into a decision table:
 * the per-decision table results are published here, keyed by decision id.
 *
 * It is framework-free (depends only on `domain/`) and lives one-per-parent via
 * a WeakMap, so it is garbage-collected with the modeler.
 */

import type { RawValue } from './../domain/feel'
import type { EvaluationResult } from './../domain/evaluateDecision'
import type { DecisionRequirementsDiagramEvaluationResult } from './../domain/decisionRequirementsDiagram'

export type BridgeListener = () => void

/** A decision's outcome from a DRD run: its result plus the inputs that produced it. */
export interface TableReflection {
  result: EvaluationResult
  inputs: RawValue[]
}

export class ModelerBridge {
  private tableResults = new Map<string, TableReflection>()
  private readonly listeners = new Set<BridgeListener>()

  /** Publish a DRD run: keep the per-decision table results for reflection. */
  setDecisionRequirementsDiagramResult(result: DecisionRequirementsDiagramEvaluationResult): void {
    this.tableResults = new Map()
    for (const [decisionId, evaluation] of Object.entries(result.results)) {
      if (evaluation.table) {
        this.tableResults.set(decisionId, { result: evaluation.table, inputs: evaluation.inputs ?? [] })
      }
    }
    this.emit()
  }

  /** The table result for a decision from the last DRD run, if any. */
  getTableResult(decisionId: string): EvaluationResult | null {
    return this.tableResults.get(decisionId)?.result ?? null
  }

  /** The full reflection (result + inputs) for a decision from the last DRD run. */
  getTableReflection(decisionId: string): TableReflection | null {
    return this.tableResults.get(decisionId) ?? null
  }

  clear(): void {
    if (this.tableResults.size === 0) return
    this.tableResults = new Map()
    this.emit()
  }

  subscribe(listener: BridgeListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

const registry = new WeakMap<object, ModelerBridge>()

/** Get (or lazily create) the bridge for a dmn-js parent Manager. */
export function getModelerBridge(parent: unknown): ModelerBridge | null {
  if (!parent || typeof parent !== 'object') return null
  let bridge = registry.get(parent)
  if (!bridge) {
    bridge = new ModelerBridge()
    registry.set(parent, bridge)
  }
  return bridge
}
