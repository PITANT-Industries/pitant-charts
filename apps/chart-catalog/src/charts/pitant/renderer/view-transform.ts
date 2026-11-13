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

  /**
   * Pan by pixel delta.
   */
  pan(dx: number, dy: number): void {
    this._translateX += dx / this._scaleX
    this._translateY += dy / this._scaleY
  }

  /**
   * Zoom around a point in pixel space.
   */
  zoom(factor: number, centerX: number, centerY: number): void {
    // Convert center to data space before zoom
    const dataCenterX = (centerX - this._viewportWidth / 2) / this._scaleX - this._translateX
    const dataCenterY = (centerY - this._viewportHeight / 2) / this._scaleY - this._translateY

    this._scaleX *= factor
    this._scaleY *= factor

    // Adjust translation so the point under the cursor stays fixed
    this._translateX = (centerX - this._viewportWidth / 2) / this._scaleX - dataCenterX
    this._translateY = (centerY - this._viewportHeight / 2) / this._scaleY - dataCenterY
  }

  /**
   * Convert data coordinate to pixel coordinate.
   */
  dataToPixel(dataX: number, dataY: number): { x: number; y: number } {
    return {
      x: (dataX + this._translateX) * this._scaleX + this._viewportWidth / 2,
      y: (dataY + this._translateY) * this._scaleY + this._viewportHeight / 2,
    }
  }

  /**
   * Convert pixel coordinate to data coordinate.
   */
  pixelToData(pixelX: number, pixelY: number): { x: number; y: number } {
    return {
      x: (pixelX - this._viewportWidth / 2) / this._scaleX - this._translateX,
      y: (pixelY - this._viewportHeight / 2) / this._scaleY - this._translateY,
    }
  }

  /**
   * Get a 4×4 column-major transformation matrix for GPU upload.
   * Maps from data space to clip space [-1, 1].
   */
  toMatrix4(): Float32Array {
    const mat = new Float32Array(16)
    const sx = (2 * this._scaleX) / this._viewportWidth
    const sy = (2 * this._scaleY) / this._viewportHeight

    // Column-major 4x4 matrix
    mat[0] = sx // m00
    mat[5] = sy // m11
    mat[10] = 1 // m22
    mat[12] = sx * this._translateX // m30
    mat[13] = sy * this._translateY // m31
    mat[15] = 1 // m33

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
