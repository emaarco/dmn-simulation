/**
 * Reload survival: keep the URL hash in sync with the model so an (accidental)
 * reload reopens the user's work instead of resetting. Reuses the shareable-link
 * encoding (see share.ts) — the same `#dmn=` hash powers both.
 */

import { buildShareUrl } from './share'
import { modeler, saveXml } from './editor'

/** Mirror the given model into the URL hash so a reload reopens exactly it. */
export async function syncHash(xml: string): Promise<void> {
  try {
    const url = await buildShareUrl(xml)
    history.replaceState(null, '', url.slice(url.indexOf('#')))
  } catch (err) {
    console.error(err)
  }
}

let hashSyncTimer: number | undefined

function scheduleHashSync(): void {
  window.clearTimeout(hashSyncTimer)
  hashSyncTimer = window.setTimeout(() => {
    hashSyncTimer = undefined
    void persist()
  }, 400)
}

async function persist(): Promise<void> {
  try {
    const { xml } = await saveXml()
    await syncHash(xml)
  } catch (err) {
    console.error(err)
  }
}

/** Start mirroring edits (debounced) into the URL hash. */
export function initHashAutosave(): void {
  // Each view has its own command stack, so subscribe once per viewer.
  const listenedViewers = new WeakSet<{ on(event: string, callback: () => void): void }>()
  modeler.on('views.changed', () => {
    const viewer = (
      modeler as unknown as { getActiveViewer?(): { on(event: string, callback: () => void): void } | undefined }
    ).getActiveViewer?.()
    if (viewer && !listenedViewers.has(viewer)) {
      listenedViewers.add(viewer)
      viewer.on('commandStack.changed', scheduleHashSync)
    }
  })

  // Flush a pending edit before the tab is hidden, so a quick reload keeps it.
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && hashSyncTimer !== undefined) {
      window.clearTimeout(hashSyncTimer)
      hashSyncTimer = undefined
      void persist()
    }
  })
}
