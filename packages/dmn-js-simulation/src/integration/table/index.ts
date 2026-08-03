/**
 * The `table-js` didi module for decision-table simulation. Register it under the
 * dmn-js Modeler/Viewer `decisionTable` key:
 *
 *   new DmnModeler({
 *     decisionTable: { additionalModules: [ DmnSimulationTableModule ] }
 *   })
 */
import { SimulationStore } from '../../simulation/SimulationStore'
import { TableSimulation } from './TableSimulation'

const DmnSimulationTableModule = {
  __init__: ['dmnSimulationTable'],
  simulationStore: ['type', SimulationStore],
  dmnSimulationTable: ['type', TableSimulation],
}

export default DmnSimulationTableModule
