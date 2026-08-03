/**
 * Public entry point for `@emaarco/dmn-js-simulation`: the framework-free
 * evaluation core, the DMN adapters, the simulation store, and the dmn-js
 * integration modules.
 */

// Domain — pure evaluation core
export {
  evaluateDecision,
  type EvaluationResult,
  type RawValue,
  type AggregationResult,
} from './domain/evaluateDecision'
export { applyHitPolicy, type HitPolicyResult, type RuleOutput } from './domain/hitPolicy'
export { coerceValue, evaluateUnaryTest, evaluateExpression } from './domain/feel'
export {
  isNumericType,
  type DecisionModel,
  type DmnInput,
  type DmnOutput,
  type DmnRule,
  type HitPolicy,
  type Aggregation,
} from './domain/model'

// Adapter — build a DecisionModel from raw DMN XML (no dmn-js instance needed)
export { parseDecisionModelFromXml } from './adapter/fromXml'
// Domain — whole-graph (DRD) evaluation
export {
  evaluateDecisionRequirementsDiagram,
  type DecisionRequirementsDiagramModel,
  type DecisionRequirementsDiagramDecision,
  type DecisionRequirementsDiagramInputData,
  type DecisionLogic,
  type DecisionEvaluation,
  type DecisionRequirementsDiagramEvaluationResult,
} from './domain/decisionRequirementsDiagram'

// Adapter — build models from a live dmn-js / dmn-moddle businessObject
export {
  decisionTableToModel,
  definitionsToDecisionRequirementsDiagramModel,
  type ModdleElement,
} from './adapter/fromModdle'

// Simulation store — framework-free run/result state (shared across views)
export { SimulationStore, type SimulationSnapshot, type SimulationListener } from './simulation/SimulationStore'
export { getModelerBridge, ModelerBridge } from './simulation/ModelerBridge'

// dmn-js integration modules — register via `additionalModules`
export { default, DmnSimulationTableModule, DmnSimulationDecisionRequirementsDiagramModule } from './integration'
