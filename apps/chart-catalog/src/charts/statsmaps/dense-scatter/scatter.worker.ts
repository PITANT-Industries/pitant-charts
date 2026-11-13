import { prepareScatter, type ScatterRequest, type ScatterResponse } from "./data";

let query: ReturnType<typeof prepareScatter> | undefined;
self.onmessage = ({ data }: MessageEvent<ScatterRequest>) => {
  if (data.kind === "prepare") {
    query = prepareScatter(data.input);
  } else if (query) {
    const frame = query(data);
    const result: ScatterResponse = { id: data.id, frame };
    self.postMessage(result, { transfer: frame.mode === "density" ? [frame.counts.buffer] : [] });
  }
};
