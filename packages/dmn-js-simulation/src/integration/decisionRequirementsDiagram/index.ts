/**
 * The diagram-js didi module for DRD (whole-graph) simulation. Register it under
 * the dmn-js Modeler/Viewer `drd` key:
 *
 *   new DmnModeler({
 *     drd: { additionalModules: [ DmnSimulationDecisionRequirementsDiagramModule ] }
 *   })
 */
import { DecisionRequirementsDiagramSimulation } from './DecisionRequirementsDiagramSimulation'

const DmnSimulationDecisionRequirementsDiagramModule = {
  __init__: ['dmnSimulationDecisionRequirementsDiagram'],
  dmnSimulationDecisionRequirementsDiagram: ['type', DecisionRequirementsDiagramSimulation],
}

export default DmnSimulationDecisionRequirementsDiagramModule
