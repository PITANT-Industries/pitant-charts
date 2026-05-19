import type { DrawCommand, RenderCommandList } from '../renderer/render-command-list.js'
import type { FillOptions, LineOptions, RectOptions, TextOptions } from '../renderer/types.js'
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
    if (command.kind === 'line' || command.kind === 'fill') {
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
      return lineToSvg(command.buffer, command.options, transform)
    case 'fill':
      return fillToSvg(command.upper, command.lower, command.options, transform)
    case 'rect':
      return rectToSvg(command.x, command.y, command.w, command.h, command.options)
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
  return `<path d="${d}" fill="none" ${strokeAttrs(options.color, options.width)} stroke-linecap="${options.cap ?? 'butt'}" stroke-linejoin="${options.join ?? 'miter'}"/>`
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
): string | null {
  const attrs: string[] = [
    `x="${formatNumber(x)}"`,
    `y="${formatNumber(y)}"`,
    `width="${formatNumber(width)}"`,
    `height="${formatNumber(height)}"`,
  ]
  if (options.fillColor) attrs.push(fillAttrs(options.fillColor))
  if (options.strokeColor) attrs.push(strokeAttrs(options.strokeColor, options.strokeWidth ?? 1))
  if (!options.fillColor && !options.strokeColor) return null
  return `<rect ${attrs.join(' ')}/>`
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
  return `<text x="${formatNumber(x)}" y="${formatNumber(y)}" ${fillAttrs(options.color)} font-family="${escapeAttr(font)}" font-size="${formatNumber(fontSize)}" text-anchor="${anchor}" dominant-baseline="${baseline}">${escapeText(text)}</text>`
}

function linePath(buffer: Float32Array, transform: ViewTransform): string {
  const parts: string[] = []
  for (let i = 0; i < buffer.length; i += 2) {
    const x = buffer[i]
    const y = buffer[i + 1]
    if (x === undefined || y === undefined) continue
    const point = transform.dataToPixel(x, y)
    parts.push(
      `${parts.length === 0 ? 'M' : 'L'} ${formatNumber(point.x)} ${formatNumber(point.y)}`,
    )
  }
  return parts.join(' ')
}

function fillPath(upper: Float32Array, lower: Float32Array, transform: ViewTransform): string {
  const parts: string[] = []
  for (let i = 0; i < upper.length; i += 2) {
    const x = upper[i]
    const y = upper[i + 1]
    if (x === undefined || y === undefined) continue
    const point = transform.dataToPixel(x, y)
    parts.push(
      `${parts.length === 0 ? 'M' : 'L'} ${formatNumber(point.x)} ${formatNumber(point.y)}`,
    )
  }
  for (let i = lower.length - 2; i >= 0; i -= 2) {
    const x = lower[i]
    const y = lower[i + 1]
    if (x === undefined || y === undefined) continue
    const point = transform.dataToPixel(x, y)
    parts.push(`L ${formatNumber(point.x)} ${formatNumber(point.y)}`)
  }
  if (parts.length > 0) parts.push('Z')
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
