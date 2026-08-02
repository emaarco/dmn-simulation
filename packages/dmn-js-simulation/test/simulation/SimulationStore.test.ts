import { describe, it, expect, vi } from 'vitest'
import { SimulationStore } from '../../src/simulation/SimulationStore'
import type { DecisionModel } from '../../src/domain/model'

/** A tiny FIRST table: Season -> Dish, one string input, one output. */
function model(): DecisionModel {
  return {
    decisionId: 'd',
    decisionName: 'Dish',
    hitPolicy: 'FIRST',
    inputs: [{ id: 'i', label: 'Season', expression: 'Season', typeRef: 'string', options: ['Fall', 'Winter'] }],
    outputs: [{ id: 'o', name: 'Dish', label: 'Dish', typeRef: 'string', priorityValues: [] }],
    rules: [
      { id: 'r1', inputEntries: ['"Fall"'], outputEntries: ['"Spareribs"'] },
      { id: 'r2', inputEntries: ['"Winter"'], outputEntries: ['"Roastbeef"'] },
    ],
  }
}

describe('SimulationStore', () => {
  it('initialises empty values from the model and is not complete', () => {
    const store = new SimulationStore()
    store.setModel(model())
    expect(store.getValues()).toEqual([''])
    expect(store.isComplete()).toBe(false)
    expect(store.getResult()).toBeNull()
  })

  it('becomes complete once every input has a value and evaluates on run', () => {
    const store = new SimulationStore()
    store.setModel(model())
    store.setValue(0, 'Winter')
    expect(store.isComplete()).toBe(true)
    const result = store.run()
    expect(result?.outputs).toEqual([{ Dish: 'Roastbeef' }])
    expect(store.getResult()?.reportedRuleIndices).toEqual([1])
  })

  it('hydrate reflects a DRD run (values + result) without marking it a local run', () => {
    const store = new SimulationStore()
    store.setModel(model())
    const reflected = { matchedRuleIndices: [1], reportedRuleIndices: [1], outputs: [{ Dish: 'Roastbeef' }] }
    store.hydrate(['Winter'], reflected)

    expect(store.getValues()).toEqual(['Winter'])
    expect(store.getResult()).toBe(reflected)
    expect(store.isLocalRun()).toBe(false)
  })

  it('run marks the result as local; setModel/reset clear that flag', () => {
    const store = new SimulationStore()
    store.setModel(model())
    store.setValue(0, 'Winter')
    store.run()
    expect(store.isLocalRun()).toBe(true)
    store.reset()
    expect(store.isLocalRun()).toBe(false)
  })

  it('hydrate ignores an input-arity mismatch', () => {
    const store = new SimulationStore()
    store.setModel(model())
    store.hydrate(['Winter', 'extra'], { matchedRuleIndices: [], reportedRuleIndices: [], outputs: [] })
    expect(store.getResult()).toBeNull()
    expect(store.getValues()).toEqual([''])
  })

  it('invalidates the previous result when an input changes', () => {
    const store = new SimulationStore()
    store.setModel(model())
    store.setValue(0, 'Fall')
    store.run()
    expect(store.getResult()).not.toBeNull()
    store.setValue(0, 'Winter')
    expect(store.getResult()).toBeNull()
  })

  it('reset clears values and result but keeps the model', () => {
    const store = new SimulationStore()
    store.setModel(model())
    store.setValue(0, 'Fall')
    store.run()
    store.reset()
    expect(store.getValues()).toEqual([''])
    expect(store.getResult()).toBeNull()
    expect(store.getModel()).not.toBeNull()
  })

  it('does not run when incomplete', () => {
    const store = new SimulationStore()
    store.setModel(model())
    expect(store.run()).toBeNull()
  })

  it('notifies subscribers on every change and stops after unsubscribe', () => {
    const store = new SimulationStore()
    const listener = vi.fn()
    const off = store.subscribe(listener)
    store.setModel(model()) // 1
    store.setValue(0, 'Fall') // 2
    store.run() // 3
    expect(listener).toHaveBeenCalledTimes(3)
    off()
    store.reset()
    expect(listener).toHaveBeenCalledTimes(3)
  })

  it('refreshModel preserves entered values by input id and drops the stale result', () => {
    const store = new SimulationStore()
    store.setModel(model())
    store.setValue(0, 'Winter')
    store.run()
    expect(store.getResult()).not.toBeNull()

    // Same input (id 'i') but an edited rule output — a re-run should reflect it.
    const edited = model()
    edited.rules[1].outputEntries = ['"Stew"']
    store.refreshModel(edited)

    expect(store.getValues()).toEqual(['Winter']) // value carried over
    expect(store.getResult()).toBeNull() // stale result cleared
    expect(store.run()?.outputs).toEqual([{ Dish: 'Stew' }])
  })

  it('refreshModel resets values for inputs that no longer exist', () => {
    const store = new SimulationStore()
    store.setModel(model())
    store.setValue(0, 'Winter')

    // The input column id changed, so the old value cannot be carried over.
    const renamed = model()
    renamed.inputs[0].id = 'other'
    store.refreshModel(renamed)

    expect(store.getValues()).toEqual([''])
  })

  it('ignores setValue for an out-of-range index', () => {
    const store = new SimulationStore()
    store.setModel(model())
    store.setValue(5, 'x')
    expect(store.getValues()).toEqual([''])
  })
})
