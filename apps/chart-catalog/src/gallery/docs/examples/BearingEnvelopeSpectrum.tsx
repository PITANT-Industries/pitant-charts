import { BearingEnvelopeSpectrum, type EnvelopeSpectrumData } from '../../../index'
import '../../../charts.css'

// Illustrative relative levels use separate references for broadband and envelope spectra.
const data: EnvelopeSpectrumData = {
  frequencyHz: [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000],
  orders: [0.5, 1, 2, 3, 3.57, 4, 5.43, 6, 7.14, 8, 10.86, 12],
  bands: [
    { id: 'lower', label: 'Lower carrier band', lowHz: 800, highHz: 1600 },
    { id: 'upper', label: 'Upper carrier band', lowHz: 2000, highHz: 3200 },
  ],
  references: [
    { id: 'bpfo', label: 'Expected BPFO', order: 3.57 },
    { id: 'bpfi', label: 'Expected BPFI', order: 5.43 },
  ],
  runs: [
    {
      id: 'example',
      label: 'Illustrative modulation',
      broadbandDb: [-24, -21, -11, -9, -16, 0, -4, -14, -27],
      envelopes: {
        lower: [-39, -35, -29, -30, -10, -28, -24, -37, -17, -35, -38, -42],
        upper: [-44, -31, -28, -38, -36, -30, 0, -28, -31, -35, -12, -43],
      },
    },
  ],
}

export function ExampleBearingEnvelopeSpectrum() {
  return (
    <BearingEnvelopeSpectrum
      data={data}
      initialBandId="upper"
      initialOrder={5.43}
      label="Illustrative carrier bands and bearing envelope orders"
    />
  )
}
