import DmnModeler from 'dmn-js/lib/Modeler'

import 'dmn-js/dist/assets/diagram-js.css'
import 'dmn-js/dist/assets/dmn-js-shared.css'
import 'dmn-js/dist/assets/dmn-js-drd.css'
import 'dmn-js/dist/assets/dmn-js-decision-table.css'
import 'dmn-js/dist/assets/dmn-js-decision-table-controls.css'
import 'dmn-js/dist/assets/dmn-js-literal-expression.css'
import 'dmn-js/dist/assets/dmn-font/css/dmn-embedded.css'

import DmnSimulationModule from '@emaarco/dmn-js-simulation'
import '@emaarco/dmn-js-simulation/assets/dmn-js-simulation.css'

interface View {
  type: string
  element: { id: string }
}

/**
 * A minimal, empty DMN diagram: one decision holding a bare decision table with
 * a single input, output and rule — the smallest model you can meaningfully edit
 * from. Loading it lets the user model a diagram from scratch. The DMNDI shape
 * makes the decision appear in the DRD view, so the palette is usable straight
 * away.
 */
export const BLANK_DMN = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/" xmlns:dmndi="https://www.omg.org/spec/DMN/20191111/DMNDI/" xmlns:dc="http://www.omg.org/spec/DMN/20180521/DC/" id="Definitions_new" name="Neues Diagramm" namespace="http://camunda.org/schema/1.0/dmn">
  <decision id="Decision_1" name="Neue Entscheidung">
    <decisionTable id="DecisionTable_1">
      <input id="Input_1" label="Eingabe">
        <inputExpression id="InputExpression_1" typeRef="string">
          <text></text>
        </inputExpression>
      </input>
      <output id="Output_1" label="Ausgabe" name="ausgabe" typeRef="string" />
      <rule id="Rule_1">
        <inputEntry id="InputEntry_1"><text></text></inputEntry>
        <outputEntry id="OutputEntry_1"><text></text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
  <dmndi:DMNDI>
    <dmndi:DMNDiagram>
      <dmndi:DMNShape dmnElementRef="Decision_1">
        <dc:Bounds height="80" width="180" x="160" y="100" />
      </dmndi:DMNShape>
    </dmndi:DMNDiagram>
  </dmndi:DMNDI>
</definitions>`

export const modeler = new DmnModeler({
  container: '#canvas',
  decisionTable: { additionalModules: [DmnSimulationModule.decisionTable] },
  drd: { additionalModules: [DmnSimulationModule.decisionRequirementsDiagram] },
})

/** Serialize the current model as formatted DMN XML. */
export function saveXml(): Promise<{ xml: string }> {
  return (modeler as unknown as { saveXML(o: { format: boolean }): Promise<{ xml: string }> }).saveXML({ format: true })
}

/** Import DMN XML and open the DRD view by default (the table is a drill-in). */
export async function importAndOpen(xml: string): Promise<void> {
  await modeler.importXML(xml)
  const views = modeler.getViews() as View[]
  const drd = views.find(v => v.type === 'drd')
  const table = views.find(v => v.type === 'decisionTable')
  if (drd) await modeler.open(drd as never)
  else if (table) await modeler.open(table as never)
}

/** Open a decision-table view by decision id (used by the drill-in E2E). */
export function openDecisionTable(decisionId: string): void {
  const view = (modeler.getViews() as View[]).find(v => v.type === 'decisionTable' && v.element.id === decisionId)
  if (view) void modeler.open(view as never)
}

/**
 * Reflect the active view type on the canvas so CSS can pad the decision table
 * while the DRD stays full-bleed, and keep the DRD centered. `views.changed`
 * fires for every switch — including dmn-js's own "View DRD" button and
 * drill-down — so it never goes stale.
 */
export function trackActiveView(canvas: HTMLElement): void {
  modeler.on('views.changed', (event: { activeView?: View }) => {
    canvas.dataset.view = event.activeView?.type ?? ''
    if (event.activeView?.type === 'drd') centerActiveDiagram()
  })
}

/**
 * Center the active DRD diagram in the viewport. dmn-js renders it at its DMNDI
 * coordinates (top-left); we fit it to the viewport but never zoom a small
 * diagram past 100 % — so it sits centered at a natural size.
 */
function centerActiveDiagram(): void {
  const raf =
    typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0)
  raf(() => {
    const viewer = (
      modeler as unknown as { getActiveViewer?(): { get(name: string): unknown } | undefined }
    ).getActiveViewer?.()
    const canvas = viewer?.get('canvas') as { zoom(scale?: string | number, center?: string): number } | undefined
    if (!canvas) return
    canvas.zoom('fit-viewport', 'auto')
    if (canvas.zoom() > 1) canvas.zoom(1)
  })
}
