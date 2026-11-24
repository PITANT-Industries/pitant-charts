import type { BatchGenealogyData } from './model'

export const enclosureGenealogySource = {
  label: 'GS1 EPCIS and CBV Implementation Guideline 2.0, §5.5',
  href: 'https://ref.gs1.org/guidelines/epcis-cbv/2.0.0/',
  description: 'Simulated enclosure production with a coating inspection hold. The fixture uses explicit transformation inputs and outputs.',
}

export const enclosureGenealogyData: BatchGenealogyData = {
  lots: [
    { id: 'AL-17', label: 'Aluminum blanks' },
    { id: 'HG-12-R1', label: 'Housing HG-12', detail: 'Original milled housing lot.' },
    { id: 'HG-13', label: 'Housing HG-13' },
    { id: 'CO-12', label: 'Powder coating' },
    {
      id: 'HG-12-R2',
      label: 'Housing HG-12',
      status: 'held',
      detail: 'Coating thickness outside the inspection limit at 14:10 UTC, after assembly and packing.',
    },
    { id: 'INS-04', label: 'Threaded insert kits' },
    { id: 'ASM-26', label: 'Assembled enclosures' },
    { id: 'ASM-27', label: 'Assembled enclosures' },
    { id: 'SE-09', label: 'Seal kits' },
    { id: 'PK-31', label: 'Packed enclosures' },
    { id: 'ASM-90', label: 'Separately assembled enclosures', status: 'released' },
  ],
  steps: [
    {
      id: 'mill',
      shortLabel: 'Mill',
      label: 'Mill housings',
      timestamp: '2026-10-14T06:45:00Z',
      location: 'CNC cell 2',
      inputs: [{ lotId: 'AL-17', quantity: 96, unit: 'pcs' }],
      outputs: [
        { lotId: 'HG-12-R1', quantity: 64, unit: 'pcs' },
        { lotId: 'HG-13', quantity: 32, unit: 'pcs' },
      ],
    },
    {
      id: 'recoat',
      shortLabel: 'Recoat',
      label: 'Recoat housings',
      timestamp: '2026-10-14T08:10:00Z',
      location: 'Coating booth 1',
      inputs: [
        { lotId: 'HG-12-R1', quantity: 64, unit: 'pcs' },
        { lotId: 'CO-12', quantity: 0.64, unit: 'kg' },
      ],
      outputs: [{ lotId: 'HG-12-R2', quantity: 64, unit: 'pcs' }],
    },
    {
      id: 'assemble',
      shortLabel: 'Assemble',
      label: 'Assemble enclosures',
      timestamp: '2026-10-14T10:05:00Z',
      location: 'Assembly cell 1',
      inputs: [
        { lotId: 'HG-12-R2', quantity: 64, unit: 'pcs' },
        { lotId: 'INS-04', quantity: 64, unit: 'pcs' },
      ],
      outputs: [
        { lotId: 'ASM-26', quantity: 32, unit: 'pcs' },
        { lotId: 'ASM-27', quantity: 32, unit: 'pcs' },
      ],
    },
    {
      id: 'assemble-sibling',
      shortLabel: 'Side run',
      label: 'Assemble separate run',
      timestamp: '2026-10-14T10:05:00Z',
      location: 'Assembly cell 2',
      inputs: [
        { lotId: 'HG-13', quantity: 32, unit: 'pcs' },
        { lotId: 'INS-04', quantity: 32, unit: 'pcs' },
      ],
      outputs: [{ lotId: 'ASM-90', quantity: 32, unit: 'pcs' }],
    },
    {
      id: 'pack',
      shortLabel: 'Pack',
      label: 'Seal and pack',
      timestamp: '2026-10-14T11:20:00Z',
      location: 'Pack station 1',
      inputs: [
        { lotId: 'ASM-26', quantity: 32, unit: 'pcs' },
        { lotId: 'SE-09', quantity: 32, unit: 'pcs' },
      ],
      outputs: [{ lotId: 'PK-31', quantity: 32, unit: 'pcs' }],
    },
  ],
}
