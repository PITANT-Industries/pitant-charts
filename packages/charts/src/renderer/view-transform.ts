import type { AxisProjection } from '../charts/axis-scale.js'

/**
 * ViewTransform manages pan (translate) + zoom (scale) in data space.
 * Converts between data coordinates, pixel coordinates, and clip coordinates.
 */
export class ViewTransform {
  private _scaleX = 1
  private _scaleY = 1
  private _translateX = 0
  private _translateY = 0
  private _viewportWidth = 0
  private _viewportHeight = 0
  private _xProjection: AxisProjection | undefined
  private _yProjection: AxisProjection | undefined
  private _rotated = false

  constructor(viewportWidth: number, viewportHeight: number) {
    this._viewportWidth = viewportWidth
    this._viewportHeight = viewportHeight
  }

  get scaleX(): number {
    return this._scaleX
  }
  get scaleY(): number {
    return this._scaleY
  }
  get translateX(): number {
    return this._translateX
  }
  get translateY(): number {
    return this._translateY
  }
  get viewportWidth(): number {
    return this._viewportWidth
  }
  get viewportHeight(): number {
    return this._viewportHeight
  }

  get rotated(): boolean {
    return this._rotated
  }

  setViewport(width: number, height: number): void {
    this._viewportWidth = width
    this._viewportHeight = height
  }

  setScale(sx: number, sy: number): void {
    this._scaleX = sx
    this._scaleY = sy
  }

  setTranslate(tx: number, ty: number): void {
    this._translateX = tx
    this._translateY = ty
  }

  setRotated(rotated: boolean): void {
    this._rotated = rotated
  }

  setProjections(
    xProjection: AxisProjection | undefined,
    yProjection: AxisProjection | undefined,
  ): void {
    this._xProjection = xProjection
    this._yProjection = yProjection
  }

  get hasProjection(): boolean {
    return this._xProjection !== undefined || this._yProjection !== undefined
  }

  mapX(value: number): number {
    return this._xProjection?.toRatio(value) ?? value
  }

  mapY(value: number): number {
    return this._yProjection?.toRatio(value) ?? value
  }

  /**
   * Pan by pixel delta.
   */
  pan(dx: number, dy: number): void {
    this._translateX += (this._rotated ? dy : dx) / this._scaleX
    this._translateY += (this._rotated ? -dx : dy) / this._scaleY
  }

  /**
   * Zoom around a point in pixel space.
   */
  zoom(factor: number, centerX: number, centerY: number): void {
    const x = this._rotated ? centerY - this._viewportHeight / 2 : centerX - this._viewportWidth / 2
    const y = this._rotated ? this._viewportWidth / 2 - centerX : centerY - this._viewportHeight / 2
    const dataCenterX = x / this._scaleX - this._translateX
    const dataCenterY = y / this._scaleY - this._translateY

    this._scaleX *= factor
    this._scaleY *= factor

    // Adjust translation so the point under the cursor stays fixed
    this._translateX = x / this._scaleX - dataCenterX
    this._translateY = y / this._scaleY - dataCenterY
  }

  /**
   * Convert data coordinate to pixel coordinate.
   */
  dataToPixel(dataX: number, dataY: number): { x: number; y: number } {
    const x = (this.mapX(dataX) + this._translateX) * this._scaleX
    const y = (this.mapY(dataY) + this._translateY) * this._scaleY
    return {
      x: (this._rotated ? -y : x) + this._viewportWidth / 2,
      y: (this._rotated ? x : y) + this._viewportHeight / 2,
    }
  }

  /**
   * Convert pixel coordinate to data coordinate.
   */
  pixelToData(pixelX: number, pixelY: number): { x: number; y: number } {
    const offsetX = pixelX - this._viewportWidth / 2
    const offsetY = pixelY - this._viewportHeight / 2
    const x = (this._rotated ? offsetY : offsetX) / this._scaleX - this._translateX
    const y = (this._rotated ? -offsetX : offsetY) / this._scaleY - this._translateY
    return { x: this._xProjection?.fromRatio(x) ?? x, y: this._yProjection?.fromRatio(y) ?? y }
  }

  /**
   * Get a 4×4 column-major transformation matrix for GPU upload.
   * Maps from data space to clip space [-1, 1].
   */
  toMatrix4(): Float32Array {
    const mat = new Float32Array(16)
    if (this._rotated) {
      const sx = (2 * this._scaleX) / this._viewportHeight
      const sy = (-2 * this._scaleY) / this._viewportWidth
      mat[1] = sx
      mat[4] = sy
      mat[12] = sy * this._translateY
      mat[13] = sx * this._translateX
    } else {
      const sx = (2 * this._scaleX) / this._viewportWidth
      const sy = (2 * this._scaleY) / this._viewportHeight
      mat[0] = sx
      mat[5] = sy
      mat[12] = sx * this._translateX
      mat[13] = sy * this._translateY
    }
    mat[10] = 1
    mat[15] = 1

    return mat
  }

  /**
   * Reset to identity transform.
   */
  reset(): void {
    this._scaleX = 1
    this._scaleY = 1
    this._translateX = 0
    this._translateY = 0
  }
}
