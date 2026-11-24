import { CieChromaticityDiagram, type CieChromaticityData } from '../../../index'
import '../../../charts.css'

// Illustrative boundary, primary, and sample coordinates.
const data: CieChromaticityData = {
  locus: [
    { wavelengthNm: 395, xy: [.17, .008] },
    { wavelengthNm: 450, xy: [.153, .038] },
    { wavelengthNm: 490, xy: [.045, .295] },
    { wavelengthNm: 535, xy: [.18, .8] },
    { wavelengthNm: 575, xy: [.46, .535] },
    { wavelengthNm: 620, xy: [.69, .31] },
    { wavelengthNm: 700, xy: [.73, .27] },
  ],
  gamuts: [
    { id: 'reference', label: 'Sample reference', primaries: [[.62, .33], [.32, .55], [.19, .11]], white: [.3127, .329] },
    { id: 'comparison', label: 'Sample comparison', primaries: [[.65, .3], [.26, .64], [.17, .08]], white: [.3127, .329] },
  ],
  samples: [
    { id: 'sample-a', label: 'Illustrative sample A', xy: [.35, .35] },
    { id: 'sample-b', label: 'Illustrative sample B', xy: [.29, .53] },
  ],
  initialGamuts: ['reference', 'comparison'],
  initialPoint: [.3127, .329],
}

export function ExampleCieChromaticityDiagram() {
  return <CieChromaticityDiagram data={data} label="Illustrative chromaticity and gamut comparison" />
}
