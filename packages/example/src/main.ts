import DmnModeler from 'dmn-js/lib/Modeler'

import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import 'dmn-js/dist/assets/diagram-js.css'
import 'dmn-js/dist/assets/dmn-js-shared.css'
import 'dmn-js/dist/assets/dmn-js-drd.css'
import 'dmn-js/dist/assets/dmn-js-decision-table.css'
import 'dmn-js/dist/assets/dmn-js-decision-table-controls.css'
import 'dmn-js/dist/assets/dmn-js-literal-expression.css'
import 'dmn-js/dist/assets/dmn-font/css/dmn-embedded.css'

import DmnSimulationModule from '@emaarco/dmn-js-simulation'
import '@emaarco/dmn-js-simulation/assets/dmn-js-simulation.css'

import { buildShareUrl, readHashXml } from './share'
import './style.css'

const status = document.querySelector<HTMLElement>('#status')!
const picker = document.querySelector<HTMLSelectElement>('#file-picker')!
const canvas = document.querySelector<HTMLElement>('#canvas')!
const btnMenu = document.querySelector<HTMLButtonElement>('#btn-menu')!
const menu = document.querySelector<HTMLElement>('#menu-dropdown')!
const btnOpen = document.querySelector<HTMLButtonElement>('#btn-open')!
const btnShare = document.querySelector<HTMLButtonElement>('#btn-share')!
const btnReset = document.querySelector<HTMLButtonElement>('#btn-reset')!
const fileInput = document.querySelector<HTMLInputElement>('#file-input')!
const toast = document.querySelector<HTMLElement>('#toast')!

let toastTimer: number | undefined
function showToast(message: string): void {
  toast.textContent = message
  toast.hidden = false
  window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => (toast.hidden = true), 2200)
}

interface View {
  type: string
  element: { id: string }
}

const modeler = new DmnModeler({
  container: '#canvas',
  decisionTable: { additionalModules: [DmnSimulationModule.decisionTable] },
  drd: { additionalModules: [DmnSimulationModule.decisionRequirementsDiagram] },
})

// Reflect the active view type on the canvas so CSS can pad the decision table
// while the DRD stays full-bleed. `views.changed` fires for every switch —
// including dmn-js's own "View DRD" button and drill-down — so it never goes stale.
modeler.on('views.changed', (event: { activeView?: View }) => {
  canvas.dataset.view = event.activeView?.type ?? ''
  // Center the DRD whenever it becomes active — it otherwise renders at its
  // DMNDI coordinates (top-left).
  if (event.activeView?.type === 'drd') centerActiveDiagram()
})

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

/** Open a decision-table view by decision id (used by the drill-in E2E). */
function openDecisionTable(decisionId: string): void {
  const view = (modeler.getViews() as View[]).find(v => v.type === 'decisionTable' && v.element.id === decisionId)
  if (view) void modeler.open(view as never)
}

// Expose for E2E / debugging.
Object.assign(window as object, { __modeler: modeler, __openDecisionTable: openDecisionTable })

/** Import DMN XML and open the DRD view by default (the table is a drill-in). */
async function applyXml(xml: string): Promise<void> {
  status.textContent = 'loading…'
  status.dataset.state = 'loading'
  try {
    await modeler.importXML(xml)

    const views = modeler.getViews() as View[]
    const decisionRequirementsDiagramView = views.find(v => v.type === 'drd')
    const firstTableView = views.find(v => v.type === 'decisionTable')

    if (decisionRequirementsDiagramView) {
      await modeler.open(decisionRequirementsDiagramView as never)
    } else if (firstTableView) {
      await modeler.open(firstTableView as never)
    }

    status.textContent = 'ready'
    status.dataset.state = 'ready'
  } catch (err) {
    status.textContent = `error: ${err instanceof Error ? err.message : String(err)}`
    status.dataset.state = 'error'
    console.error(err)
  }
}

/** Fetch one of the bundled example models and simulate it. */
async function loadExample(path: string): Promise<void> {
  status.textContent = 'loading…'
  status.dataset.state = 'loading'
  try {
    const url = new URL(path.replace(/^\//, ''), new URL(import.meta.env.BASE_URL, location.href)).href
    const xml = await fetch(url).then(r => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
      return r.text()
    })
    await applyXml(xml)
  } catch (err) {
    status.textContent = `error: ${err instanceof Error ? err.message : String(err)}`
    status.dataset.state = 'error'
    console.error(err)
  }
}

// ---- Menu -------------------------------------------------------------

function setMenuOpen(open: boolean): void {
  menu.hidden = !open
  btnMenu.setAttribute('aria-expanded', String(open))
}

btnMenu.addEventListener('click', () => setMenuOpen(menu.hidden))

document.addEventListener('click', event => {
  const target = event.target as Node
  if (!menu.hidden && !menu.contains(target) && !btnMenu.contains(target)) {
    setMenuOpen(false)
  }
})
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') setMenuOpen(false)
})

picker.addEventListener('change', () => {
  setMenuOpen(false)
  void loadExample(picker.value)
})

btnReset.addEventListener('click', () => {
  picker.selectedIndex = 0
  setMenuOpen(false)
  void loadExample(picker.value)
})

// ---- Import (file dialog + drag & drop) -------------------------------

btnOpen.addEventListener('click', () => fileInput.click())

// ---- Share (encode the current model into the URL hash) ---------------

btnShare.addEventListener('click', async () => {
  setMenuOpen(false)
  try {
    const { xml } = await (modeler as unknown as { saveXML(o: { format: boolean }): Promise<{ xml: string }> }).saveXML(
      {
        format: true,
      },
    )
    const url = await buildShareUrl(xml)
    history.replaceState(null, '', url.slice(url.indexOf('#')))
    await navigator.clipboard.writeText(url)
    showToast('Link in die Zwischenablage kopiert')
  } catch (err) {
    console.error(err)
    showToast('Teilen fehlgeschlagen')
  }
})

fileInput.addEventListener('change', () => {
  const file = fileInput.files?.[0]
  setMenuOpen(false)
  if (file) void file.text().then(applyXml)
  // Allow re-selecting the same file later.
  fileInput.value = ''
})

canvas.addEventListener('dragover', event => {
  event.preventDefault()
  canvas.classList.add('is-dragover')
})
canvas.addEventListener('dragleave', () => canvas.classList.remove('is-dragover'))
canvas.addEventListener('drop', event => {
  event.preventDefault()
  canvas.classList.remove('is-dragover')
  const file = event.dataTransfer?.files?.[0]
  if (file) void file.text().then(applyXml)
})

// Initial load: a model shared via the URL hash wins; otherwise the first
// example (Recommend Bike). Wrapped in an IIFE rather than a top-level await,
// which the Vite/esbuild build target (es2020) does not support.
void (async () => {
  const sharedXml = await readHashXml()
  if (sharedXml) {
    await applyXml(sharedXml)
  } else {
    await loadExample(picker.value)
  }
})()
