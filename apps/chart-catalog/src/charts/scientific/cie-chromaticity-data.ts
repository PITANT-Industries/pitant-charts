import type { CieChromaticityData } from './CieChromaticityDiagram'
import cieLocus from './cie-1931-locus.json'

const d65 = [0.3127, 0.3290] as const

export const cieChromaticityData = {
  locus: cieLocus.samples.map(([wavelengthNm, x, y]) => ({ wavelengthNm, xy: [x, y] as const })),
  gamuts: [
    // W3C CSS Color 4, predefined sRGB and Display P3.
    { id: 'srgb', label: 'sRGB', primaries: [[0.64, 0.33], [0.30, 0.60], [0.15, 0.06]], white: d65 },
    { id: 'display-p3', label: 'Display P3', primaries: [[0.68, 0.32], [0.265, 0.69], [0.15, 0.06]], white: d65 },
    // ITU-R BT.2020-2, Table 3.
    { id: 'rec2020', label: 'Rec. 2020', primaries: [[0.708, 0.292], [0.170, 0.797], [0.131, 0.046]], white: d65 },
  ],
  initialGamuts: ['srgb', 'display-p3'],
  initialPoint: d65,
} satisfies CieChromaticityData

export const cieChromaticitySource = {
  label: 'CIE 1931 spectral locus, 2° observer',
  href: `https://doi.org/${cieLocus.source.doi}`,
  description: 'The CIE 1931 2° standard-observer spectral locus at 1 nm intervals from 360 to 830 nm.',
  license: cieLocus.source.license,
  licenseUrl: cieLocus.source.licenseUrl,
}
