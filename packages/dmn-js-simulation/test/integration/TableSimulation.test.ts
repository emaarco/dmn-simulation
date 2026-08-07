// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { TableSimulation } from '../../src/integration/table/TableSimulation'
import { getModelerBridge } from '../../src/simulation/ModelerBridge'
import { SimulationStore } from '../../src/simulation/SimulationStore'
import type { DecisionModel } from '../../src/domain/model'

/** Minimal single-input model whose decisionId matches the reflected result. */
function model(): DecisionModel {
  return {
    decisionId: 'd',
    decisionName: 'Dish',
    hitPolicy: 'FIRST',
    inputs: [{ id: 'i', label: 'Season', expression: 'Season', typeRef: 'string', options: [] }],
    outputs: [{ id: 'o', name: 'Dish', label: 'Dish', typeRef: 'string', priorityValues: [] }],
    rules: [{ id: 'r1', inputEntries: ['"Winter"'], outputEntries: ['"Roastbeef"'] }],
  }
}

/** A tiny recording event bus mirroring the on/off/fire surface we use. */
function fakeEventBus() {
  const handlers = new Map<string, Set<(...a: unknown[]) => void>>()
  return {
    on(event: string, cb: (...a: unknown[]) => void) {
      const set = handlers.get(event) ?? new Set()
      set.add(cb)
      handlers.set(event, set)
    },
    off(event: string, cb: (...a: unknown[]) => void) {
      handlers.get(event)?.delete(cb)
    },
    fire(event: string, ...args: unknown[]) {
      for (const cb of [...(handlers.get(event) ?? [])]) cb(...args)
    },
  }
}

function makeTable(parent: object, store: SimulationStore) {
  const eventBus = fakeEventBus()
  const injector = { get: <T>(name: string) => (name === '_parent' ? (parent as unknown as T) : null) }
  const renderer = { getContainer: () => document.createElement('div') }
  const sheet = { getRoot: () => ({ businessObject: undefined }) }
  const components = { onGetComponent: () => undefined }
  const table = new TableSimulation(
    eventBus as never,
    sheet as never,
    renderer as never,
    components as never,
    store,
    injector as never,
  )
  return { table, eventBus }
}

const drdResult = {
  order: ['d'],
  results: {
    d: {
      decisionId: 'd',
      value: 'Roastbeef',
      inputs: ['Winter'],
      table: { matchedRuleIndices: [1], reportedRuleIndices: [1], outputs: [{ Dish: 'Roastbeef' }] },
    },
  },
}

describe('TableSimulation lifecycle', () => {
  it('unsubscribes from the shared bridge on destroy (no listener leak)', () => {
    const parent = {} // one Manager → one shared bridge
    const bridge = getModelerBridge(parent)!

    const deadStore = new SimulationStore()
    deadStore.setModel(model())
    const { eventBus: deadBus } = makeTable(parent, deadStore)

    const liveStore = new SimulationStore()
    liveStore.setModel(model())
    makeTable(parent, liveStore)

    // Tear down the first table; the second stays alive.
    deadBus.fire('diagram.destroy')

    // A DRD run reflects to every *live* listener only.
    bridge.setDecisionRequirementsDiagramResult(drdResult as never)

    expect(deadStore.getResult()).toBeNull() // destroyed → listener removed
    expect(liveStore.getResult()).not.toBeNull() // alive → still reflected
  })

  it('clears a reflected result when the bridge is cleared', () => {
    const parent = {}
    const bridge = getModelerBridge(parent)!
    const store = new SimulationStore()
    store.setModel(model())
    makeTable(parent, store)

    bridge.setDecisionRequirementsDiagramResult(drdResult as never)
    expect(store.getResult()).not.toBeNull()

    bridge.clear()
    expect(store.getResult()).toBeNull() // sticky-result bug fixed
  })
})
