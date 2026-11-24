import type { ReliabilityCohort, ReliabilityData } from './model'

function capacitorCohort(voltage: number, failureHours: readonly [number, number, number, number]): ReliabilityCohort {
  const id = `${voltage}v`
  const end = failureHours[3]
  return {
    id,
    label: `${voltage} V`,
    observations: [
      ...failureHours.map((time, index) => ({ id: `${id}-0${index + 1}`, time, status: 'failed' as const })),
      ...[5, 6, 7, 8].map((number) => ({ id: `${id}-0${number}`, time: end, status: 'censored' as const })),
    ],
  }
}

export const measuredReliability: ReliabilityData = {
  timeUnit: 'h',
  cohorts: [
    capacitorCohort(200, [439, 904, 1092, 1105]),
    capacitorCohort(300, [315, 315, 439, 628]),
    capacitorCohort(350, [258, 258, 347, 588]),
  ],
}

export const measuredReliabilityInitialCohort = '300v'
export const measuredReliabilityInitialTime = 628

export const measuredReliabilitySource = {
  label: 'Zelen (1959), glass capacitor life tests',
  href: 'https://doi.org/10.1080/00401706.1959.10489862',
  description: 'Three of the eight original stress cells share a temperature of 170 °C and use different voltages. Each cell started with eight capacitors and stopped at its fourth recorded failure. Four units still on test at that hour were right-censored. Unit IDs were assigned for display.',
  references: [
    { label: 'Recorded hours, Table 3.1', href: 'https://vtechworks.lib.vt.edu/bitstream/handle/10919/37729/Freeman_LauraJ_D_2010.pdf#page=73' },
    { label: 'Kaplan–Meier method', href: 'https://www.itl.nist.gov/div898/handbook/apr/section2/apr215.htm' },
  ],
}
