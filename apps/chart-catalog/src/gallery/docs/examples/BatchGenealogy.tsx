import { BatchGenealogy, type BatchGenealogyData } from '../../../index'
import '../../../charts.css'

// A simulated recoat and assembly lineage.
const data: BatchGenealogyData = {
  lots: [
    { id: 'HG-12-R1', label: 'Housing HG-12' },
    { id: 'CO-12', label: 'Powder coating' },
    { id: 'HG-12-R2', label: 'Housing HG-12', status: 'held', detail: 'Coating inspection hold.' },
    { id: 'INS-04', label: 'Threaded insert kits' },
    { id: 'ASM-26', label: 'Assembled enclosures' },
    { id: 'ASM-27', label: 'Assembled enclosures' },
  ],
  steps: [
    {
      id: 'recoat',
      label: 'Recoat housings',
      timestamp: '2026-10-14T08:10:00Z',
      inputs: [
        { lotId: 'HG-12-R1', quantity: 64, unit: 'pcs' },
        { lotId: 'CO-12', quantity: 0.64, unit: 'kg' },
      ],
      outputs: [{ lotId: 'HG-12-R2', quantity: 64, unit: 'pcs' }],
    },
    {
      id: 'assemble',
      label: 'Assemble enclosures',
      timestamp: '2026-10-14T10:05:00Z',
      inputs: [
        { lotId: 'HG-12-R2', quantity: 64, unit: 'pcs' },
        { lotId: 'INS-04', quantity: 64, unit: 'pcs' },
      ],
      outputs: [
        { lotId: 'ASM-26', quantity: 32, unit: 'pcs' },
        { lotId: 'ASM-27', quantity: 32, unit: 'pcs' },
      ],
    },
  ],
}

export function ExampleBatchGenealogy() {
  return <BatchGenealogy data={data} initialLot="HG-12-R2" label="Simulated enclosure lot genealogy" />
}
