export interface NearestTimestampResult {
  index: number
  timestamp: number
  distance: number
}

export function findNearestTimestampIndex(
  timestamps: Float64Array,
  target: number,
): NearestTimestampResult | null {
  const length = timestamps.length
  if (length === 0 || !Number.isFinite(target)) return null

  const first = timestamps[0]
  const last = timestamps[length - 1]
  if (first === undefined || last === undefined) return null

  if (target <= first) {
    return { index: 0, timestamp: first, distance: Math.abs(target - first) }
  }
  if (target >= last) {
    return { index: length - 1, timestamp: last, distance: Math.abs(target - last) }
  }

  let low = 0
  let high = length - 1
  while (low < high) {
    const mid = low + Math.floor((high - low) / 2)
    const value = timestamps[mid] ?? Number.POSITIVE_INFINITY
    if (value < target) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  const rightIndex = low
  const leftIndex = Math.max(0, rightIndex - 1)
  const left = timestamps[leftIndex]
  const right = timestamps[rightIndex]
  if (left === undefined || right === undefined) return null

  const leftDistance = Math.abs(target - left)
  const rightDistance = Math.abs(right - target)
  if (leftDistance <= rightDistance) {
    return { index: leftIndex, timestamp: left, distance: leftDistance }
  }

  return { index: rightIndex, timestamp: right, distance: rightDistance }
}
