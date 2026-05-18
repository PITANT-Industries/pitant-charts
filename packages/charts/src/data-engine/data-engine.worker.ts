import { LodPyramid } from './lod-pyramid.js'
import type { WorkerCommand, WorkerResponse } from './types.js'

/**
 * Data engine Web Worker.
 * Handles ingest, append, query, dispose, and getStats commands.
 * Each series gets its own LodPyramid instance.
 */

const series = new Map<string, LodPyramid>()

type ResponseWithId = WorkerResponse & { _requestId: string | undefined }

function handleCommand(command: WorkerCommand & { _requestId?: string }): {
  response: ResponseWithId
  transfer: Transferable[]
} {
  const requestId = command._requestId

  switch (command.type) {
    case 'ingest': {
      let pyramid = series.get(command.seriesId)
      if (pyramid) {
        pyramid.dispose()
      }
      pyramid = new LodPyramid()
      series.set(command.seriesId, pyramid)

      const stats = pyramid.ingest(command.timestamps, command.values)
      return {
        response: { type: 'ingested', seriesId: command.seriesId, stats, _requestId: requestId },
        transfer: [],
      }
    }

    case 'append': {
      const pyramid = series.get(command.seriesId)
      if (!pyramid) {
        return {
          response: {
            type: 'error',
            seriesId: command.seriesId,
            message: `Series "${command.seriesId}" not found. Call ingest first.`,
            _requestId: requestId,
          },
          transfer: [],
        }
      }

      const newLength = pyramid.append(command.timestamps, command.values)
      return {
        response: {
          type: 'appended',
          seriesId: command.seriesId,
          newLength,
          _requestId: requestId,
        },
        transfer: [],
      }
    }

    case 'query': {
      const pyramid = series.get(command.seriesId)
      if (!pyramid) {
        return {
          response: {
            type: 'error',
            seriesId: command.seriesId,
            message: `Series "${command.seriesId}" not found.`,
            _requestId: requestId,
          },
          transfer: [],
        }
      }

      const result = pyramid.query(command.startTime, command.endTime, command.viewportWidth)
      return {
        response: {
          type: 'queryResult',
          seriesId: command.seriesId,
          data: result.data,
          level: result.level,
          pointCount: result.pointCount,
          gaps: result.gaps,
          _requestId: requestId,
        },
        transfer: result.data.buffer.byteLength > 0 ? [result.data.buffer] : [],
      }
    }

    case 'dispose': {
      const pyramid = series.get(command.seriesId)
      if (pyramid) {
        pyramid.dispose()
        series.delete(command.seriesId)
      }
      return {
        response: {
          type: 'ingested',
          seriesId: command.seriesId,
          stats: {
            count: 0,
            min: 0,
            max: 0,
            mean: 0,
            stdDev: 0,
            firstTimestamp: 0n,
            lastTimestamp: 0n,
            gapCount: 0,
            badQualityCount: 0,
          },
          _requestId: requestId,
        },
        transfer: [],
      }
    }

    case 'getStats': {
      const pyramid = series.get(command.seriesId)
      if (!pyramid) {
        return {
          response: {
            type: 'error',
            seriesId: command.seriesId,
            message: `Series "${command.seriesId}" not found.`,
            _requestId: requestId,
          },
          transfer: [],
        }
      }

      return {
        response: {
          type: 'stats',
          seriesId: command.seriesId,
          stats: pyramid.stats,
          _requestId: requestId,
        },
        transfer: [],
      }
    }
  }
}

globalThis.addEventListener('message', (event: MessageEvent) => {
  const command = event.data as WorkerCommand & { _requestId?: string }
  try {
    const { response, transfer } = handleCommand(command)
    globalThis.postMessage(response, { transfer })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    globalThis.postMessage({
      type: 'error',
      seriesId: command.seriesId,
      message,
      _requestId: command._requestId,
    })
  }
})
