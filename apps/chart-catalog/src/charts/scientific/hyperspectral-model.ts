export type HyperPixel = readonly [column: number, row: number]
export type HyperChannels = readonly [red: number, green: number, blue: number]
export type HyperMode = 'rgb' | 'band'
export type HyperRegion = { x0: number; x1: number; y0: number; y1: number }

export interface HyperspectralCubeData {
  width: number
  height: number
  wavelengthsNm: readonly number[]
  values: ArrayLike<number>
  valueScale?: number
  valueOffset?: number
  noDataValue?: number
  excludedBands?: readonly number[]
  valueLabel?: string
  valueUnit?: string
  displayRange?: readonly [number, number]
  columnOrigin?: number
  rowOrigin?: number
  pixelStride?: number
  initialPixel?: HyperPixel
  initialBand?: number
  rgbBands?: HyperChannels
}

export interface HyperSample {
  count: number
  mean: number
  sd: number
}

export function hyperRegion([ax, ay]: HyperPixel, [bx, by]: HyperPixel): HyperRegion {
  return { x0: Math.min(ax, bx), x1: Math.max(ax, bx), y0: Math.min(ay, by), y1: Math.max(ay, by) }
}

export function hyperPixel({ width, height }: HyperspectralCubeData, [column, row]: HyperPixel): HyperPixel {
  return [Math.min(width - 1, Math.max(0, Math.round(column))), Math.min(height - 1, Math.max(0, Math.round(row)))]
}

export function hyperValue(data: HyperspectralCubeData, index: number) {
  const raw = data.values[index]
  if (!Number.isFinite(raw) || raw === data.noDataValue) return Number.NaN
  return raw * (data.valueScale ?? 1) + (data.valueOffset ?? 0)
}

export function hyperNearestBand(wavelengths: readonly number[], bands: readonly number[], wavelength: number) {
  return bands.reduce((nearest, band) =>
    Math.abs(wavelengths[band] - wavelength) < Math.abs(wavelengths[nearest] - wavelength) ? band : nearest)
}

export function analyseHyperspectral(data: HyperspectralCubeData) {
  const { width, height, wavelengthsNm, values, valueScale = 1, valueOffset = 0,
    pixelStride = 1, columnOrigin = 0, rowOrigin = 0, excludedBands = [] } = data
  const layerSize = width * height
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1 ||
    !Number.isSafeInteger(layerSize * wavelengthsNm.length) || values.length !== layerSize * wavelengthsNm.length || wavelengthsNm.length < 2 ||
    !Number.isFinite(valueScale) || valueScale <= 0 || !Number.isFinite(valueOffset) ||
    !Number.isSafeInteger(pixelStride) || pixelStride < 1 || !Number.isSafeInteger(columnOrigin) || !Number.isSafeInteger(rowOrigin) ||
    !wavelengthsNm.every((wavelength, index) => Number.isFinite(wavelength) && wavelength > 0 && (index === 0 || wavelength > wavelengthsNm[index - 1])) ||
    !excludedBands.every((band) => Number.isInteger(band) && band >= 0 && band < wavelengthsNm.length)) return null
  const excluded = new Set(excludedBands)
  const bands: number[] = []
  for (let index = 0; index < wavelengthsNm.length; index++) {
    if (!excluded.has(index)) bands.push(index)
  }
  if (bands.length < 2) return null
  const { displayRange } = data
  if (displayRange && (!Number.isFinite(displayRange[0]) || !Number.isFinite(displayRange[1]) || !(displayRange[0] < displayRange[1]))) return null
  let min = displayRange?.[0] ?? Infinity
  let max = displayRange?.[1] ?? -Infinity
  if (!displayRange) {
    for (const band of bands) {
      for (let pixel = band * layerSize, end = pixel + layerSize; pixel < end; pixel++) {
        const sample = hyperValue(data, pixel)
        if (!Number.isFinite(sample)) continue
        min = Math.min(min, sample)
        max = Math.max(max, sample)
      }
    }
    if (!Number.isFinite(min)) return null
    if (max === min) max += Math.max(Math.abs(max) * .01, .01)
  }
  const band = data.initialBand !== undefined && bands.includes(data.initialBand) ? data.initialBand : bands[Math.floor(bands.length / 2)]
  const pixel = hyperPixel(data, data.initialPixel?.every(Number.isFinite) ? data.initialPixel : [Math.floor(width / 2), Math.floor(height / 2)])
  const nearest = (wavelength: number) => hyperNearestBand(wavelengthsNm, bands, wavelength)
  const defaults: HyperChannels = [nearest(650), nearest(550), nearest(460)]
  const rgb = data.rgbBands?.length === 3 && data.rgbBands.every((index) => bands.includes(index)) ? data.rgbBands : defaults
  return { bands, excluded, band, pixel, rgb, layerSize, displayRange: [min, max] as const }
}

export function hyperSpectrum(data: HyperspectralCubeData, bands: readonly number[], { x0, x1, y0, y1 }: HyperRegion) {
  const layerSize = data.width * data.height
  const result: (HyperSample | undefined)[] = Array(data.wavelengthsNm.length)
  for (const band of bands) {
    let mean = 0
    let squared = 0
    let count = 0
    for (let row = y0; row <= y1; row++) {
      const offset = band * layerSize + row * data.width
      for (let column = x0; column <= x1; column++) {
        const value = hyperValue(data, offset + column)
        if (!Number.isFinite(value)) continue
        count++
        const delta = value - mean
        mean += delta / count
        squared += delta * (value - mean)
      }
    }
    if (count) result[band] = { mean, count, sd: Math.sqrt(Math.max(0, squared / count)) }
  }
  return result
}
