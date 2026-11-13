import { useEffect, useRef, useState } from "react";
import type { Bounds, ScatterRequest, ScatterResponse } from "./data";
import ScatterWorker from "./scatter.worker?worker&inline";

type Input = Extract<ScatterRequest, { kind: "prepare" }>["input"];
type Query = Extract<ScatterRequest, { kind: "view" }>;
type Request = Omit<Query, "id" | "kind">;

export function useScatterFrame(input: Input, view: Bounds | undefined, columns: number, rows: number) {
  const [result, setResult] = useState<{ input: Input; request: Request; frame: ScatterResponse["frame"] }>();
  const send = useRef<(request: Request) => void>(undefined);

  useEffect(() => {
    let disposed = false;
    let worker: Worker | undefined;
    let inFlight = false;
    let latest: Query | undefined;
    let id = 0;
    let local: Promise<ReturnType<typeof import("./data")["prepareScatter"]>> | undefined;
    function dispatch() {
      if (disposed || !latest || inFlight) return;
      const request = latest;
      inFlight = true;
      if (worker) {
        try { worker.postMessage(request); }
        catch { fallback(); }
      } else {
        local ??= import("./data").then(({ prepareScatter }) => prepareScatter(input));
        void local.then(query => {
          if (!disposed && latest?.id === request.id) receive({ id: request.id, frame: query(request) });
          else if (!disposed) { inFlight = false; dispatch(); }
        });
      }
    }
    function receive(response: ScatterResponse) {
      inFlight = false;
      if (disposed || !latest) return;
      if (latest.id === response.id) setResult({ input, request: latest, frame: response.frame });
      else dispatch();
    }
    function fallback() {
      worker?.terminate();
      worker = undefined;
      inFlight = false;
      dispatch();
    }
    try {
      worker = new ScatterWorker();
      worker.onmessage = ({ data }: MessageEvent<ScatterResponse>) => receive(data);
      worker.onerror = fallback;
      worker.onmessageerror = fallback;
      worker.postMessage({ kind: "prepare", input } satisfies ScatterRequest);
    } catch { fallback(); }
    send.current = request => {
      latest = { kind: "view", id: ++id, ...request };
      dispatch();
    };
    return () => {
      disposed = true;
      worker?.terminate();
      send.current = undefined;
    };
  }, [input]);

  useEffect(() => {
    if (columns && rows) send.current?.({ view, columns, rows });
  }, [input, view, columns, rows]);

  return {
    frame: result?.frame,
    busy: !result || result.input !== input || result.request.view !== view ||
      result.request.columns !== columns || result.request.rows !== rows,
  };
}
