import type { DenseLineColumn, DenseLinePoint, DenseLineRange } from "./data";
import { prepareDenseLine, type DenseLineQuery } from "./sampler";

export type SamplerRequest =
  | { type: "prepare"; columns: readonly DenseLineColumn[]; count: number }
  | { type: "query"; id: number; range: DenseLineRange; width: number };
export type SamplerResponse = { id: number; points: DenseLinePoint[][] };

let query: DenseLineQuery | undefined;
self.onmessage = ({ data }: MessageEvent<SamplerRequest>) => {
  if (data.type === "prepare") {
    query = prepareDenseLine(data.columns, data.count);
  } else if (query) {
    const result: SamplerResponse = { id: data.id, points: query(data.range, data.width) };
    self.postMessage(result);
  }
};
