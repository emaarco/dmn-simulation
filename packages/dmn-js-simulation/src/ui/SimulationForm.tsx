/**
 * The simulation UI rendered above a dmn-js decision table: an input form (one
 * control per table input), Simulate / Reset actions, and a result bar showing
 * the hit-policy outcome. It is an Inferno component so dmn-js renders it into
 * its own component tree via the `table.before` slot.
 *
 * The component is a thin view over `SimulationStore`: it reads the model /
 * values / result and calls back into the store. Row highlighting is a separate
 * concern handled by the integration layer, which also subscribes to the store.
 */
import { createElement } from 'inferno-create-element'
import { Component } from 'inferno'
import type { EvaluationResult } from '../domain/evaluateDecision'
import type { SimulationStore } from '../simulation/SimulationStore'
import { formatValue } from './formatValue'
import { htmlInputType } from './inputType'
import {
  composeDuration,
  DEFAULT_DURATION_UNIT,
  DURATION_UNITS,
  isDurationType,
  parseDuration,
  type DurationUnit,
} from './duration'
import type { DmnInput } from '../domain/model'

/** The result line — output pills, aggregation, violation and reported rules. */
function ResultBar({ result }: { result: EvaluationResult }): any {
  const miss = result.matchedRuleIndices.length === 0
  const className =
    'dmn-sim-result' + (miss ? ' dmn-sim-result--miss' : '') + (result.violation ? ' dmn-sim-result--warn' : '')

  const outputs = result.aggregation
    ? createElement(
        'span',
        { className: 'dmn-sim-output' },
        `${result.aggregation.fn}(${result.aggregation.output}) = `,
        createElement('strong', null, formatValue(result.aggregation.value)),
      )
    : result.outputs.length
      ? result.outputs.map((output, oi) =>
          createElement(
            'span',
            { className: 'dmn-sim-output', key: oi },
            Object.keys(output).map(key =>
              createElement('span', { key }, `${key} = `, createElement('strong', null, formatValue(output[key]))),
            ),
          ),
        )
      : createElement('span', { className: 'dmn-sim-none' }, 'no matching rule')

  return createElement(
    'div',
    { className },
    createElement('span', { className: 'dmn-sim-arrow' }, '→'),
    outputs,
    result.violation ? createElement('span', { className: 'dmn-sim-violation' }, `⚠ ${result.violation}`) : null,
    result.reportedRuleIndices.length
      ? createElement(
          'span',
          { className: 'dmn-sim-rule' },
          `${result.reportedRuleIndices.length > 1 ? 'Rules' : 'Rule'} ${result.reportedRuleIndices
            .map(i => i + 1)
            .join(', ')}`,
        )
      : null,
  )
}

/** The rule-derived options, plus a reflected value that isn't among them. */
function selectOptions(options: string[], value: unknown): string[] {
  const v = value == null ? '' : String(value)
  return v !== '' && !options.includes(v) ? [v, ...options] : options
}

export class SimulationFormComponent extends Component<Record<string, never>, { tick: number }> {
  private readonly store: SimulationStore
  private unsubscribe?: () => void
  /** Remembered duration unit per input index (survives a blank amount). */
  private readonly durationUnits = new Map<number, DurationUnit>()

  constructor(props: Record<string, never>, context: any) {
    super(props, context)
    this.store = context.injector.get('simulationStore')
    this.state = { tick: 0 }
  }

  override componentWillMount(): void {
    this.unsubscribe = this.store.subscribe(() => this.setState({ tick: this.state!.tick + 1 }))
  }

  override componentWillUnmount(): void {
    this.unsubscribe?.()
  }

  private readonly onChange = (index: number) => (event: Event) => {
    this.store.setValue(index, (event.target as HTMLInputElement | HTMLSelectElement).value)
  }

  private durationUnit(index: number): DurationUnit {
    return (
      this.durationUnits.get(index) ??
      parseDuration(String(this.store.getValues()[index] ?? ''))?.unit ??
      DEFAULT_DURATION_UNIT
    )
  }

  private readonly onDurationAmount = (index: number) => (event: Event) => {
    const unit = this.durationUnit(index)
    this.durationUnits.set(index, unit)
    this.store.setValue(index, composeDuration((event.target as HTMLInputElement).value, unit))
  }

  private readonly onDurationUnit = (index: number) => (event: Event) => {
    const unit = (event.target as HTMLSelectElement).value as DurationUnit
    this.durationUnits.set(index, unit)
    const amount = parseDuration(String(this.store.getValues()[index] ?? ''))?.amount ?? ''
    this.store.setValue(index, composeDuration(amount, unit))
  }

  /** The input control for one column: dropdown, duration composer or field. */
  private renderControl(input: DmnInput, i: number, value: unknown): any {
    if (input.options.length) {
      return createElement(
        'select',
        { className: 'dmn-sim-input', value: value ?? '', onChange: this.onChange(i) },
        createElement('option', { value: '' }, '–'),
        // Include a reflected value that isn't one of the rule literals
        // (e.g. an upstream decision's output) so the select can show it.
        selectOptions(input.options, value).map(option =>
          createElement('option', { value: option, key: option }, option),
        ),
      )
    }
    if (isDurationType(input.typeRef)) {
      const parsed = parseDuration(String(value ?? ''))
      const amount = parsed?.amount ?? ''
      const unit = parsed?.unit ?? this.durationUnit(i)
      return createElement(
        'span',
        { className: 'dmn-sim-duration' },
        createElement('input', {
          className: 'dmn-sim-input dmn-sim-duration-amount',
          type: 'number',
          min: '0',
          placeholder: 'amount',
          value: amount,
          onInput: this.onDurationAmount(i),
        }),
        createElement(
          'select',
          { className: 'dmn-sim-input dmn-sim-duration-unit', value: unit, onChange: this.onDurationUnit(i) },
          DURATION_UNITS.map(u => createElement('option', { value: u.value, key: u.value }, u.label)),
        ),
      )
    }
    return createElement('input', {
      className: 'dmn-sim-input',
      type: htmlInputType(input.typeRef),
      placeholder: input.typeRef,
      // Native min/max guidance, only present for fully-bounded columns.
      min: input.min,
      max: input.max,
      value: value ?? '',
      onInput: this.onChange(i),
    })
  }

  private readonly onSubmit = (event: Event) => {
    event.preventDefault()
    this.store.run()
  }

  private readonly onRun = () => this.store.run()

  private readonly onReset = () => this.store.reset()

  override render(): any {
    const model = this.store.getModel()
    if (!model) return null

    const values = this.store.getValues()
    const result = this.store.getResult()
    const complete = this.store.isComplete()

    return createElement(
      'div',
      { className: 'dmn-sim' },
      createElement(
        'form',
        { className: 'dmn-sim-inputs', onSubmit: this.onSubmit },
        model.inputs.map((input, i) =>
          createElement(
            'label',
            { className: 'dmn-sim-field', key: input.id },
            createElement('span', { className: 'dmn-sim-field-label' }, input.label),
            this.renderControl(input, i, values[i]),
          ),
        ),
        createElement(
          'button',
          {
            // A plain button, not a submit: native min/max guidance must never
            // block running the simulation (e.g. an out-of-range value → a miss).
            type: 'button',
            className: 'dmn-sim-run',
            disabled: !complete,
            title: complete ? 'Run the simulation' : 'Fill in every input first',
            onClick: this.onRun,
          },
          'Simulate',
        ),
        createElement('button', { type: 'button', className: 'dmn-sim-reset', onClick: this.onReset }, 'Reset'),
      ),
      result ? createElement(ResultBar, { result }) : null,
    )
  }
}
