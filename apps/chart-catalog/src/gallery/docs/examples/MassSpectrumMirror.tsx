import { MassSpectrumMirror, type MassSpectrumMirrorData } from '../../../index'
import '../../../charts.css'

// Selected measured peaks, © 2026 Federal Institute of Hydrology (BfG), CC BY 4.0.
// Björn Ehlig, Ole Lessmann, Kevin S. Jewell, and Arne Wick, MassBank release 2026.11.
const data: MassSpectrumMirrorData = {
  query: {
    label: 'Caffeine · 40 V CID',
    source: {
      label: 'MassBank · MSBNK-BAFG-CSL2311094663',
      href: 'https://github.com/MassBank/MassBank-data/blob/72980b3af504cfd1e89ac54d7698d3da45d85a58/BAFG/MSBNK-BAFG-CSL2311094663.txt',
    },
    peaks: [
      { mz: 42.044, intensity: 16.3 },
      { mz: 110.0718, intensity: 22.6 },
      { mz: 123.0427, intensity: 20.5 },
      { mz: 138.0657, intensity: 37.6 },
    ],
  },
  reference: {
    label: 'Caffeine · 60 V CID',
    source: {
      label: 'MassBank · MSBNK-BAFG-CSL2311094661',
      href: 'https://github.com/MassBank/MassBank-data/blob/72980b3af504cfd1e89ac54d7698d3da45d85a58/BAFG/MSBNK-BAFG-CSL2311094661.txt',
    },
    peaks: [
      { mz: 42.0443, intensity: 11.7 },
      { mz: 53.0212, intensity: 3 },
      { mz: 110.0687, intensity: 0.5 },
      { mz: 123.044, intensity: 4.8 },
    ],
  },
}

export function ExampleMassSpectrumMirror() {
  return <MassSpectrumMirror data={data} initialToleranceMz={0.02} label="Caffeine MS/MS spectrum comparison" />
}
