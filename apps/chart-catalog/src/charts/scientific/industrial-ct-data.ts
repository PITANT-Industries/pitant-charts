import type { IndustrialCtData } from './IndustrialCtViewer'
import fixture from './industrial-ct-fixture.json'

function decodeVolume(encoded: string) {
  const binary = atob(encoded)
  const voxels = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    voxels[index] = binary.charCodeAt(index)
  }
  return voxels
}

export const industrialCtData = {
  dimensions: [fixture.dimensions[0], fixture.dimensions[1], fixture.dimensions[2]],
  spacingUm: [fixture.spacingUm[0], fixture.spacingUm[1], fixture.spacingUm[2]],
  originMm: [fixture.originMm[0], fixture.originMm[1], fixture.originMm[2]],
  gray: decodeVolume(fixture.grayBase64),
  labels: decodeVolume(fixture.labelsBase64),
} satisfies IndustrialCtData

export const industrialCtSource = {
  label: 'Felix H. Kim et al., NIST cobalt-chromium XCT',
  href: 'https://doi.org/10.18434/M32162',
  description: 'An interior crop from Sample 2, a laser powder bed fusion cobalt–chromium specimen, at the native 2.45 µm voxel pitch. Pore IDs are derived from NIST’s registered binary masks.',
  license: 'NIST data terms',
  licenseUrl: 'https://www.nist.gov/open/license',
}
