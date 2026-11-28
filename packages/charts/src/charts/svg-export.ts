import { normalizeLineDash } from '../renderer/line-dash.js'
import type { DrawCommand, RenderCommandList } from '../renderer/render-command-list.js'
import type {
  FillOptions,
  LineOptions,
  MarkBatchOptions,
  RectOptions,
  TextOptions,
} from '../renderer/types.js'
import type { ViewTransform } from '../renderer/view-transform.js'
import type { ChartLayout, RgbaColor } from './common.js'

export interface CommandFrameSvgInput {
  width: number
  height: number
  layout?: ChartLayout | null
  commands: RenderCommandList
  transform: ViewTransform
}

export interface CommandFrameSvgOptions {
  background?: string
  title?: string
  description?: string
}

export function commandFrameToSvg(
  frame: CommandFrameSvgInput,
  options: CommandFrameSvgOptions = {},
): string {
  const width = Math.max(1, frame.width)
  const height = Math.max(1, frame.height)
  const dataElements: string[] = []
  const screenElements: string[] = []

  for (const command of frame.commands.sorted()) {
    const element = commandToSvgElement(command, frame.transform)
    if (!element) continue
    if (command.kind !== 'text') {
      dataElements.push(element)
    } else {
      screenElements.push(element)
    }
  }

  const clip = frame.layout?.plotArea ?? { x: 0, y: 0, width, height }
  const body: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${formatNumber(width)}" height="${formatNumber(height)}" viewBox="0 0 ${formatNumber(width)} ${formatNumber(height)}" fill="none">`,
  ]

  if (options.title) body.push(`<title>${escapeText(options.title)}</title>`)
  if (options.description) body.push(`<desc>${escapeText(options.description)}</desc>`)
  if (options.background) {
    body.push(
      `<rect x="0" y="0" width="${formatNumber(width)}" height="${formatNumber(height)}" fill="${escapeAttr(options.background)}"/>`,
    )
  }

  if (dataElements.length > 0) {
    body.push('<defs>')
    body.push(
      `<clipPath id="plot-clip"><rect x="${formatNumber(clip.x)}" y="${formatNumber(clip.y)}" width="${formatNumber(clip.width)}" height="${formatNumber(clip.height)}"/></clipPath>`,
    )
    body.push('</defs>')
    body.push('<g clip-path="url(#plot-clip)" shape-rendering="geometricPrecision">')
    body.push(...dataElements)
    body.push('</g>')
  }

  body.push(...screenElements)
  body.push('</svg>')
  return `${body.join('')}\n`
}

function commandToSvgElement(command: DrawCommand, transform: ViewTransform): string | null {
  switch (command.kind) {
    case 'line':
      return lineToSvg(command.buffer, command.options, command.transform ?? transform)
    case 'fill':
      return fillToSvg(
        command.upper,
        command.lower,
        command.options,
        command.transform ?? transform,
      )
    case 'rect':
      return rectToSvg(
        command.x,
        command.y,
        command.w,
        command.h,
        command.options,
        command.transform ?? transform,
      )
    case 'marks':
      return marksToSvg(command.bounds, command.options, command.transform ?? transform)
    case 'text':
      return textToSvg(command.text, command.x, command.y, command.options)
  }
}

function lineToSvg(
  buffer: Float32Array,
  options: LineOptions,
  transform: ViewTransform,
): string | null {
  if (buffer.length < 4) return null
  const d = linePath(buffer, transform)
  if (!d) return null
  const dash = normalizeLineDash(options.dash)
  const dashAttribute = dash ? ` stroke-dasharray="${dash.join(' ')}"` : ''
  return `<path d="${d}" fill="none" ${strokeAttrs(options.color, options.width)} stroke-linecap="${options.cap ?? 'butt'}" stroke-linejoin="${options.join ?? 'miter'}"${dashAttribute}/>`
}

function fillToSvg(
  upper: Float32Array,
  lower: Float32Array,
  options: FillOptions,
  transform: ViewTransform,
): string | null {
  if (upper.length < 4 || lower.length < 4) return null
  const d = fillPath(upper, lower, transform)
  if (!d) return null
  return `<path d="${d}" ${fillAttrs(options.color)}/>`
}

function rectToSvg(
  x: number,
  y: number,
  width: number,
  height: number,
  options: RectOptions,
  transform: ViewTransform,
): string | null {
  const topLeft = transform.dataToPixel(x, y)
  const bottomRight = transform.dataToPixel(x + width, y + height)
  if (!finitePoint(topLeft) || !finitePoint(bottomRight)) return null
  const screenX = Math.min(topLeft.x, bottomRight.x)
  const screenY = Math.min(topLeft.y, bottomRight.y)
  const screenWidth = Math.abs(bottomRight.x - topLeft.x)
  const screenHeight = Math.abs(bottomRight.y - topLeft.y)
  const attrs: string[] = [
    `x="${formatNumber(screenX)}"`,
    `y="${formatNumber(screenY)}"`,
    `width="${formatNumber(screenWidth)}"`,
    `height="${formatNumber(screenHeight)}"`,
  ]
  if (options.fillColor) attrs.push(fillAttrs(options.fillColor))
  if (options.strokeColor) attrs.push(strokeAttrs(options.strokeColor, options.strokeWidth ?? 1))
  if (!options.fillColor && !options.strokeColor) return null
  return `<rect ${attrs.join(' ')}/>`
}

