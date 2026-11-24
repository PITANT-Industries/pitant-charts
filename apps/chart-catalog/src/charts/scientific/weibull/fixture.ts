import type { ReliabilityCohort, ReliabilityData } from '../kaplan-meier/model'

// Column order follows RCF_Trial_Data.docx. Durations preserve the original seconds.
const trialSeconds = [
  ['T-01', 2945, 7352, 8822],
  ['T-02', 3121, 3395, 6495],
  ['T-03', 6593, 3428, 7941],
  ['T-04', 7243, 7152, 8686],
  ['T-05', 2788, 3804, 7745],
  ['T-06', 2638, 3220, 8277],
  ['T-07', 2753, 4802, 6121],
  ['T-08', 3056, 5105, 6100],
  ['T-09', 6756, 6043, 5459],
  ['T-10', 2589, 6843, 5822],
  ['T-11', 3234, 6234, 2512],
  ['T-12', 5058, 6001, 3572],
  ['T-13', 1677, 6427, 2297],
  ['T-14', 7652, 5338, 2682],
  ['T-15', 3080, 5700, 2827],
  ['T-16', 3196, 5980, 2263],
  ['T-17', 3248, 6399, 2968],
  ['T-18', 3004, 6261, 2536],
  ['T-19', 6820, 6597, 2907],
  ['T-20', 3620, 6465, 2631],
  ['T-21', 3160, 7017, 7762],
] as const

const measuredGrades = ['EP0', 'EP00', 'EP000'] as const

export const measuredWeibull: ReliabilityData = {
  timeUnit: 's',
  cohorts: measuredGrades.map((label, index) => ({
    id: label.toLowerCase(),
    label,
    observations: trialSeconds.map(([id, ...times]) => ({
      id, time: times[index], status: 'failed',
    })),
  })),
}

export const measuredWeibullInitialCohort = 'ep0'

export const measuredWeibullSource = {
  label: 'Bhaumik, Kumar, and Bharathwaj (2026), measured trial data',
  href: 'https://doi.org/10.17632/d5n3zgvs7p.3',
  description: 'All 63 recorded failure durations across three calcium grease grades, measured in a four-ball fatigue test of AISI 52100 bearing steel at 1,470 rpm and a 5,739 N peak load.',
  references: [
    { label: 'Experimental protocol', href: 'https://doi.org/10.1038/s41597-026-08057-7' },
    { label: 'CC BY 4.0', href: 'https://creativecommons.org/licenses/by/4.0/' },
  ],
}

const cutoffHours = 1600

function simulatedSupplier(letter: string, failureHours: readonly number[]): ReliabilityCohort {
  return {
    id: `supplier-${letter.toLowerCase()}`,
    label: `Supplier ${letter}`,
    observations: [...failureHours, ...Array<number>(4).fill(cutoffHours)].map((time, index) => ({
      id: `${letter}-${String(index + 1).padStart(2, '0')}`,
      time,
      status: index < failureHours.length ? 'failed' : 'censored',
    })),
  }
}

export const simulatedWeibull: ReliabilityData = {
  timeUnit: 'h',
  cohorts: [
    simulatedSupplier('A', [180, 760, 915, 1055, 1190, 1320, 1485, 1600]),
    simulatedSupplier('B', [535, 697, 804, 950, 1082, 1180, 1328, 1425]),
  ],
}

export const simulatedWeibullInitialCohort = 'supplier-a'

export const simulatedWeibullSource = {
  label: 'NIST/SEMATECH, Weibull probability plots',
  href: 'https://www.itl.nist.gov/div898/handbook/apr/section2/apr221.htm',
  description: 'Illustrative observations for two fictional suppliers. Each cohort contains eight failures and four units right-censored at 1,600 hours. Supplier A includes a deliberately early failure at 180 hours and a failure recorded at the cutoff.',
}
