import { sampleValue, type DenseLineColumn, type DenseLinePoint, type DenseLineRange } from "./data";
import { LodPyramid } from "./pitant/lod-pyramid";

export function prepareDenseLine(columns: readonly DenseLineColumn[], count: number) {
  const series = columns.map(column => {
    const length = Math.min(column.length, count);
    const samples = new BigInt64Array(length);
    const values = new Float64Array(length);
    const gaps = new Uint32Array(length + 1);
    let size = 0;
    for (let index = 0; index < length; index++) {
      const value = sampleValue(column, index);
      gaps[index + 1] = gaps[index] + Number(value === null);
      if (value === null) continue;
      samples[size] = BigInt(index);
      values[size++] = value;
    }
    const pyramid = new LodPyramid();
    pyramid.ingest(samples.subarray(0, size), values.subarray(0, size));
    return { column, length, gaps, pyramid };
  });

  return (range: DenseLineRange, width: number): DenseLinePoint[][] => series.map(({ column, length, gaps, pyramid }) => {
    const start = Math.max(0, Math.ceil(range[0]));
    const end = Math.min(length - 1, Math.floor(range[1]));
    if (end < start) return [];
    const points: DenseLinePoint[] = [];
    let last = -1;
    function add(index: number) {
      if (index <= last) return;
      // A skipped missing sample must still break the rendered line.
      if (last >= 0 && index > last + 1 && gaps[index] > gaps[last + 1]) {
        let firstMissing = last + 1;
        let upper = index;
        while (firstMissing < upper) {
          const mid = (firstMissing + upper) >>> 1;
          if (gaps[mid + 1] > gaps[last + 1]) upper = mid;
          else firstMissing = mid + 1;
        }
        points.push([firstMissing, null]);
      }
      points.push([index, sampleValue(column, index)]);
      last = index;
    }

    const result = pyramid.query(BigInt(start), BigInt(end), width);
    add(start);
    if (result.level === 0) {
      for (let i = 0; i < result.data.length; i += 2) add(result.data[i]);
    } else {
      let next = start;
      for (let i = 0; i < result.data.length; i += 4) {
        const first = result.data[i];
        const final = Math.min(end, result.data[i + 2]);
        // PITANT returns the bucket endpoints and its extrema. Recover the
        // positions from the original column and include clipped edge buckets.
        if (next < first) addExtrema(next, Math.min(end, first - 1));
        addExtrema(first, final, result.data[i + 1], result.data[i + 3]);
        next = final + 1;
      }
      if (next <= end) addExtrema(next, end);
    }
    add(end);
    return points;

    function addExtrema(first: number, final: number, knownMin?: number, knownMax?: number) {
      let min = Infinity, max = -Infinity;
      let minIndex = -1, maxIndex = -1;
      for (let index = first; index <= final; index++) {
        const value = sampleValue(column, index);
        if (value === null) continue;
        if (value < min) { min = value; minIndex = index; }
        if (value > max) { max = value; maxIndex = index; }
        if (min === knownMin && max === knownMax) break;
      }
      if (minIndex >= 0) {
        add(Math.min(minIndex, maxIndex));
        add(Math.max(minIndex, maxIndex));
      }
    }
  });
}

export type DenseLineQuery = ReturnType<typeof prepareDenseLine>;
