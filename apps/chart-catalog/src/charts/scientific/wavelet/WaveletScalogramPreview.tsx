import type { ChartPreviewProps } from '../../../types'
import { WaveletScalogram } from './WaveletScalogram'
import type { WaveletScalogramData } from './WaveletScalogram'
import fixture from './wavelet-fixture.json'

const powerDomainDb = [fixture.powerMinDb, fixture.powerMaxDb] as const

function bytesFromBase64(encoded: string) {
  return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
}

let decoded: WaveletScalogramData | undefined

function readFixture(): WaveletScalogramData {
  if (decoded) return decoded
  const { frequencyHz, timeSeconds, coiEdgeSeconds, powerMinDb, powerMaxDb, waveform } = fixture
  const grid = bytesFromBase64(fixture.powerBase64)
  const span = powerMaxDb - powerMinDb
  const powerDb = frequencyHz.map((_, row) => timeSeconds.map((_, column) =>
    powerMinDb + grid[row * timeSeconds.length + column] / 255 * span))
  const samples = bytesFromBase64(waveform.samplesBase64)
  const view = new DataView(samples.buffer, samples.byteOffset, samples.byteLength)
  decoded = {
    frequencyHz, timeSeconds, coiEdgeSeconds, powerDb,
    waveform: {
      startSeconds: waveform.startSeconds,
      sampleRateHz: waveform.sampleRateHz,
      unit: waveform.unit,
      samples: Array.from({ length: samples.length / 2 }, (_, index) =>
        view.getInt16(index * 2, true) * waveform.scale),
    },
  }
  return decoded
}

export default function WaveletScalogramPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use WaveletScalogram with a power grid and aligned time-domain samples.</p>
  }
  return <WaveletScalogram data={readFixture()} source={fixture.source} label={example.title} compact={compact} powerDomainDb={powerDomainDb}
    initialTimeSeconds={fixture.initialTimeSeconds} initialFrequencyHz={fixture.initialFrequencyHz} />
}
