/**
 * dmn-js modules for decision simulation.
 *
 * The default export groups the per-view modules so they can be registered under
 * the matching dmn-js keys:
 *
 *   import DmnSimulationModule from '@emaarco/dmn-js-simulation'
 *   new DmnModeler({
 *     decisionTable: { additionalModules: [ DmnSimulationModule.decisionTable ] },
 *     drd:           { additionalModules: [ DmnSimulationModule.decisionRequirementsDiagram ] },
 *   })
 *
 * The individual modules are also exported for consumers who only need one view.
 */
import DmnSimulationTableModule from './table'
import DmnSimulationDecisionRequirementsDiagramModule from './decisionRequirementsDiagram'

const DmnSimulationModule = {
  decisionTable: DmnSimulationTableModule,
  decisionRequirementsDiagram: DmnSimulationDecisionRequirementsDiagramModule,
}

export default DmnSimulationModule
export { default as DmnSimulationTableModule } from './table'
export { default as DmnSimulationDecisionRequirementsDiagramModule } from './decisionRequirementsDiagram'
