import { useEffect, useMemo, useState } from "react";
import type { LiveLineStream } from "../../types";
import { LiveBuffer } from "./live-buffer";
import { liveValue, type LivePreset } from "./live-fixtures";

const defaultCapacity = 4096;
const maximumCapacity = 1_000_000;

export function useLiveBuffer({ demo, preset, compact, connecting, reset, stream }: {
  demo: boolean;
  preset: LivePreset;
  compact: boolean;
  connecting: boolean;
  reset: number;
  stream?: LiveLineStream;
}) {
  const state = useMemo(() => {
    const requested = stream?.capacity ?? defaultCapacity;
    const capacity = demo ? preset.seed.length : !stream ? 1 : Math.min(maximumCapacity, Math.max(1, Number.isFinite(requested) ? Math.floor(requested) : defaultCapacity));
    const ring = new LiveBuffer(capacity);
    const epoch = Date.now();
    if (demo) {
      for (let i = 0; i < capacity; i++) {
        ring.append({ timestamp: epoch - (capacity - 1 - i) * preset.period, value: liveValue(i, preset) });
      }
    } else if (stream?.initialSamples) {
      ring.appendBatch(stream.initialSamples);
    }
    return { ring, epoch, seedCount: ring.count };
  }, [demo, preset, stream?.capacity, stream?.initialSamples, stream?.subscribe, reset]);
  const [published, setPublished] = useState<{ ring: LiveBuffer; revision: number; startedAt: number }>();
  useEffect(() => {
    if (connecting || (demo ? compact : !stream)) return;
    const { ring, epoch } = state;
    const pending = new LiveBuffer(ring.capacity);
    let frame = 0;
    let stopped = false;
    function flush() {
      frame = 0;
      pending.drainTo(ring);
      setPublished({ ring, revision: ring.nextSequence, startedAt: performance.now() });
    }
    function schedule() {
      if (!frame && pending.count) frame = requestAnimationFrame(flush);
    }
    let cleanup: () => void;
    if (demo) {
      let index = state.seedCount;
      const timer = window.setInterval(() => {
        pending.append({ timestamp: epoch + (index - state.seedCount + 1) * preset.period, value: liveValue(index++, preset) });
        schedule();
      }, preset.period);
      cleanup = () => window.clearInterval(timer);
    } else {
      cleanup = stream!.subscribe(samples => {
        if (stopped) return;
        pending.appendBatch(samples, ring.count ? ring.timestamp(ring.count - 1) : -Infinity);
        schedule();
      });
    }
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      cleanup();
    };
  }, [state, demo, stream, preset, compact, connecting]);

  return {
    ...state,
    frame: published?.ring === state.ring ? published : { revision: state.ring.nextSequence, startedAt: 0 },
  };
}
