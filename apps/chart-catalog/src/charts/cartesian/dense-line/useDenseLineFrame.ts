import { useEffect, useRef, useState } from "react";
import type { DenseLineData, DenseLinePoint, DenseLineRange } from "./data";
import type { SamplerRequest, SamplerResponse } from "./sampler.worker";
import DenseLineWorker from "./sampler.worker?worker&inline";

interface Frame {
  data: DenseLineData;
  range: DenseLineRange;
  points: DenseLinePoint[][];
  width: number;
}

type RequestFrame = (range: DenseLineRange, width: number) => void;
type PendingFrame = { id: number; range: DenseLineRange; width: number };

export function useDenseLineFrame(data: DenseLineData, range: DenseLineRange, width: number) {
  const [frame, setFrame] = useState<Frame>();
  const request = useRef<RequestFrame | null>(null);

  useEffect(() => {
    let disposed = false;
    let worker: Worker | undefined;
    let id = 0;
    let last: PendingFrame | undefined;
    let inFlight = false;
    let fallback: Promise<ReturnType<typeof import("./sampler").prepareDenseLine>> | undefined;
    const columns = data.series.map(item => item.values);
    function renderLocally(range: DenseLineRange, width: number, sequence: number) {
      fallback ??= import("./sampler").then(({ prepareDenseLine }) => prepareDenseLine(columns, data.count));
      void fallback.then(query => {
        if (!disposed && sequence === id) setFrame({ data, range, width, points: query(range, width) });
      });
    }
    function sendQuery(next: PendingFrame) {
      if (!worker || inFlight) return;
      try {
        worker.postMessage({ type: "query", ...next } satisfies SamplerRequest);
        inFlight = true;
      } catch {
        failWorker();
      }
    }
    function failWorker() {
      worker?.terminate();
      worker = undefined;
      inFlight = false;
      if (last && !disposed) renderLocally(last.range, last.width, id);
    }
    if (data.count) {
      try {
        worker = new DenseLineWorker();
        worker.onmessage = ({ data: result }: MessageEvent<SamplerResponse>) => {
          inFlight = false;
          if (disposed || !last) return;
          if (result.id !== last.id) {
            sendQuery(last);
            return;
          }
          setFrame({ data, range: last.range, width: last.width, points: result.points });
        };
        worker.onerror = failWorker;
        worker.onmessageerror = failWorker;
        worker.postMessage({ type: "prepare", columns, count: data.count } satisfies SamplerRequest);
      } catch {
        failWorker();
      }
    }
    request.current = (range, width) => {
      const sequence = ++id;
      last = { id: sequence, range, width };
      if (!data.count) setFrame({ data, range, width, points: [] });
      else if (worker) sendQuery(last);
      else renderLocally(range, width, sequence);
    };
    return () => {
      disposed = true;
      worker?.terminate();
      request.current = null;
    };
  }, [data]);

  useEffect(() => {
    if (width > 0) request.current?.(range, width);
  }, [data, range, width]);

  return frame;
}
