export type CtCoordinate = readonly [number, number, number]
export type CtAxis = 0 | 1 | 2
export type CtPlane = 'xy' | 'xz' | 'yz'

export interface IndustrialCtData {
  dimensions: CtCoordinate
  spacingUm: CtCoordinate
  gray: Uint8Array
  labels: Uint8Array | Uint16Array
  originMm?: CtCoordinate
}

export interface CtPore {
  id: number
  voxels: number
  volumeMm3: number
  representative: CtCoordinate
}

export interface CtFace {
  center: CtCoordinate
  axis: CtAxis
  sign: 1 | -1
  pore: number
}

export const ctAxes = ['X', 'Y', 'Z'] as const
export const ctPlanes = {
  xy: { horizontal: 0, vertical: 1, fixed: 2, label: 'Axial · XY' },
  xz: { horizontal: 0, vertical: 2, fixed: 1, label: 'Coronal · XZ' },
  yz: { horizontal: 1, vertical: 2, fixed: 0, label: 'Sagittal · YZ' },
} as const

const axes = [0, 1, 2] as const

export function ctIndex([x, y, z]: CtCoordinate, [nx, ny]: CtCoordinate) {
  return x + nx * (y + ny * z)
}

export function ctPosition(index: number, [nx, ny]: CtCoordinate): CtCoordinate {
  return [index % nx, Math.floor(index / nx) % ny, Math.floor(index / (nx * ny))]
}

export function ctMillimeters(index: number, axis: CtAxis, { originMm, spacingUm }: IndustrialCtData) {
  return (originMm?.[axis] ?? 0) + index * spacingUm[axis] / 1000
}

export function ctClampVoxel(voxel: CtCoordinate, dimensions: CtCoordinate): CtCoordinate {
  const clamp = (axis: CtAxis) => Math.min(dimensions[axis] - 1, Math.max(0, Math.round(voxel[axis])))
  return [clamp(0), clamp(1), clamp(2)]
}

type Aggregate = { count: number; x: number; y: number; z: number; best: number; representative: CtCoordinate }

export function analyseCt(data: IndustrialCtData) {
  const { dimensions, spacingUm, labels, gray, originMm } = data
  if (dimensions.length !== 3 || spacingUm.length !== 3 || dimensions.some((n) => !Number.isSafeInteger(n) || n < 2) ||
      spacingUm.some((value) => !Number.isFinite(value) || value <= 0) || (originMm && !originMm.every(Number.isFinite))) return null
  const [nx, ny, nz] = dimensions
  const size = nx * ny * nz
  const voxelVolume = (spacingUm[0] / 1000) * (spacingUm[1] / 1000) * (spacingUm[2] / 1000)
  if (!Number.isSafeInteger(size) || gray.length !== size || labels.length !== size || !(voxelVolume > 0) || !Number.isFinite(voxelVolume)) return null
  const groups = new Map<number, Aggregate>()
  const faces: CtFace[] = []
  const strides = [1, nx, nx * ny]
  for (let index = 0; index < labels.length; index++) {
    const id = labels[index]
    if (!id) continue
    const voxel = ctPosition(index, dimensions)
    const [x, y, z] = voxel
    const record = groups.get(id) ?? { count: 0, x: 0, y: 0, z: 0, best: Infinity, representative: voxel }
    record.count++
    record.x += x
    record.y += y
    record.z += z
    groups.set(id, record)
    for (const axis of axes) {
      const position = voxel[axis]
      if (position === 0 || labels[index - strides[axis]] !== id) faces.push({ center: voxel, axis, sign: -1, pore: id })
      if (position === dimensions[axis] - 1 || labels[index + strides[axis]] !== id) faces.push({ center: voxel, axis, sign: 1, pore: id })
    }
  }
  for (let index = 0; index < labels.length; index++) {
    const group = groups.get(labels[index])
    if (!group) continue
    const voxel = ctPosition(index, dimensions)
    const distance = ((voxel[0] - group.x / group.count) * spacingUm[0]) ** 2 +
      ((voxel[1] - group.y / group.count) * spacingUm[1]) ** 2 +
      ((voxel[2] - group.z / group.count) * spacingUm[2]) ** 2
    if (distance < group.best) {
      group.best = distance
      group.representative = voxel
    }
  }
  const pores: CtPore[] = Array.from(groups, ([id, group]) => ({
    id, voxels: group.count, volumeMm3: group.count * voxelVolume, representative: group.representative,
  })).sort((a, b) => b.voxels - a.voxels || a.id - b.id)
  return { pores, faces }
}
