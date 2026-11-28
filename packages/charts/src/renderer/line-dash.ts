export function normalizeLineDash(pattern?: readonly number[]): readonly number[] | undefined {
  if (!pattern?.length) return
  let length = 0
  for (const part of pattern) {
    if (!Number.isFinite(part) || part < 0) return
    length += part
  }
  if (!Number.isFinite(length) || length === 0) return
  return pattern.length % 2 === 0 ? pattern : [...pattern, ...pattern]
}

/** WebGPU reads each point's phase and the packed pattern from a single storage buffer. */
export function packDashedLine(
  points: Float32Array,
  pattern: readonly number[],
  scaleX: number,
  scaleY: number,
  dpr: number,
): { buffer: Float32Array; period: number } {
  const patternOffset = points.length * 2
  const buffer = new Float32Array(patternOffset + pattern.length)
  let period = 0
  for (const [index, length] of pattern.entries()) {
    buffer[patternOffset + index] = length * dpr
    period += buffer[patternOffset + index] as number
  }
  period = Math.fround(period)
  if (!Number.isFinite(period) || period === 0) return { buffer: points, period: 0 }

  let phase = 0
  let previousX = points[0] as number
  let previousY = points[1] as number
  for (let index = 0; index < points.length; index += 2) {
    const x = points[index] as number
    const y = points[index + 1] as number
    const segment = Math.hypot((x - previousX) * scaleX, (y - previousY) * scaleY)
    phase = Number.isFinite(segment) ? (phase + segment) % period : 0
    buffer[index * 2] = x
    buffer[index * 2 + 1] = y
    buffer[index * 2 + 2] = phase
    previousX = x
    previousY = y
  }
  buffer[3] = pattern.length / 2
  return { buffer, period }
}
