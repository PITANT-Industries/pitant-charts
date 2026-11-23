import type { EyeDiagramData } from './EyeDiagram'

type Bit = 0 | 1

interface ChannelModel {
  id: string
  label: string
  naturalRateRadPerUi: number
  dampingRatio: number
  reflectionWeight: number
  reflectionDelayUi: number
  periodicJitterUi: number
  randomJitterUi: number
  noiseBoundMv: number
}

const samplesPerUi = 64
const symbolRateBaud = 1_000_000_000
const levelsMv = [-400, 400] as const
const timeUi = Array.from({ length: 2 * samplesPerUi + 1 }, (_, index) => index / samplesPerUi - 0.5)
const historySymbols = 10
const jitterPeriodUi = 19
const noiseMemory = 0.58

const referenceChannel: ChannelModel = {
  id: 'reference',
  label: 'Reference channel',
  naturalRateRadPerUi: 21,
  dampingRatio: 1,
  reflectionWeight: 0,
  reflectionDelayUi: 0,
  periodicJitterUi: 0.004,
  randomJitterUi: 0.004,
  noiseBoundMv: 5,
}

const impairedChannel: ChannelModel = {
  id: 'impaired',
  label: 'Impaired channel',
  naturalRateRadPerUi: 11.5,
  dampingRatio: 0.44,
  reflectionWeight: 0.24,
  reflectionDelayUi: 0.58,
  periodicJitterUi: 0.052,
  randomJitterUi: 0.026,
  noiseBoundMv: 28,
}

function prbs7(): Bit[] {
  const seed = 0b1111111
  let register = seed
  const bits: Bit[] = []

  // The register holds b[n] through b[n+6], with b[n] in its least significant bit.
  // x^7 + x^6 + 1 gives b[n+7] = b[n+6] XOR b[n].
  do {
    const bit: Bit = (register & 1) === 1 ? 1 : 0
    bits.push(bit)
    const feedback = bit ^ (register >> 6)
    register = (register >>> 1) | (feedback << 6)
  } while (register !== seed)

  return bits
}

function boundedNoise(seed: number) {
  let state = seed
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 2 ** 31 - 1
  }
}

function simulateChannel(pattern: readonly Bit[], model: ChannelModel) {
  const jitterNoise = boundedNoise(0x62501d19)
  const sampleNoise = boundedNoise(0x3135a222)
  const { naturalRateRadPerUi: rate, dampingRatio: damping, reflectionWeight, reflectionDelayUi } = model
  const dampedRate = rate * Math.sqrt(1 - damping ** 2)
  const firstEdge = -historySymbols - 1
  const edgeCount = pattern.length + 2 - firstEdge
  const bitAt = (index: number) => pattern[(index + pattern.length) % pattern.length]

  function stepResponse(ageUi: number): number {
    if (ageUi <= 0) return 0
    const decay = Math.exp(-rate * damping * ageUi)
    if (damping === 1) return 1 - decay * (1 + rate * ageUi)
    const phase = dampedRate * ageUi
    return 1 - decay * (Math.cos(phase) + rate * damping / dampedRate * Math.sin(phase))
  }

  const edges = Array.from({ length: edgeCount }, (_, offset) => {
    const index = firstEdge + offset
    const jitter = model.periodicJitterUi * Math.sin(2 * Math.PI * index / jitterPeriodUi) +
      model.randomJitterUi * jitterNoise()
    return {
      timeUi: index + jitter,
      changeMv: levelsMv[bitAt(index)] - levelsMv[bitAt(index - 1)],
    }
  })

  let noise = 0
  const sampleCount = (pattern.length - 1) * samplesPerUi + timeUi.length
  const waveform = Array.from({ length: sampleCount }, (_, index) => {
    const time = index / samplesPerUi - 0.5
    const nominalSymbol = Math.floor(time)
    const oldestEdge = nominalSymbol - historySymbols
    let voltage = levelsMv[bitAt(oldestEdge - 1)]
    for (let symbol = oldestEdge; symbol <= nominalSymbol + 1; symbol++) {
      const edge = edges[symbol - firstEdge]
      if (edge.changeMv === 0) continue
      const age = time - edge.timeUi
      const prompt = stepResponse(age)
      // The echo adds no steady-state offset. Its delayed part redistributes the step response.
      const response = prompt + reflectionWeight * (stepResponse(age - reflectionDelayUi) - prompt)
      voltage += edge.changeMv * response
    }
    noise = noiseMemory * noise + (1 - noiseMemory) * sampleNoise()
    return voltage + model.noiseBoundMv * noise
  })

  return {
    id: model.id,
    label: model.label,
    levelsMv,
    traces: pattern.map((bit, index) => ({
      previousBit: bitAt(index - 1),
      bit,
      voltageMv: waveform.slice(index * samplesPerUi, index * samplesPerUi + timeUi.length),
    })),
  }
}

const pattern = prbs7()

/** Deterministic, simulated NRZ waveforms folded against the ideal 1 Gbaud symbol clock. */
export const eyeFixture = {
  symbolRateBaud,
  timeUi,
  runs: [simulateChannel(pattern, referenceChannel), simulateChannel(pattern, impairedChannel)],
} satisfies EyeDiagramData
