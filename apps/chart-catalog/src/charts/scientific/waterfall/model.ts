export interface SpectralAxis {
  label: string
  unit?: string
}

export interface SpectralWaterfallAxes {
  spectral: SpectralAxis
  scan: SpectralAxis
  intensity: SpectralAxis
}

export interface SpectralWaterfallData {
  /** Strictly increasing positions on the spectral axis. */
  spectralBins: ArrayLike<number>
  /** Strictly increasing scan coordinates in their original units. */
  scanValues: ArrayLike<number>
  /** Scan-major values, with NaN for missing measurements. */
  values: ArrayLike<number>
}

export interface SpectralSelection {
  scanIndex: number
  binIndex: number
}

export function axisTitle({ label, unit }: SpectralAxis) {
  return unit ? `${label} (${unit})` : label
}

export function readIntensity(data: SpectralWaterfallData, { scanIndex, binIndex }: SpectralSelection) {
  return data.values[scanIndex * data.spectralBins.length + binIndex]
}

export function intensityExtent(values: ArrayLike<number>): readonly [number, number] | undefined {
  let min = Infinity
  let max = -Infinity
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (!Number.isFinite(value)) continue
    min = Math.min(min, value)
    max = Math.max(max, value)
  }
  return min <= max ? [min, max] : undefined
}

function increasing(values: ArrayLike<number>) {
  if (!values.length) return false
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index]) || (index > 0 && values[index] <= values[index - 1])) return false
  }
  return true
}

export function firstSelection({ spectralBins, scanValues, values }: SpectralWaterfallData): SpectralSelection | undefined {
  if (!increasing(spectralBins) || !increasing(scanValues) || spectralBins.length * scanValues.length !== values.length) return
  let strongest = -Infinity
  let selected = -1
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index]
    if (Number.isFinite(value) && value > strongest) {
      strongest = value
      selected = index
    }
  }
  if (selected < 0) return
  return {
    scanIndex: Math.floor(selected / spectralBins.length),
    binIndex: selected % spectralBins.length,
  }
}
