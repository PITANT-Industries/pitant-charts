import type { ParetoData } from './model'

const license = 'CC BY 4.0'
const licenseUrl = 'https://creativecommons.org/licenses/by/4.0/'

export const oilParetoSource = {
  label: 'Wetterauw et al. (2025), maize germ de-oiling, Table 1',
  href: 'https://edepot.wur.nl/700871',
  description: 'Three 10-minute steady-state press trials. Feed rate is the reciprocal of specific pressing time. Feed oil removed is 100% minus the percentage of initial oil retained in the cake.',
  license,
  licenseUrl,
}

// Table 1 reports screw speed, specific pressing time (h/kg feed), specific energy
// (kJ/kg feed), and the percentage of initial oil remaining in the press cake.
const oilRuns = [
  { id: 'rpm-11', speedRpm: 11, hoursPerKg: 1.28, energyKjPerKg: 992, oilRetainedPercent: 45 },
  { id: 'rpm-16-5', speedRpm: 16.5, hoursPerKg: 0.65, energyKjPerKg: 589, oilRetainedPercent: 57 },
  { id: 'rpm-22', speedRpm: 22, hoursPerKg: 0.60, energyKjPerKg: 675, oilRetainedPercent: 66 },
]

export const oilParetoData: ParetoData = {
  objectives: [
    { label: 'Feed rate', shortLabel: 'Feed rate', unit: 'kg/h', direction: 'maximize' },
    { label: 'Specific press energy', shortLabel: 'Press energy', unit: 'kJ/kg feed', direction: 'minimize' },
    { label: 'Feed oil removed', shortLabel: 'Oil removed', unit: '%', direction: 'maximize' },
  ],
  trials: oilRuns.map(({ id, speedRpm, hoursPerKg, energyKjPerKg, oilRetainedPercent }) => ({
    id,
    label: `${speedRpm} rpm`,
    values: [1 / hoursPerKg, energyKjPerKg, 100 - oilRetainedPercent],
    setup: `Screw speed ${speedRpm} rpm · ${hoursPerKg} h/kg feed · ${oilRetainedPercent}% of initial oil retained in cake`,
  })),
}

export const machiningParetoSource = {
  label: 'Castillo Pantoja et al. (2023), measured AISI 316L turning trials',
  href: 'https://doi.org/10.5281/zenodo.7892469',
  description: 'Material removal rate and cutting-interface energy are calculated from the source settings and measured tangential force. Surface roughness Ra is measured.',
  license,
  licenseUrl,
}

// From Data experimental.xls, Hoja1. Columns are run, cutting speed (m/min),
// feed (mm/rev), lubrication code (+1 dry, −1 MQL), Ra (µm), and cutting force (N).
const turningRuns = [
  [1, 300, 0.20, 1, 0.30, 248.17],
  [2, 200, 0.10, -1, 0.38, 290.97],
  [3, 200, 0.10, 1, 0.54, 340.11],
  [4, 400, 0.15, 1, 0.55, 310.98],
  [5, 300, 0.20, -1, 0.30, 229.22],
  [6, 400, 0.20, 1, 0.53, 290.87],
  [7, 400, 0.10, 1, 0.67, 383.81],
  [8, 200, 0.15, 1, 0.38, 280.70],
  [9, 300, 0.10, 1, 0.66, 348.49],
  [10, 200, 0.20, 1, 0.30, 224.27],
  [11, 400, 0.20, -1, 0.47, 242.89],
  [12, 300, 0.10, -1, 0.43, 291.04],
  [13, 300, 0.15, -1, 0.41, 261.82],
  [14, 400, 0.10, -1, 0.52, 330.37],
  [15, 200, 0.15, -1, 0.33, 215.91],
  [16, 400, 0.15, -1, 0.49, 288.87],
  [17, 200, 0.20, -1, 0.25, 200.28],
  [18, 300, 0.15, 1, 0.52, 280.48],
  [19, 400, 0.20, -1, 0.48, 229.63],
  [20, 200, 0.10, 1, 0.50, 344.89],
  [21, 400, 0.10, -1, 0.51, 344.18],
  [22, 300, 0.15, -1, 0.42, 263.77],
  [23, 300, 0.20, -1, 0.32, 231.41],
  [24, 400, 0.10, 1, 0.68, 384.66],
  [25, 300, 0.10, 1, 0.68, 346.43],
  [26, 200, 0.10, -1, 0.40, 292.39],
  [27, 200, 0.20, -1, 0.29, 202.39],
  [28, 300, 0.20, 1, 0.41, 240.30],
  [29, 200, 0.20, 1, 0.33, 220.81],
  [30, 400, 0.15, -1, 0.48, 290.72],
  [31, 300, 0.15, 1, 0.49, 288.98],
  [32, 400, 0.20, 1, 0.57, 289.99],
  [33, 200, 0.15, 1, 0.40, 285.01],
  [34, 400, 0.15, 1, 0.58, 319.90],
  [35, 200, 0.15, -1, 0.34, 222.40],
  [36, 300, 0.10, -1, 0.42, 290.26],
  [37, 300, 0.20, -1, 0.30, 237.05],
  [38, 200, 0.10, 1, 0.52, 345.55],
  [39, 300, 0.15, -1, 0.44, 260.38],
  [40, 300, 0.10, 1, 0.64, 351.78],
  [41, 300, 0.10, -1, 0.44, 288.00],
  [42, 400, 0.10, 1, 0.66, 379.04],
  [43, 200, 0.20, -1, 0.26, 205.63],
  [44, 300, 0.15, 1, 0.51, 292.54],
  [45, 400, 0.20, 1, 0.55, 225.29],
  [46, 300, 0.20, 1, 0.37, 244.65],
  [47, 400, 0.20, -1, 0.46, 233.31],
  [48, 400, 0.15, -1, 0.49, 285.02],
  [49, 200, 0.20, 1, 0.31, 223.08],
  [50, 400, 0.15, 1, 0.54, 314.86],
  [51, 200, 0.15, -1, 0.33, 218.83],
  [52, 200, 0.15, 1, 0.42, 284.35],
  [53, 200, 0.10, -1, 0.37, 296.17],
  [54, 400, 0.10, -1, 0.53, 332.12],
] as const

const cuttingDepthMm = 0.5

export const machiningParetoData: ParetoData = {
  objectives: [
    { label: 'Material removal rate', shortLabel: 'Removal rate', unit: 'cm³/min', direction: 'maximize' },
    { label: 'Specific cutting energy', shortLabel: 'Cutting energy', unit: 'kWh/dm³', direction: 'minimize' },
    { label: 'Surface roughness Ra', shortLabel: 'Roughness Ra', unit: 'µm', direction: 'minimize' },
  ],
  trials: turningRuns.map(([run, cuttingSpeed, feed, lubrication, roughness, force]) => ({
    id: `run-${run}`,
    label: `Run ${run}`,
    group: lubrication === 1 ? 'Dry' : 'MQL',
    values: [cuttingSpeed * feed * cuttingDepthMm, force / (3600 * feed * cuttingDepthMm), roughness],
    setup: `Cutting speed ${cuttingSpeed} m/min · Feed ${feed} mm/rev · Cutting force ${force} N`,
  })),
}
