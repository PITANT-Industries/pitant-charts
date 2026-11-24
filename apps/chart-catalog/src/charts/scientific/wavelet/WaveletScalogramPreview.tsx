import { useEffect, useMemo, useState } from 'react'
import type { ChartPreviewProps } from '../../../types'
import { WaveletScalogram } from './WaveletScalogram'
import type { WaveletScalogramData, WaveletSignal } from './WaveletScalogram'
import fixture from './wavelet-fixture.json'
import originalWaveformUrl from './wavelet-original-waveform.bin?url'

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

async function readOriginalWaveform(): Promise<WaveletSignal> {
  const response = await fetch(originalWaveformUrl)
  if (!response.ok || !response.body) throw new Error('Could not load the original waveform.')
  const bytes = await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
  const view = new DataView(bytes)
  const { startSeconds, sampleRateHz, unit, length } = fixture.originalWaveform
  const size = view.getUint32(0, true)
  const lowOffset = 4 + size * 8
  const highOffset = lowOffset + length
  if (size === 0 || size > 65_536 || bytes.byteLength !== highOffset + length) {
    throw new Error('Unexpected original waveform layout.')
  }
  const dictionary = Float64Array.from({ length: size }, (_, index) => view.getFloat64(4 + index * 8, true))
  const samples = new Float64Array(length)
  for (let index = 0; index < length; index++) {
    const code = (view.getUint8(highOffset + index) << 8) | view.getUint8(lowOffset + index)
    if (code >= size) throw new Error('Unexpected original waveform sample.')
    samples[index] = dictionary[code]
  }
  return { startSeconds, sampleRateHz, unit, samples }
}

let originalRequest: Promise<WaveletSignal> | undefined

function originalWaveform() {
  originalRequest ??= readOriginalWaveform().catch((error: unknown) => {
    originalRequest = undefined
    throw error
  })
  return originalRequest
}

function RecordingPreview({ example, compact }: ChartPreviewProps) {
  const [original, setOriginal] = useState<WaveletSignal>()
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    if (compact) return
    let active = true
    void originalWaveform().then(
      (waveform) => { if (active) setOriginal(waveform) },
      () => { if (active) setUnavailable(true) },
    )
    return () => { active = false }
  }, [compact])
  const data = useMemo(() => {
    const base = readFixture()
    return !compact && original ? { ...base, waveform: original } : base
  }, [compact, original])
  return (
    <>
      {!compact && !original && <p className="wavelet-original-status" role="status">
        {unavailable ? 'Original-rate recording unavailable. Showing the processed 12.5 kHz waveform.' : 'Loading the original-rate waveform…'}
      </p>}
      <WaveletScalogram data={data} source={fixture.source} label={example.title} compact={compact} powerDomainDb={powerDomainDb}
        initialTimeSeconds={fixture.initialTimeSeconds} initialFrequencyHz={fixture.initialFrequencyHz} />
    </>
  )
}

export default function WaveletScalogramPreview(props: ChartPreviewProps) {
  if (props.data !== undefined) {
    return <p className="chart-render-message" role="status">Use WaveletScalogram with a power grid and aligned time-domain samples.</p>
  }
  return <RecordingPreview {...props} />
}
