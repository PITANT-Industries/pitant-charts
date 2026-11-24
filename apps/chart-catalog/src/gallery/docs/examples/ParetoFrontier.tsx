import { ParetoFrontier, type ParetoData } from '../../../index'
import '../../../charts.css'

// Experimental conditions from Wetterauw et al. (2025), Table 1, CC BY 4.0.
const data: ParetoData = {
  objectives: [
    { label: 'Feed rate', unit: 'kg/h', direction: 'maximize' },
    { label: 'Specific press energy', unit: 'kJ/kg feed', direction: 'minimize' },
    { label: 'Feed oil removed', unit: '%', direction: 'maximize' },
  ],
  trials: [
    { id: 'rpm-11', label: '11 rpm', values: [1 / 1.28, 992, 100 - 45] },
    { id: 'rpm-16-5', label: '16.5 rpm', values: [1 / 0.65, 589, 100 - 57] },
    { id: 'rpm-22', label: '22 rpm', values: [1 / 0.60, 675, 100 - 66] },
  ],
}

const source = {
  label: 'Wetterauw et al. (2025), maize germ de-oiling, Table 1',
  href: 'https://edepot.wur.nl/700871',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
}

export function ExampleParetoFrontier() {
  return <ParetoFrontier data={data} initialTrial="rpm-16-5" source={source} label="Maize germ pressing trade-offs" />
}
