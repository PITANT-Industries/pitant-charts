import type { GaugeRRData } from './model'

// Each source row orders the two trials of Operator 1, then 2, then 3.
const columns = [
  ['O1', '1'], ['O1', '2'],
  ['O2', '1'], ['O2', '2'],
  ['O3', '1'], ['O3', '2'],
] as const

type PublishedRow = readonly [number, number, number, number, number, number]

function study(rows: readonly PublishedRow[]): GaugeRRData {
  return {
    unit: 'in',
    readings: rows.flatMap((row, partIndex) => columns.map(([operator, trial], columnIndex) => ({
      part: `P${partIndex + 1}`,
      operator,
      trial,
      value: row[columnIndex],
    }))),
  }
}

// Yáñez-Contreras et al. (2026), Table 7 / supplementary worksheet GRR_before.
export const baselineGaugeData = study([
  [0.58380, 0.58370, 0.58365, 0.58375, 0.58385, 0.58390], // Part 1
  [0.58365, 0.58375, 0.58405, 0.58395, 0.58400, 0.58400], // Part 2
  [0.58365, 0.58360, 0.58350, 0.58355, 0.58360, 0.58360], // Part 3
  [0.58380, 0.58385, 0.58370, 0.58365, 0.58380, 0.58380], // Part 4
  [0.58400, 0.58395, 0.58400, 0.58395, 0.58400, 0.58400], // Part 5
  [0.58390, 0.58400, 0.58405, 0.58400, 0.58410, 0.58400], // Part 6
  [0.58385, 0.58380, 0.58400, 0.58395, 0.58405, 0.58410], // Part 7
  [0.58395, 0.58390, 0.58405, 0.58400, 0.58410, 0.58415], // Part 8
  [0.58380, 0.58375, 0.58400, 0.58395, 0.58390, 0.58405], // Part 9
  [0.58385, 0.58385, 0.58370, 0.58365, 0.58385, 0.58380], // Part 10
])

// Table 9 / supplementary worksheet GRR_after. This study uses a separate part set.
export const correctedGaugeData = study([
  [0.58405, 0.58405, 0.58415, 0.58405, 0.58405, 0.58415], // Part 1
  [0.58415, 0.58405, 0.58410, 0.58400, 0.58415, 0.58410], // Part 2
  [0.58415, 0.58405, 0.58415, 0.58405, 0.58415, 0.58410], // Part 3
  [0.58410, 0.58400, 0.58410, 0.58420, 0.58405, 0.58405], // Part 4
  [0.58405, 0.58405, 0.58405, 0.58405, 0.58400, 0.58400], // Part 5
  [0.58410, 0.58400, 0.58400, 0.58395, 0.58410, 0.58400], // Part 6
  [0.58410, 0.58410, 0.58405, 0.58415, 0.58400, 0.58400], // Part 7
  [0.58415, 0.58410, 0.58410, 0.58405, 0.58420, 0.58410], // Part 8
  [0.58415, 0.58420, 0.58415, 0.58415, 0.58415, 0.58415], // Part 9
  [0.58405, 0.58400, 0.58405, 0.58395, 0.58410, 0.58400], // Part 10
])

const article = 'https://doi.org/10.3390/metrology6040081'
const references = [
  { label: 'Published workbook', href: 'https://www.mdpi.com/article/10.3390/metrology6040081/s1' },
  { label: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' },
] as const

export const baselineGaugeSource = {
  label: 'Yáñez-Contreras et al. (2026) · Table 7',
  href: article,
  description: 'Before corrective actions, three appraisers each measured the thread pitch diameter of ten CNC-turned steel fittings twice with a screw-thread micrometer. The measurements retain the published inch scale.',
  references,
}

export const correctedGaugeSource = {
  label: 'Yáñez-Contreras et al. (2026) · Table 9',
  href: article,
  description: 'After corrective actions, the same three appraisers repeated the protocol on a different day with a separate set of ten fittings. Part numbers identify parts within this study.',
  references,
}

export const baselineGaugeInitialCell = { part: 'P2', operator: 'O1' }
export const correctedGaugeInitialCell = { part: 'P4', operator: 'O2' }
