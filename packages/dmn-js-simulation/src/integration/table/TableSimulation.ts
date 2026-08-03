/**
 * dmn-js decision-table integration: wires the simulation UI and row
 * highlighting into a `table-js` viewer/editor.
 *
 * Responsibilities:
 *  - contribute the `SimulationFormComponent` to the `table.before` slot so the
 *    form appears above the table (idiomatic, re-render-safe insertion);
 *  - build a `DecisionModel` from the live `dmn:DecisionTable` businessObject and
 *    push it into the shared `SimulationStore`;
 *  - subscribe to the store and reflect the evaluation result by toggling CSS
 *    classes on the rule rows in the rendered table.
 *
 * Registered as a `table-js` didi module (see `./index.ts`).
 */

import { decisionTableToModel, type ModdleElement } from '../../adapter/fromModdle'
import type { DecisionModel } from '../../domain/model'
import type { EvaluationResult } from '../../domain/evaluateDecision'
import type { SimulationStore } from '../../simulation/SimulationStore'
import { getModelerBridge, type ModelerBridge } from '../../simulation/ModelerBridge'
import { SimulationFormComponent } from '../../ui/SimulationForm'

interface EventBus {
  on(event: string, callback: (...args: unknown[]) => void): void
}
interface Sheet {
  getRoot(): { businessObject?: ModdleElement } | null | undefined
}
interface Renderer {
  getContainer(): HTMLElement
}
interface Components {
  onGetComponent(type: string, callback: (context: unknown) => unknown): void
}
interface Injector {
  get<T = unknown>(name: string, strict: false): T | null
}

export class TableSimulation {
  static $inject = ['eventBus', 'sheet', 'renderer', 'components', 'simulationStore', 'injector']

  private readonly sheet: Sheet
  private readonly renderer: Renderer
  private readonly store: SimulationStore
  private readonly bridge: ModelerBridge | null

  constructor(
    eventBus: EventBus,
    sheet: Sheet,
    renderer: Renderer,
    components: Components,
    store: SimulationStore,
    injector: Injector,
  ) {
    this.sheet = sheet
    this.renderer = renderer
    this.store = store
    this.bridge = getModelerBridge(injector.get('_parent', false))

    components.onGetComponent('table.before', () => SimulationFormComponent)

    // Build (or refresh) the model once the table has rendered, and whenever its
    // structure changes. Re-apply the highlight a frame later: a table-js
    // re-render creates fresh <tr> nodes and drops our direct-DOM classes, so the
    // highlight (local run, or a reflected DRD run) must be restored afterwards.
    eventBus.on('import.render.complete', () => this.onRender())
    eventBus.on('elements.changed', () => this.onRender())

    // Reflect every store change (run / reset / input edit) in the table rows.
    this.store.subscribe(() => this.highlight())
    // Reflect a DRD run when the user drills into this decision table.
    this.bridge?.subscribe(() => this.onBridgeChange())
  }

  private onRender(): void {
    this.refreshModel()
    this.reflectDecisionRequirementsDiagramRun()
    this.scheduleHighlight()
  }

  private onBridgeChange(): void {
    this.reflectDecisionRequirementsDiagramRun()
    this.scheduleHighlight()
  }

  /**
   * When the user drills into a decision after a DRD run, seed this table's form
   * with the inputs and result that decision produced — so the outcome (result
   * bar + highlighted rows) is visible, not just an unexplained highlight. A
   * local run the user made here always wins and is never overwritten.
   */
  private reflectDecisionRequirementsDiagramRun(): void {
    if (this.store.isLocalRun() || !this.bridge) return
    const model = this.store.getModel()
    if (!model) return

    const reflection = this.bridge.getTableReflection(model.decisionId)
    // Same reflection already shown (stable object until the next DRD run) — skip
    // to avoid redundant re-renders on unrelated `elements.changed` events.
    if (!reflection || this.store.getResult() === reflection.result) return

    this.store.hydrate(reflection.inputs, reflection.result)
  }

  /** Re-apply the highlight after the DOM has committed the current render. */
  private scheduleHighlight(): void {
    const raf =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0)
    raf(() => this.highlight())
  }

  private refreshModel(): void {
    const businessObject = this.sheet.getRoot()?.businessObject
    if (!businessObject || businessObject.$type !== 'dmn:DecisionTable') {
      this.store.setModel(null)
      return
    }

    const next = decisionTableToModel(businessObject)
    const current = this.store.getModel()
    // Nothing actually changed (e.g. a selection or unrelated event): keep the
    // current model, values and any result/highlight untouched.
    if (current && sameModel(current, next)) return

    // The table changed. On first load adopt it outright; on a live edit adopt
    // the rebuilt model but preserve the user's entered inputs (matched by id) so
    // a re-run reflects the new rules/outputs/hit-policy without wiping the form.
    if (!current) this.store.setModel(next)
    else this.store.refreshModel(next)
  }

  private highlight(): void {
    const container = this.renderer.getContainer()
    if (!container) return

    const result = this.effectiveResult()
    const reported = new Set(result?.reportedRuleIndices ?? [])
    const matched = new Set(result?.matchedRuleIndices ?? [])

    ruleRows(container).forEach((row, index) => {
      row.classList.toggle('dmn-sim-match', reported.has(index))
      row.classList.toggle('dmn-sim-candidate', matched.has(index) && !reported.has(index))
    })
  }

  /**
   * The result to highlight: the local run wins; otherwise, if the user drilled
   * in from a DRD simulation, reflect this decision's result from that run.
   */
  private effectiveResult(): EvaluationResult | null {
    const local = this.store.getResult()
    if (local) return local
    const decisionId = this.store.getModel()?.decisionId

    if (!decisionId || !this.bridge) return null
    return this.bridge.getTableResult(decisionId)
  }
}

/** The rendered rule rows, in table (and model) order. */
function ruleRows(container: HTMLElement): HTMLElement[] {
  // Every rule cell carries `data-row-id`; the "add rule" row (editor) does not,
  // so keying off it selects exactly the real rule rows, in document order.
  const rows: HTMLElement[] = []
  const seen = new Set<HTMLElement>()
  container.querySelectorAll('[data-row-id]').forEach(cell => {
    const row = (cell as HTMLElement).closest('tr') as HTMLElement | null
    if (row && !seen.has(row)) {
      seen.add(row)
      rows.push(row)
    }
  })
  if (rows.length) return rows
  // Fallback if the index column is absent: every body row is a rule row.
  return Array.from(container.querySelectorAll('tbody tr')) as HTMLElement[]
}

/**
 * Whether two rebuilt models are identical. Models are plain, deterministically
 * built data, so a structural compare is enough to tell a real edit (rules,
 * outputs, hit policy, inputs) from a no-op refresh.
 */
function sameModel(a: DecisionModel, b: DecisionModel): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}
