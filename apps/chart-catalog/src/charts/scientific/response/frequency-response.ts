/** Aligned samples of a complex scalar transfer response at positive frequencies. */
export interface FrequencyResponseSeries {
  id: string
  label: string
  frequencyHz: readonly number[]
  real: readonly number[]
  imaginary: readonly number[]
}

export interface FrequencyResponseData {
  responses: readonly FrequencyResponseSeries[]
}

export interface FrequencyResponseSample {
  frequencyHz: number
  real: number
  imaginary: number
  magnitudeDb: number
  phaseDeg: number
}

export interface DerivedFrequencyResponse {
  id: string
  label: string
  samples: readonly FrequencyResponseSample[]
}

/** Derive Bode coordinates from the same complex samples used by the Nyquist plot. */
export function deriveFrequencyResponses(data: FrequencyResponseData): readonly DerivedFrequencyResponse[] {
  const ids = new Set<string>()
  const responses: DerivedFrequencyResponse[] = []

  for (const response of data.responses) {
    const { id, label, frequencyHz, real, imaginary } = response
    const count = frequencyHz.length
    if (ids.has(id) || count < 2 || real.length !== count || imaginary.length !== count) return []
    ids.add(id)

    const samples: FrequencyResponseSample[] = []
    let previousFrequency = 0
    let previousAngle = 0
    let phaseOffset = 0

    for (let index = 0; index < count; index++) {
      const frequency = frequencyHz[index]
      const x = real[index]
      const y = imaginary[index]
      const modulus = Math.hypot(x, y)
      if (!Number.isFinite(frequency) || frequency <= previousFrequency || !Number.isFinite(modulus) || modulus <= 0) return []

      const angle = Math.atan2(y, x) * 180 / Math.PI
      // Follow the nearest equivalent angle, assuming less than 180° between samples.
      const delta = angle - previousAngle
      if (delta > 180) phaseOffset -= 360
      if (delta < -180) phaseOffset += 360

      samples.push({
        frequencyHz: frequency,
        real: x,
        imaginary: y,
        magnitudeDb: 20 * Math.log10(modulus),
        phaseDeg: angle + phaseOffset,
      })
      previousFrequency = frequency
      previousAngle = angle
    }

    responses.push({ id, label, samples })
  }

  return responses
}

const minimumHz = 0.6
const maximumHz = 200
const sampleIntervals = 300
const demoFrequencies = Array.from({ length: sampleIntervals + 1 }, (_, index) =>
  index === sampleIntervals ? maximumHz : minimumHz * (maximumHz / minimumHz) ** (index / sampleIntervals),
)

function simulateServo(id: string, label: string, gain: number): FrequencyResponseSeries {
  const real: number[] = []
  const imaginary: number[] = []

  for (const frequency of demoFrequencies) {
    const firstOrderRatio = frequency / 45
    const modalRatio = frequency / 28
    const modalReal = 1 - modalRatio ** 2
    const modalImaginary = 2 * 0.14 * modalRatio
    const denominatorReal = modalReal - firstOrderRatio * modalImaginary
    const denominatorImaginary = modalImaginary + firstOrderRatio * modalReal
    const denominatorPower = denominatorReal ** 2 + denominatorImaginary ** 2

    real.push(gain * denominatorReal / denominatorPower)
    imaginary.push(-gain * denominatorImaginary / denominatorPower)
  }

  return { id, label, frequencyHz: demoFrequencies, real, imaginary }
}

/** Simulated open-loop responses for a flexible servo with a first-order lag. */
export const demoFrequencyResponse: FrequencyResponseData = {
  responses: [
    simulateServo('nominal', 'Nominal gain · K = 0.48', 0.48),
    simulateServo('higher-gain', 'Higher gain · K = 0.84', 0.84),
  ],
}
