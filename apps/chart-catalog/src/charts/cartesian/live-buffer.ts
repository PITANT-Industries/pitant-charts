import type { LiveLineSample } from "../../types";

export class LiveBuffer {
  private readonly timestamps: Float64Array;
  private readonly values: Float64Array;
  private readonly labels: (string | undefined)[];
  private cursor = 0;
  private length = 0;
  private sequence = 0;

  constructor(readonly capacity: number) {
    this.timestamps = new Float64Array(capacity);
    this.values = new Float64Array(capacity);
    this.labels = new Array(capacity);
  }

  get count() { return this.length; }
  get nextSequence() { return this.sequence; }
  get firstSequence() { return this.sequence - this.length; }

  append(sample: LiveLineSample) {
    if (!Number.isFinite(sample.timestamp) || (this.length && sample.timestamp < this.timestamp(this.length - 1))) return;
    this.timestamps[this.cursor] = sample.timestamp;
    this.values[this.cursor] = sample.value !== null && Number.isFinite(sample.value) ? sample.value : NaN;
    this.labels[this.cursor] = sample.label;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.length = Math.min(this.length + 1, this.capacity);
    this.sequence++;
  }

  appendBatch(samples: readonly LiveLineSample[], minimum = -Infinity) {
    for (const sample of samples) if (sample.timestamp >= minimum) this.append(sample);
  }

  private slot(index: number) { return (this.cursor - this.length + index + this.capacity) % this.capacity; }
  value(index: number): number | null {
    if (index < 0 || index >= this.length) return null;
    const value = this.values[this.slot(index)];
    return Number.isNaN(value) ? null : value;
  }
  timestamp(index: number) { return this.timestamps[this.slot(index)]; }
  label(index: number) { return this.labels[this.slot(index)]; }

  nearest(timestamp: number) {
    if (!this.length) return -1;
    let first = 0, last = this.length - 1;
    while (first < last) {
      const middle = (first + last) >>> 1;
      if (this.timestamp(middle) < timestamp) first = middle + 1;
      else last = middle;
    }
    return first > 0 && timestamp - this.timestamp(first - 1) <= this.timestamp(first) - timestamp ? first - 1 : first;
  }

  drainTo(target: LiveBuffer) {
    for (let i = 0; i < this.length; i++) {
      const slot = this.slot(i);
      target.timestamps[target.cursor] = this.timestamps[slot];
      target.values[target.cursor] = this.values[slot];
      target.labels[target.cursor] = this.labels[slot];
      target.cursor = (target.cursor + 1) % target.capacity;
    }
    target.length = Math.min(target.capacity, target.length + this.length);
    target.sequence += this.sequence;
    this.labels.fill(undefined, 0, this.length < this.capacity ? this.cursor : this.capacity);
    this.length = this.cursor = this.sequence = 0;
  }

  copy() {
    const copy = new LiveBuffer(this.capacity);
    copy.timestamps.set(this.timestamps);
    copy.values.set(this.values);
    for (let i = 0; i < this.capacity; i++) copy.labels[i] = this.labels[i];
    copy.cursor = this.cursor;
    copy.length = this.length;
    copy.sequence = this.sequence;
    return copy;
  }
}

export function summarizeTrace(count: number, width: number, read: (index: number) => number | null) {
  const target = Math.max(1, Math.floor(width));
  const stride = Math.max(1, Math.ceil(count / target));
  const indices: number[] = [];
  let minimum = Infinity, maximum = -Infinity;
  let first = -1, last = -1, low = -1, high = -1;
  let lo = Infinity, hi = -Infinity;
  function flush() {
    if (first < 0) return;
    if (low > high) [low, high] = [high, low];
    for (const index of [first, low, high, last]) if (indices.at(-1) !== index) indices.push(index);
    first = last = low = high = -1;
    lo = Infinity; hi = -Infinity;
  }
  for (let i = 0; i < count; i++) {
    if (i % stride === 0) flush();
    const value = read(i);
    if (value === null || !Number.isFinite(value)) {
      flush();
      if (indices.length && indices.at(-1) !== -1) indices.push(-1);
      continue;
    }
    if (first < 0) first = i;
    last = i;
    if (value < lo) { lo = value; low = i; }
    if (value > hi) { hi = value; high = i; }
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
  }
  flush();
  return { indices, minimum, maximum };
}
