import { IndustrialCtViewer, type IndustrialCtData } from '../../../index'
import '../../../charts.css'

// Synthetic voxel volume with two labeled features and anisotropic spacing.
const dimensions = [20, 18, 16] as const
const [nx, ny, nz] = dimensions
const gray = new Uint8Array(nx * ny * nz)
const labels = new Uint8Array(gray.length)

const pores = [
  { id: 1, center: [6, 7, 5] },
  { id: 2, center: [14, 11, 11] },
]

for (let z = 0; z < nz; z++) {
  for (let y = 0; y < ny; y++) {
    for (let x = 0; x < nx; x++) {
      const index = x + nx * (y + ny * z)
      const pore = pores.find(({ center: [cx, cy, cz] }) =>
        ((x - cx) / 3) ** 2 + ((y - cy) / 2) ** 2 + ((z - cz) / 2) ** 2 < 1,
      )
      labels[index] = pore?.id ?? 0
      gray[index] = pore ? 32 : 150 + 2 * x
    }
  }
}

const data: IndustrialCtData = { dimensions, spacingUm: [15, 15, 24], gray, labels }

export function ExampleIndustrialCtViewer() {
  return <IndustrialCtViewer data={data} initialPoreId={1} label="Illustrative CT voxel volume" />
}
