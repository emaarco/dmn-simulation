/**
 * dmn-js DRD (diagram-js) integration: simulate a whole decision requirement
 * graph. Renders an input panel for the DRD's InputData leaves, evaluates the
 * graph on demand, marks the decisions that fired and shows each decision's
 * result as an overlay. The per-decision results are published to the shared
 * `ModelerBridge` so drilling into a decision table reflects the run.
 *
 * Registered as a diagram-js didi module (see `./index.ts`).
 */

import { definitionsToDecisionRequirementsDiagramModel, type ModdleElement } from '../../adapter/fromModdle'
import {
  evaluateDecisionRequirementsDiagram,
  type DecisionRequirementsDiagramModel,
} from '../../domain/decisionRequirementsDiagram'
import type { RawValue } from '../../domain/feel'
import { isNumericType } from '../../domain/model'
import { getModelerBridge, type ModelerBridge } from '../../simulation/ModelerBridge'
import { formatValue } from '../../ui/formatValue'

interface EventBus {
  on(event: string, callback: (...args: unknown[]) => void): void
}
interface Canvas {
  getContainer(): HTMLElement
  addMarker(element: string | object, marker: string): void
  removeMarker(element: string | object, marker: string): void
}
interface Element {
  id: string
  businessObject?: ModdleElement
}
interface ElementRegistry {
  get(id: string): Element | undefined
  filter(fn: (element: Element) => boolean): Element[]
}
interface Overlays {
  add(element: string | object, type: string, overlay: unknown): string
  remove(filter: string | { type?: string }): void
}
interface Injector {
  get<T = unknown>(name: string, strict: false): T | null
}

const FIRED_MARKER = 'dmn-sim-fired'
const OVERLAY_TYPE = 'dmn-sim-decision-requirements-diagram'

export class DecisionRequirementsDiagramSimulation {
  static $inject = ['eventBus', 'canvas', 'elementRegistry', 'overlays', 'injector']

  private readonly canvas: Canvas
  private readonly elementRegistry: ElementRegistry
  private readonly overlays: Overlays
  private readonly bridge: ModelerBridge | null

  private readonly parent: { getDefinitions?: () => ModdleElement } | null
  private model: DecisionRequirementsDiagramModel | null = null
  private markedIds: string[] = []

  private panel?: HTMLElement
  private fieldsHost?: HTMLElement
  private runButton?: HTMLButtonElement
  private readonly inputs = new Map<string, HTMLInputElement | HTMLSelectElement>()

  constructor(
    eventBus: EventBus,
    canvas: Canvas,
    elementRegistry: ElementRegistry,
    overlays: Overlays,
    injector: Injector,
  ) {
    this.canvas = canvas
    this.elementRegistry = elementRegistry
    this.overlays = overlays
    this.parent = injector.get('_parent', false)
    this.bridge = getModelerBridge(this.parent)

    eventBus.on('import.done', () => this.refresh())
  }

  private refresh(): void {
    const definitions = this.parent?.getDefinitions?.()
    this.model = definitions ? definitionsToDecisionRequirementsDiagramModel(definitions) : null
    this.clearResult()
    this.render()
  }

  private render(): void {
    // A lone decision is already fully covered by the decision-table simulation,
    // so the DRD panel would only duplicate it. Only show it for a genuine graph
    // — more than one decision to chain — with leaves to feed.
    const isGraph = !!this.model && this.model.decisions.length > 1 && this.model.inputData.length > 0
    if (!isGraph) {
      this.panel?.remove()
      this.panel = undefined
      this.inputs.clear()
      return
    }

    if (!this.panel) {
      this.panel = createDiv('dmn-sim-decision-requirements-diagram-panel')
      this.canvas.getContainer().appendChild(this.panel)
    }
    this.panel.innerHTML = ''
    this.inputs.clear()

    const title = createDiv('dmn-sim-decision-requirements-diagram-title', 'Simulate DRD')
    this.panel.appendChild(title)

    this.fieldsHost = createDiv('dmn-sim-decision-requirements-diagram-fields')
    for (const input of this.model!.inputData) {
      const field = createDiv('dmn-sim-field')
      const label = document.createElement('span')
      label.className = 'dmn-sim-field-label'
      label.textContent = input.label
      const control = document.createElement('input')
      control.className = 'dmn-sim-input'
      control.type = isNumericType(input.typeRef) ? 'number' : 'text'
      control.placeholder = input.typeRef
      control.addEventListener('input', () => this.syncRunState())
      this.inputs.set(input.id, control)
      field.appendChild(label)
      field.appendChild(control)
      this.fieldsHost.appendChild(field)
    }
    this.panel.appendChild(this.fieldsHost)

    const actions = createDiv('dmn-sim-decision-requirements-diagram-actions')
    this.runButton = document.createElement('button')
    this.runButton.type = 'button'
    this.runButton.className = 'dmn-sim-run'
    this.runButton.textContent = 'Simulate'
    this.runButton.addEventListener('click', () => this.run())
    const resetButton = document.createElement('button')
    resetButton.type = 'button'
    resetButton.className = 'dmn-sim-reset'
    resetButton.textContent = 'Reset'
    resetButton.addEventListener('click', () => this.reset())
    actions.appendChild(this.runButton)
    actions.appendChild(resetButton)
    this.panel.appendChild(actions)

    this.syncRunState()
  }

  private syncRunState(): void {
    if (!this.runButton) return
    const complete = [...this.inputs.values()].every(control => control.value.trim() !== '')
    this.runButton.disabled = !complete
  }

  private collectValues(): Record<string, RawValue> {
    const values: Record<string, RawValue> = {}
    for (const [id, control] of this.inputs) values[id] = control.value
    return values
  }

  private run(): void {
    if (!this.model) return
    const result = evaluateDecisionRequirementsDiagram(this.model, this.collectValues())
    this.clearMarkersAndOverlays()

    for (const decision of this.model.decisions) {
      const evaluation = result.results[decision.id]
      if (!evaluation || evaluation.skipped) continue

      const fired = evaluation.table
        ? evaluation.table.matchedRuleIndices.length > 0
        : evaluation.value !== null && evaluation.value !== undefined
      if (!fired) continue

      const element = this.findDecisionElement(decision.id)
      if (element) {
        this.canvas.addMarker(element, FIRED_MARKER)
        this.markedIds.push(element.id)
        this.overlays.add(element, OVERLAY_TYPE, {
          position: { bottom: -6, left: 0 },
          html: `<div class="dmn-sim-badge">${escapeHtml(formatValue(evaluation.value))}</div>`,
        })
      }
    }

    this.bridge?.setDecisionRequirementsDiagramResult(result)
  }

  private reset(): void {
    for (const control of this.inputs.values()) control.value = ''
    this.clearResult()
    this.syncRunState()
  }

  private clearResult(): void {
    this.clearMarkersAndOverlays()
    this.bridge?.clear()
  }

  private clearMarkersAndOverlays(): void {
    for (const id of this.markedIds) {
      const element = this.elementRegistry.get(id)
      if (element) this.canvas.removeMarker(element, FIRED_MARKER)
    }
    this.markedIds = []
    this.overlays.remove({ type: OVERLAY_TYPE })
  }

  private findDecisionElement(decisionId: string): Element | undefined {
    return (
      this.elementRegistry.get(decisionId) ?? this.elementRegistry.filter(el => el.businessObject?.id === decisionId)[0]
    )
  }
}

function createDiv(className: string, text?: string): HTMLElement {
  const div = document.createElement('div')
  div.className = className
  if (text !== undefined) div.textContent = text
  return div
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => {
    switch (ch) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}
