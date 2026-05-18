import { LodPyramid } from './lod-pyramid.js'
import type {
  IngestOptions,
  QueryResult,
  SeriesStats,
  WorkerCommand,
  WorkerResponse,
} from './types.js'

/**
 * Promise-based wrapper around the data engine Web Worker.
 * Handles message routing, transferable arraybuffers, and
 * falls back to main-thread processing for small datasets.
 */
export class DataEngine {
  private _worker: Worker | null = null
  private _pendingRequests = new Map<
    string,
    { resolve: (value: WorkerResponse) => void; reject: (err: Error) => void }
  >()
  private _requestId = 0

  /** Main-thread pyramids for fast-path series. */
  private _localPyramids = new Map<string, LodPyramid>()

  /** Track which series are handled locally vs worker. */
  private _localSeries = new Set<string>()

  /**
   * Threshold below which data is processed on the main thread.
   */
  static readonly FAST_PATH_THRESHOLD = 10_000

  private _ensureWorker(): Worker {
    if (!this._worker) {
      this._worker = new Worker(new URL('./data-engine.worker.js', import.meta.url), {
        type: 'module',
      })
      this._worker.addEventListener('message', this._onMessage)
    }
    return this._worker
  }

  private _onMessage = (event: MessageEvent<WorkerResponse & { _requestId?: string }>): void => {
    const { _requestId, ...response } = event.data
    if (_requestId && this._pendingRequests.has(_requestId)) {
      const pending = this._pendingRequests.get(_requestId)
      if (!pending) return
      this._pendingRequests.delete(_requestId)
      if (response.type === 'error') {
        pending.reject(new Error(response.message))
      } else {
        pending.resolve(response)
      }
    }
  }

  private _send(command: WorkerCommand, transfer: Transferable[] = []): Promise<WorkerResponse> {
    const requestId = `req_${++this._requestId}`
    const worker = this._ensureWorker()

    return new Promise<WorkerResponse>((resolve, reject) => {
      this._pendingRequests.set(requestId, { resolve, reject })
      worker.postMessage({ ...command, _requestId: requestId }, transfer)
    })
  }

  /**
   * Ingest a full series into the data engine.
   * Uses main-thread fast path for datasets < FAST_PATH_THRESHOLD points.
   */
  async ingest(
    seriesId: string,
    timestamps: BigInt64Array,
    values: Float64Array,
    options?: IngestOptions,
  ): Promise<SeriesStats> {
    const n = Math.min(timestamps.length, values.length)

    if (n < DataEngine.FAST_PATH_THRESHOLD) {
      // Fast path — synchronous on main thread
      let pyramid = this._localPyramids.get(seriesId)
      if (!pyramid) {
        pyramid = new LodPyramid()
        this._localPyramids.set(seriesId, pyramid)
      }
      this._localSeries.add(seriesId)
      return pyramid.ingest(timestamps, values, options)
    }

    // Worker path — transfer buffers
    this._localSeries.delete(seriesId)
    this._localPyramids.delete(seriesId)

    const response = await this._send({ type: 'ingest', seriesId, timestamps, values }, [
      timestamps.buffer,
      values.buffer,
    ])
    if (response.type !== 'ingested') {
      throw new Error(`Unexpected response type: ${response.type}`)
    }
    return response.stats
  }

  /**
   * Append new points to an existing series.
   */
  async append(seriesId: string, timestamps: BigInt64Array, values: Float64Array): Promise<number> {
    if (this._localSeries.has(seriesId)) {
      const pyramid = this._localPyramids.get(seriesId)
      if (!pyramid) throw new Error(`Series "${seriesId}" not found.`)
      return pyramid.append(timestamps, values)
    }

    const response = await this._send({ type: 'append', seriesId, timestamps, values }, [
      timestamps.buffer,
      values.buffer,
    ])
    if (response.type !== 'appended') {
      throw new Error(`Unexpected response type: ${response.type}`)
    }
    return response.newLength
  }

  /**
   * Query for viewport-resolution data from the LOD pyramid.
   */
  async query(
    seriesId: string,
    startTime: bigint,
    endTime: bigint,
    viewportWidth: number,
  ): Promise<QueryResult> {
    if (this._localSeries.has(seriesId)) {
      const pyramid = this._localPyramids.get(seriesId)
      if (!pyramid) throw new Error(`Series "${seriesId}" not found.`)
      const result = pyramid.query(startTime, endTime, viewportWidth)
      return {
        data: result.data,
        level: result.level,
        pointCount: result.pointCount,
        gaps: result.gaps,
      }
    }

    const response = await this._send({
      type: 'query',
      seriesId,
      startTime,
      endTime,
      viewportWidth,
    })
    if (response.type !== 'queryResult') {
      throw new Error(`Unexpected response type: ${response.type}`)
    }
    return {
      data: response.data,
      level: response.level,
      pointCount: response.pointCount,
      gaps: response.gaps,
    }
  }

  /**
   * Get current statistics for a series.
   */
  async getStats(seriesId: string): Promise<SeriesStats> {
    if (this._localSeries.has(seriesId)) {
      const pyramid = this._localPyramids.get(seriesId)
      if (!pyramid) throw new Error(`Series "${seriesId}" not found.`)
      return pyramid.stats
    }

    const response = await this._send({ type: 'getStats', seriesId })
    if (response.type !== 'stats') {
      throw new Error(`Unexpected response type: ${response.type}`)
    }
    return response.stats
  }

  /**
   * Dispose a series and free its memory.
   */
  async dispose(seriesId: string): Promise<void> {
    if (this._localSeries.has(seriesId)) {
      const pyramid = this._localPyramids.get(seriesId)
      if (pyramid) pyramid.dispose()
      this._localPyramids.delete(seriesId)
      this._localSeries.delete(seriesId)
      return
    }

    await this._send({ type: 'dispose', seriesId })
  }

  /**
   * Terminate the worker and free all resources.
   */
  destroy(): void {
    // Clean up local pyramids
    for (const pyramid of this._localPyramids.values()) {
      pyramid.dispose()
    }
    this._localPyramids.clear()
    this._localSeries.clear()

    // Clean up worker
    if (this._worker) {
      this._worker.removeEventListener('message', this._onMessage)
      this._worker.terminate()
      this._worker = null
    }
    for (const [, pending] of this._pendingRequests) {
      pending.reject(new Error('DataEngine destroyed'))
    }
    this._pendingRequests.clear()
  }
}
