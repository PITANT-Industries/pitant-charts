import { PcaBiplot, type PcaBiplotData } from '../../../index'
import '../../../charts.css'

// Six measured specimens from B. German (1987), UCI Glass Identification, CC BY 4.0.
const data: PcaBiplotData = {
  variables: [
    { id: 'ri', label: 'Refractive index' },
    { id: 'mg', label: 'Magnesium', unit: 'wt.% oxide' },
    { id: 'ba', label: 'Barium', unit: 'wt.% oxide' },
  ],
  observations: [
    { id: '1', label: 'Specimen 1', group: 'Building windows · float', values: [1.52101, 4.49, 0] },
    { id: '71', label: 'Specimen 71', group: 'Building windows · non-float', values: [1.51574, 3.67, 0] },
    { id: '147', label: 'Specimen 147', group: 'Vehicle windows · float', values: [1.51769, 3.66, 0] },
    { id: '164', label: 'Specimen 164', group: 'Containers', values: [1.51514, 2.68, 2.2] },
    { id: '177', label: 'Specimen 177', group: 'Tableware', values: [1.51905, 2.39, 0] },
    { id: '214', label: 'Specimen 214', group: 'Headlamps', values: [1.51711, 0, 1.67] },
  ],
}

const source = {
  label: 'B. German, UCI Glass Identification',
  href: 'https://doi.org/10.24432/C5WW2P',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
}

export function ExamplePcaBiplot() {
  return <PcaBiplot data={data} source={source} initialVariable="mg" initialObservation="214" label="Glass composition PCA" />
}
