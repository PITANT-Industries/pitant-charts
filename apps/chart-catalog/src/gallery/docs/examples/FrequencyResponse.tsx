import { FrequencyResponse, type FrequencyResponseData } from '../../../index'
import '../../../charts.css'

const pointCount = 301
const frequencyHz = Array.from(
  { length: pointCount },
  (_, index) => index === pointCount - 1 ? 200 : 0.6 * (200 / 0.6) ** (index / (pointCount - 1)),
)

// Evaluate the open-loop response at unit gain before applying the two gains.
const unitGain = frequencyHz.map((frequency) => {
  const mode = frequency / 28
  const lag = frequency / 45
  const modeReal = 1 - mode ** 2
  const modeImaginary = 2 * 0.14 * mode
  const real = modeReal - lag * modeImaginary
  const imaginary = modeImaginary + lag * modeReal
  const squaredModulus = real ** 2 + imaginary ** 2
  return { real: real / squaredModulus, imaginary: -imaginary / squaredModulus }
})

const gains = [
  { id: 'nominal', label: 'Nominal gain · K = 0.48', gain: 0.48 },
  { id: 'higher-gain', label: 'Higher gain · K = 0.84', gain: 0.84 },
]

const data: FrequencyResponseData = {
  responses: gains.map(({ id, label, gain }) => ({
    id,
    label,
    frequencyHz,
    real: unitGain.map((sample) => gain * sample.real),
    imaginary: unitGain.map((sample) => gain * sample.imaginary),
  })),
}

export function FlexibleServoLoopResponse() {
  return <FrequencyResponse data={data} label="Simulated flexible servo loop" />
}
