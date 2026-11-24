import type { MassSpectrumMirrorData } from './model'

// Measured MassBank peak tables © 2026 Federal Institute of Hydrology (BfG), CC BY 4.0.
// Björn Ehlig, Ole Lessmann, Kevin S. Jewell, and Arne Wick, MassBank release 2026.11.
export const caffeineMassSpectrumMirrorData: MassSpectrumMirrorData = {
  query: {
    label: 'Caffeine · 40 V CID',
    acquisition: 'SCIEX TripleTOF 5600 · positive ESI · [M+H]+ at m/z 195.0877',
    source: {
      label: 'MassBank · MSBNK-BAFG-CSL2311094663',
      href: 'https://github.com/MassBank/MassBank-data/blob/72980b3af504cfd1e89ac54d7698d3da45d85a58/BAFG/MSBNK-BAFG-CSL2311094663.txt',
    },
    peaks: [
      { mz: 42.044, intensity: 16.3 },
      { mz: 54.0401, intensity: 0.6 },
      { mz: 56.0559, intensity: 3.3 },
      { mz: 67.0336, intensity: 0.6 },
      { mz: 68.0411, intensity: 1.4 },
      { mz: 69.0487, intensity: 7.1 },
      { mz: 81.0466, intensity: 1.9 },
      { mz: 81.0588, intensity: 0.8 },
      { mz: 82.0561, intensity: 1.3 },
      { mz: 83.0627, intensity: 14.1 },
      { mz: 95.0493, intensity: 0.4 },
      { mz: 95.0638, intensity: 0.4 },
      { mz: 97.0432, intensity: 1.1 },
      { mz: 108.0529, intensity: 1.6 },
      { mz: 109.0392, intensity: 5.9 },
      { mz: 110.0718, intensity: 22.6 },
      { mz: 111.0541, intensity: 1.1 },
      { mz: 123.0427, intensity: 20.5 },
      { mz: 135.0674, intensity: 1 },
      { mz: 136.0501, intensity: 0.9 },
      { mz: 138.0657, intensity: 37.6 },
      { mz: 180.0601, intensity: 0.4 },
      { mz: 195.0873, intensity: 2.5 },
    ],
  },
  reference: {
    label: 'Caffeine · 60 V CID',
    acquisition: 'SCIEX TripleTOF 5600 · positive ESI · [M+H]+ at m/z 195.0877',
    source: {
      label: 'MassBank · MSBNK-BAFG-CSL2311094661',
      href: 'https://github.com/MassBank/MassBank-data/blob/72980b3af504cfd1e89ac54d7698d3da45d85a58/BAFG/MSBNK-BAFG-CSL2311094661.txt',
    },
    peaks: [
      { mz: 41.0362, intensity: 0.5 },
      { mz: 42.0443, intensity: 11.7 },
      { mz: 53.0212, intensity: 3 },
      { mz: 54.0373, intensity: 1.9 },
      { mz: 56.0548, intensity: 1.5 },
      { mz: 67.0348, intensity: 0.6 },
      { mz: 68.0423, intensity: 4.1 },
      { mz: 69.0488, intensity: 1.3 },
      { mz: 81.0471, intensity: 0.9 },
      { mz: 82.0552, intensity: 0.9 },
      { mz: 83.0629, intensity: 1.6 },
      { mz: 94.0437, intensity: 0.5 },
      { mz: 109.0392, intensity: 0.6 },
      { mz: 110.0687, intensity: 0.5 },
      { mz: 123.044, intensity: 4.8 },
    ],
  },
}
