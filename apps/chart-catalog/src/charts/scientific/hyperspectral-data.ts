import type { HyperspectralCubeData } from './HyperspectralCube'
import cuprite from './hyperspectral-cuprite.json'

const layerSize = cuprite.width * cuprite.height
const deltaBytes = atob(cuprite.deltaBase64.join(''))
const values = new Int16Array(cuprite.wavelengthsNm.length * layerSize)

for (let index = 0; index < values.length; index++) {
  const byte = index * 2
  const delta = deltaBytes.charCodeAt(byte) | (deltaBytes.charCodeAt(byte + 1) << 8)
  // Int16Array writes wrap the sum to the original signed 16-bit count.
  values[index] = delta + (index >= layerSize ? values[index - layerSize] : 0)
}

export const hyperspectralData = {
  width: cuprite.width,
  height: cuprite.height,
  wavelengthsNm: cuprite.wavelengthsNm,
  values,
  valueScale: cuprite.valueScale,
  noDataValue: cuprite.noDataValue,
  excludedBands: cuprite.excludedBands,
  valueLabel: 'Surface reflectance',
  valueUnit: '%',
  displayRange: [cuprite.displayRange[0], cuprite.displayRange[1]],
  columnOrigin: cuprite.columnOrigin,
  rowOrigin: cuprite.rowOrigin,
  pixelStride: cuprite.pixelStride,
  initialPixel: [cuprite.initialPixel[0], cuprite.initialPixel[1]],
  initialBand: cuprite.initialBand,
  rgbBands: [cuprite.rgbBands[0], cuprite.rgbBands[1], cuprite.rgbBands[2]],
} satisfies HyperspectralCubeData

export const hyperspectralSource = {
  label: cuprite.source.label,
  href: cuprite.source.href,
  description: cuprite.source.credit,
  license: cuprite.source.license,
  licenseUrl: cuprite.source.licenseUrl,
}
