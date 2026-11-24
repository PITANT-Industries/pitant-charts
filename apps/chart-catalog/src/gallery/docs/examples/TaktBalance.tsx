import { TaktBalance, type TaktBalanceData } from '../../../index'
import '../../../charts.css'

const data: TaktBalanceData = {
  availableSeconds: 2520,
  demand: 60,
  stations: [
    { id: 'prep', label: 'Preparation' },
    { id: 'assembly', label: 'Assembly' },
    { id: 'test', label: 'Verification' },
  ],
  tasks: [
    { id: 'base', label: 'Locate base plate', shortLabel: 'Locate', seconds: 12, stationId: 'prep' },
    {
      id: 'drill', label: 'Drill mounting holes', shortLabel: 'Drill', seconds: 16, stationId: 'prep',
      predecessors: ['base'], allowedStations: ['prep'],
    },
    {
      id: 'deburr', label: 'Deburr holes', shortLabel: 'Deburr', seconds: 17, stationId: 'prep',
      predecessors: ['drill'],
    },
    {
      id: 'insert', label: 'Seat threaded inserts', shortLabel: 'Insert', seconds: 13, stationId: 'assembly',
      predecessors: ['deburr'],
    },
    {
      id: 'fasten', label: 'Fasten the cover', shortLabel: 'Fasten', seconds: 12, stationId: 'assembly',
      predecessors: ['insert'],
    },
    {
      id: 'inspect', label: 'Check fit', shortLabel: 'Check', seconds: 14, stationId: 'test',
      predecessors: ['fasten'], allowedStations: ['test'],
    },
    {
      id: 'label', label: 'Apply inspection label', shortLabel: 'Label', seconds: 7, stationId: 'test',
      predecessors: ['inspect'],
    },
  ],
}

export function ExampleTaktBalance() {
  return (
    <TaktBalance
      data={data}
      title="Synthetic enclosure assembly"
      initialTask="deburr"
      caption="Illustrative task times and assumptions. Move Deburr holes to Assembly to change the station loads from 45, 25, and 21 seconds to 28, 42, and 21 seconds. Verification is unavailable because seating the inserts follows deburring."
    />
  )
}