function marksToSvg(
  bounds: Float32Array,
  options: MarkBatchOptions,
  transform: ViewTransform,
): string | null {
  const parts: string[] = []
  for (let i = 0; i + 3 < bounds.length; i += 4) {
    const x = bounds[i] as number
    const y = bounds[i + 1] as number
    const w = bounds[i + 2] as number
    const h = bounds[i + 3] as number
    if (!(w > 0 && h > 0)) continue
    const first = transform.dataToPixel(x, y)
    const last = transform.dataToPixel(x + w, y + h)
    const left = formatNumber(Math.min(first.x, last.x))
    const right = formatNumber(Math.max(first.x, last.x))
    if (options.shape === 'ellipse') {
      const centerY = formatNumber((first.y + last.y) / 2)
      const rx = formatNumber(Math.abs(first.x - last.x) / 2)
      const ry = formatNumber(Math.abs(first.y - last.y) / 2)
      parts.push(
        `M ${left} ${centerY} A ${rx} ${ry} 0 1 0 ${right} ${centerY} A ${rx} ${ry} 0 1 0 ${left} ${centerY} Z`,
      )
    } else {
      const top = formatNumber(Math.min(first.y, last.y))
      const bottom = formatNumber(Math.max(first.y, last.y))
      parts.push(`M ${left} ${top} H ${right} V ${bottom} H ${left} Z`)
    }
  }
  return parts.length > 0 ? `<path d="${parts.join(' ')}" ${fillAttrs(options.color)}/>` : null
}

function textToSvg(text: string, x: number, y: number, options: TextOptions): string {
  const anchor = options.align === 'center' ? 'middle' : options.align === 'right' ? 'end' : 'start'
  const baseline =
    options.baseline === 'middle'
      ? 'central'
      : options.baseline === 'bottom'
        ? 'text-after-edge'
        : 'text-before-edge'
  const font = options.font ?? 'sans-serif'
  const fontSize = options.fontSize ?? 12
  const rotation = options.rotation
    ? ` transform="rotate(${formatNumber(options.rotation)} ${formatNumber(x)} ${formatNumber(y)})"`
    : ''
  return `<text x="${formatNumber(x)}" y="${formatNumber(y)}" ${fillAttrs(options.color)} font-family="${escapeAttr(font)}" font-size="${formatNumber(fontSize)}" text-anchor="${anchor}" dominant-baseline="${baseline}"${rotation}>${escapeText(text)}</text>`
}

function finitePoint(point: { x: number; y: number }): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y)
}

function linePath(buffer: Float32Array, transform: ViewTransform): string {
  const parts: string[] = []
  let draw = false
  for (let i = 0; i + 1 < buffer.length; i += 2) {
    const point = transform.dataToPixel(buffer[i] as number, buffer[i + 1] as number)
    if (!finitePoint(point)) {
      draw = false
      continue
    }
    parts.push(`${draw ? 'L' : 'M'} ${formatNumber(point.x)} ${formatNumber(point.y)}`)
    draw = true
  }
  return parts.join(' ')
}

function fillPath(upper: Float32Array, lower: Float32Array, transform: ViewTransform): string {
  const parts: string[] = []
  let first = 0
  const limit = upper.length
  while (first + 1 < limit) {
    let end = first
    for (; end + 1 < limit; end += 2) {
      const point = transform.dataToPixel(upper[end] as number, upper[end + 1] as number)
      const other =
        upper.length === lower.length
          ? transform.dataToPixel(lower[end] as number, lower[end + 1] as number)
          : point
      if (!finitePoint(point) || !finitePoint(other)) break
    }
    if (upper.length !== lower.length && end !== upper.length) return ''
    if (end - first >= 4) {
      const top = linePath(upper.subarray(first, end), transform)
      const bottom: string[] = []
      const lowerStart = upper.length === lower.length ? first : 0
      const lowerEnd = upper.length === lower.length ? end : lower.length
      for (let i = lowerEnd - 2; i >= lowerStart; i -= 2) {
        const point = transform.dataToPixel(lower[i] as number, lower[i + 1] as number)
        if (!finitePoint(point)) return ''
        bottom.push(`L ${formatNumber(point.x)} ${formatNumber(point.y)}`)
      }
      parts.push(top)
      for (const segment of bottom) parts.push(segment)
      parts.push('Z')
    }
    first = end + 2
  }
  return parts.join(' ')
}

function fillAttrs(color: RgbaColor): string {
  const { rgb, alpha } = svgColor(color)
  return alpha >= 1 ? `fill="${rgb}"` : `fill="${rgb}" fill-opacity="${formatNumber(alpha)}"`
}

function strokeAttrs(color: RgbaColor, width: number): string {
  const { rgb, alpha } = svgColor(color)
  const attrs = [`stroke="${rgb}"`, `stroke-width="${formatNumber(width)}"`]
  if (alpha < 1) attrs.push(`stroke-opacity="${formatNumber(alpha)}"`)
  return attrs.join(' ')
}

function svgColor(color: RgbaColor): { rgb: string; alpha: number } {
  const r = Math.round(clamp(color[0], 0, 1) * 255)
  const g = Math.round(clamp(color[1], 0, 1) * 255)
  const b = Math.round(clamp(color[2], 0, 1) * 255)
  return { rgb: `rgb(${r} ${g} ${b})`, alpha: clamp(color[3], 0, 1) }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '0'
  const normalized = Math.abs(value) < 0.0005 ? 0 : value
  return String(Number(normalized.toFixed(3)))
}

function escapeText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function escapeAttr(value: string): string {
  return escapeText(value).replaceAll('"', '&quot;')
}
