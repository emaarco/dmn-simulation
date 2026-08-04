import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'

import { readHashXml } from './share'
import { BLANK_DMN, importAndOpen, modeler, openDecisionTable, saveXml, trackActiveView } from './editor'
import { initHashAutosave, syncHash } from './persistence'
import './style.css'

const status = document.querySelector<HTMLElement>('#status')!
const picker = document.querySelector<HTMLSelectElement>('#file-picker')!
const canvas = document.querySelector<HTMLElement>('#canvas')!
const btnMenu = document.querySelector<HTMLButtonElement>('#btn-menu')!
const menu = document.querySelector<HTMLElement>('#menu-dropdown')!
const btnNew = document.querySelector<HTMLButtonElement>('#btn-new')!
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

function setStatus(state: 'loading' | 'ready' | 'error', text = state): void {
  status.textContent = state === 'loading' ? 'loading…' : text
  status.dataset.state = state
}

trackActiveView(canvas)
initHashAutosave()

// Expose for E2E / debugging.
Object.assign(window as object, { __modeler: modeler, __openDecisionTable: openDecisionTable })

/** Load DMN XML into the editor and mirror it into the URL hash. */
async function applyXml(xml: string): Promise<void> {
  setStatus('loading')
  try {
    await importAndOpen(xml)
    setStatus('ready')
    void syncHash(xml)
  } catch (err) {
    setStatus('error', `error: ${err instanceof Error ? err.message : String(err)}`)
    console.error(err)
  }
}

/** Fetch one of the bundled example models and simulate it. */
async function loadExample(path: string): Promise<void> {
  setStatus('loading')
  try {
    const url = new URL(path.replace(/^\//, ''), new URL(import.meta.env.BASE_URL, location.href)).href
    const xml = await fetch(url).then(r => {
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`)
      return r.text()
    })
    await applyXml(xml)
  } catch (err) {
    setStatus('error', `error: ${err instanceof Error ? err.message : String(err)}`)
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

// ---- New (start modelling from a blank diagram) -----------------------

btnNew.addEventListener('click', () => {
  setMenuOpen(false)
  picker.selectedIndex = -1
  void applyXml(BLANK_DMN)
})

// ---- Import (file dialog + drag & drop) -------------------------------

btnOpen.addEventListener('click', () => fileInput.click())

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

// ---- Share (the hash already mirrors the model — copy the current URL) ----

btnShare.addEventListener('click', async () => {
  setMenuOpen(false)
  try {
    const { xml } = await saveXml()
    await syncHash(xml)
    await navigator.clipboard.writeText(location.href)
    showToast('Link in die Zwischenablage kopiert')
  } catch (err) {
    console.error(err)
    showToast('Teilen fehlgeschlagen')
  }
})

// Initial load: a model in the URL hash (a shared link or your own reload) wins,
// otherwise the first example. IIFE since the es2020 build target has no top-level await.
void (async () => {
  const sharedXml = await readHashXml()
  if (sharedXml) {
    await applyXml(sharedXml)
  } else {
    await loadExample(picker.value)
  }
})()
