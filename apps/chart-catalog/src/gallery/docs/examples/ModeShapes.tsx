import { ModeShapes, type ModeShapeBeam } from '../../../index'
import '../../../charts.css'

const beam: ModeShapeBeam = {
  lengthM: 0.6,
  widthM: 0.03,
  thicknessM: 0.003,
  youngsModulusPa: 200e9,
  densityKgM3: 7850,
}

export function CantileverBeamNaturalModes() {
  return <ModeShapes beam={beam} label="Calculated bending modes of a steel cantilever" />
}
