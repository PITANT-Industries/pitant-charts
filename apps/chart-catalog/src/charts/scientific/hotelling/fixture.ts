import type { HotellingData } from './model'

// One per-pass mean per source channel. See Milling-Readme.pdf in the NASA archive.
export const measuredHotelling: HotellingData = {
  channels: [
    { id: 'smcAC', label: 'AC spindle motor current' },
    { id: 'vib_spindle', label: 'Spindle vibration' },
    { id: 'AE_table', label: 'Table acoustic emission' },
  ],
  reference: [
    { id: 'Pass 01', values: [-0.173900462963, 0.308532036675, 0.141338433160] },
    { id: 'Pass 02', values: [-0.174704318576, 0.303971580223, 0.143870827004] },
    { id: 'Pass 03', values: [-0.177772352431, 0.291956696687, 0.135039039894] },
    { id: 'Pass 04', values: [-0.175506365741, 0.289088044343, 0.137577763310] },
    { id: 'Pass 05', values: [-0.179404477720, 0.309869610822, 0.134272709599] },
    { id: 'Pass 06', values: [-0.166582573785, 0.290869366681, 0.137928715459] },
    { id: 'Pass 07', values: [-0.171872287326, 0.285175464771, 0.147472014251] },
    { id: 'Pass 08', values: [-0.171889467593, 0.295836950231, 0.154304673937] },
  ],
  runs: [
    { id: 'Pass 09', values: [-0.166853841146, 0.311092122396, 0.151077157480] },
    { id: 'Pass 10', values: [-0.169266312211, 0.278606951678, 0.154511515299] },
    { id: 'Pass 11', values: [-0.172083875868, 0.288244176794, 0.164791304977] },
    { id: 'Pass 12', values: [-0.158789514612, 0.301711697049, 0.167939701787] },
    { id: 'Pass 13', values: [-0.168230070891, 0.281270345052, 0.167618362992] },
    { id: 'Pass 14', values: [-0.165105070891, 0.274182128906, 0.181397501628] },
    { id: 'Pass 15', values: [-0.164986165365, 0.273740641276, 0.194369958948] },
    { id: 'Pass 16', values: [-0.162114800347, 0.275667317708, 0.190183964482] },
    { id: 'Pass 17', values: [-0.162810149016, 0.267731843171, 0.214372422960] },
    { id: 'Pass 18', values: [-0.162155490451, 0.267227964048, 0.223146565755] },
    { id: 'Pass 19', values: [-0.157580114294, 0.269009286386, 0.209394892940] },
    { id: 'Pass 20', values: [-0.161045554832, 0.265625678168, 0.254583514178] },
    { id: 'Pass 21', values: [-0.156619827836, 0.260004340278, 0.235704549154] },
    { id: 'Pass 22', values: [-0.153203667535, 0.269407371238, 0.265356445313] },
    { id: 'Pass 23', values: [-0.156979257089, 0.270210096571, 0.256562974718] },
  ],
  alpha: 0.01,
}

export const measuredHotellingInitialRun = 'Pass 15'

export const measuredHotellingSource = {
  label: 'NASA Milling Wear, Case 11',
  href: 'https://data.nasa.gov/dataset/milling-wear',
  description: 'Twenty-three cast iron milling passes at a 0.75 mm depth of cut and 0.25 mm/rev feed. Each value is the mean of samples 1,801–7,200 on the recorded signal scale. This retrospective example fits its reference to passes 01–08 and monitors passes 09–23.',
  references: [
    { label: 'Measurement archive and readme', href: 'https://data.nasa.gov/docs/legacy/mill.zip' },
    { label: 'NIST Phase II method', href: 'https://www.itl.nist.gov/div898/handbook/pmc/section5/pmc5434.htm' },
  ],
}
