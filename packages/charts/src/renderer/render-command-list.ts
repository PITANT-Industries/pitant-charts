import type { FillOptions, LineOptions, RectOptions, TextOptions } from './types.js'

/**
 * Z-order layers for draw commands.
 * Lower numbers render first (behind).
 */
export enum ZLayer {
  Fill = 0,
  Line = 1,
  Overlay = 2,
  Text = 3,
}

interface LineCommand {
  kind: 'line'
  z: ZLayer
  buffer: Float32Array
  options: LineOptions
}

interface FillCommand {
  kind: 'fill'
  z: ZLayer
  upper: Float32Array
  lower: Float32Array
  options: FillOptions
}

interface RectCommand {
  kind: 'rect'
  z: ZLayer
  x: number
  y: number
  w: number
  h: number
  options: RectOptions
}

interface TextCommand {
  kind: 'text'
  z: ZLayer
  text: string
  x: number
  y: number
  options: TextOptions
}

export type DrawCommand = LineCommand | FillCommand | RectCommand | TextCommand

/**
 * Collects draw commands from chart types and sorts by z-order.
 * Consumed once per frame by the renderer backend.
 */
export class RenderCommandList {
  private _commands: DrawCommand[] = []

  get length(): number {
    return this._commands.length
  }

  addLine(buffer: Float32Array, options: LineOptions, z: ZLayer = ZLayer.Line): void {
    this._commands.push({ kind: 'line', z, buffer, options })
  }

  addFill(
    upper: Float32Array,
    lower: Float32Array,
    options: FillOptions,
    z: ZLayer = ZLayer.Fill,
  ): void {
    this._commands.push({ kind: 'fill', z, upper, lower, options })
  }

  addRect(
    x: number,
    y: number,
    w: number,
    h: number,
    options: RectOptions,
    z: ZLayer = ZLayer.Overlay,
  ): void {
    this._commands.push({ kind: 'rect', z, x, y, w, h, options })
  }

  addText(text: string, x: number, y: number, options: TextOptions, z: ZLayer = ZLayer.Text): void {
    this._commands.push({ kind: 'text', z, text, x, y, options })
  }

  /**
   * Return commands sorted by z-order (fills → lines → overlays → text).
   * Within the same z-layer, insertion order is preserved.
   */
  sorted(): ReadonlyArray<DrawCommand> {
    return this._commands.slice().sort((a, b) => a.z - b.z)
  }

  clear(): void {
    this._commands.length = 0
  }
}
