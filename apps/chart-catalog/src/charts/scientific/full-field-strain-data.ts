import type { FullFieldStrainData } from './FullFieldStrain'
import fixture from './full-field-strain-fixture.json'

export const fullFieldStrainSource = {
  label: 'Marcin Nowak, Paweł Szeptyński, Sandra Musiał and Michał Maj',
  href: 'https://doi.org/10.5281/zenodo.18617429',
  description: 'Digital image correlation of a T-shaped polyurethane specimen under tensile load. The map shows axial strain on the undeformed reference grid, with each selected frame linked to its measured force.',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
}

export const fullFieldStrainData = {
  ...fixture,
  strainDomainPercent: [fixture.strainDomainPercent[0], fixture.strainDomainPercent[1]],
} satisfies FullFieldStrainData
