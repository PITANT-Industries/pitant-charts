export { measuredLcMsData } from './measured-features'

export const measuredLcMsInitialFeature = 'F29'

export const measuredLcMsSource = {
  label: 'OpenMS Metabolomics_1.mzML',
  href: 'https://github.com/OpenMS/OpenMS/blob/01540e638431426a39b4d7acce41a5e2c738b235/doc/pyopenms/src/data/Metabolomics_1.mzML',
  description: 'Measured positive-mode LC–MS teaching run with 334 centroided MS1 scans. OpenMS grouped 75 features without assigning chemical identities. The original specimen is unspecified.',
  references: [
    { label: 'Feature detection method', href: 'https://pyopenms.readthedocs.io/en/stable/user_guide/untargeted_metabolomics_preprocessing.html' },
    { label: 'OpenMS citation', href: 'https://doi.org/10.1038/s41592-024-02197-7' },
  ],
}
