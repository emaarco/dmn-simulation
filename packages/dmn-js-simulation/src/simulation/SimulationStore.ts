/**
 * Framework-free simulation state for a single decision table: the current model,
 * the input values the user has entered, and the last evaluation result. It is a
 * tiny observable — the UI subscribes to re-render, and the dmn-js integration
 * subscribes to drive row highlighting. It knows nothing about dmn-js or the DOM.
 */

import type { RawValue } from './../domain/feel'
import type { DecisionModel } from './../domain/model'
import { evaluateDecision, type EvaluationResult } from './../domain/evaluateDecision'

export interface SimulationSnapshot {
  model: DecisionModel | null
  values: RawValue[]
  result: EvaluationResult | null
}

export type SimulationListener = (snapshot: SimulationSnapshot) => void

export class SimulationStore {
  private model: DecisionModel | null = null
  private values: RawValue[] = []
  private result: EvaluationResult | null = null
  /** Whether `result` came from a local `run()` vs a reflected DRD run (`hydrate`). */
  private resultIsLocal = false
  private readonly listeners = new Set<SimulationListener>()

  getModel(): DecisionModel | null {
    return this.model
  }

  getValues(): RawValue[] {
    return this.values
  }

  getResult(): EvaluationResult | null {
    return this.result
  }

  /** True when the current result is the user's own run (not a reflected DRD run). */
  isLocalRun(): boolean {
    return this.resultIsLocal
  }

  /** Adopt a new decision table, clearing inputs and the previous result. */
  setModel(model: DecisionModel | null): void {
    this.model = model
    this.values = model ? model.inputs.map(() => '') : []
    this.result = null
    this.resultIsLocal = false
    this.emit()
  }

  /**
   * Adopt a rebuilt model after the table was edited, carrying over the values
   * the user already entered for inputs that still exist (matched by id). The
   * previous result is dropped: the rules/outputs may have changed, so a re-run
   * is required. Use this (rather than `setModel`) when the model is refreshed
   * from a live edit so the form is not wiped on every change.
   */
  refreshModel(model: DecisionModel): void {
    const previous = this.model
    const previousValues = this.values
    this.model = model
    this.values = model.inputs.map(input => {
      const prevIndex = previous ? previous.inputs.findIndex(p => p.id === input.id) : -1
      return prevIndex >= 0 ? (previousValues[prevIndex] ?? '') : ''
    })
    this.result = null
    this.resultIsLocal = false
    this.emit()
  }

  /**
   * Reflect a result computed elsewhere (a DRD run) for the decision the user
   * drilled into: seed the inputs that produced it and the result, without a
   * local run. Ignored on an input-arity mismatch.
   */
  hydrate(values: RawValue[], result: EvaluationResult): void {
    if (!this.model || values.length !== this.model.inputs.length) return
    this.values = [...values]
    this.result = result
    this.resultIsLocal = false
    this.emit()
  }

  /**
   * Drop a reflected (hydrated) DRD result when that run is cleared/reset, so a
   * drilled-in table stops showing the stale outcome. No-op on a local run (the
   * user's own run always wins) or when there is no result to clear. The entered
   * (reflected) input values are kept so the user can re-run from here.
   */
  clearHydrated(): void {
    if (this.resultIsLocal || this.result === null) return
    this.result = null
    this.emit()
  }

  /** Set one input value; any change invalidates the previous run. */
  setValue(index: number, value: RawValue): void {
    if (index < 0 || index >= this.values.length) return
    this.values = this.values.map((v, i) => (i === index ? value : v))
    this.result = null
    this.resultIsLocal = false
    this.emit()
  }

  /** Only runnable once every input has a concrete value. */
  isComplete(): boolean {
    return (
      !!this.model &&
      this.model.inputs.length > 0 &&
      this.values.length === this.model.inputs.length &&
      this.values.every(v => v !== '' && v !== null && v !== undefined)
    )
  }

  /** Evaluate the table against the current inputs and store the result. */
  run(): EvaluationResult | null {
    if (!this.model || !this.isComplete()) return null
    this.result = evaluateDecision(this.model, this.values)
    this.resultIsLocal = true
    this.emit()
    return this.result
  }

  /** Clear inputs and result (keeps the model). */
  reset(): void {
    this.values = this.model ? this.model.inputs.map(() => '') : []
    this.result = null
    this.resultIsLocal = false
    this.emit()
  }

  subscribe(listener: SimulationListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(): void {
    const snapshot: SimulationSnapshot = { model: this.model, values: this.values, result: this.result }
    // Snapshot the listeners: a listener may (un)subscribe during notification.
    for (const listener of [...this.listeners]) listener(snapshot)
  }
}
