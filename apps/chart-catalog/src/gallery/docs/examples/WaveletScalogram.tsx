import { WaveletScalogram, type WaveletScalogramData } from '../../../index'
import '../../../charts.css'

const sampleRateHz = 200
const samples = Array.from({ length: 201 }, (_, index) => {
  const offset = index / sampleRateHz - 0.5
  return Math.exp(-((offset / 0.06) ** 2)) * Math.sin(2 * Math.PI * 30 * offset)
})

const data: WaveletScalogramData = {
  timeSeconds: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
  frequencyHz: [15, 30, 60],
  // Illustrative relative power values, ordered from the lowest frequency to the highest.
  powerDb: [
    [-55, -53, -49, -33, -19, -34, -49, -53, -55],
    [-58, -53, -44, -17, 0, -17, -44, -53, -58],
    [-58, -58, -56, -47, -25, -47, -56, -58, -58],
  ],
  coiEdgeSeconds: [0.091, 0.046, 0.023],
  waveform: { startSeconds: 0, sampleRateHz, unit: 'a.u.', samples },
}

export function ExampleWaveletScalogram() {
  return <WaveletScalogram data={data} initialTimeSeconds={0.5} initialFrequencyHz={30} label="Illustrative wavelet power around a 30 Hz burst" />
}
