import { XrdPeakTracker, type XrdPeakData } from '../../../index'
import '../../../charts.css'

const angleDeg = Array.from({ length: 81 }, (_, index) => 20.6 + index * 0.01)
const temperaturesK = [250, 280, 310]
const fits = temperaturesK.map((_, index) => ({
  centerDeg: 21.06 - index * 0.04,
  fwhmDeg: 0.14 + index * 0.02,
  height: 1200 - index * 150,
  background: 100,
  backgroundSlope: 0,
  lorentzFraction: 0.3,
  rmse: 0,
}))

// Illustrative scans generated from the supplied pseudo-Voigt parameters.
const data: XrdPeakData = {
  angleDeg,
  scans: temperaturesK.map((temperatureK, index) => {
    const { centerDeg, fwhmDeg, height, background, lorentzFraction } = fits[index]
    const intensity = angleDeg.map((angle) => {
      const radiusSquared = 4 * ((angle - centerDeg) / fwhmDeg) ** 2
      const gaussian = 2 ** (-radiusSquared)
      const lorentzian = 1 / (1 + radiusSquared)
      return background + height * ((1 - lorentzFraction) * gaussian + lorentzFraction * lorentzian)
    })
    return { temperatureK, intensity }
  }),
  peaks: [{ id: 'illustrative', label: 'Illustrative peak near 21°', windowDeg: [20.65, 21.35], fits }],
}

export function ExampleXrdPeakTracker() {
  return <XrdPeakTracker data={data} initialTemperatureK={280} label="Illustrative temperature-resolved diffraction peak" />
}
