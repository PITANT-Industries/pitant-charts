import { Toggle } from "@ui-sdk/react/toggle";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { nextChartFocus, percent } from "./shared";
import styles from "./styles.module.css";

export function usePlotSize<T extends Element>(initialWidth: number, initialHeight: number) {
  const plot = useRef<T>(null);
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    function measure(width: number, height: number) {
      if (width < 1 || height < 1) return;
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    }
    const rect = element.getBoundingClientRect();
    measure(rect.width, rect.height);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width, entry.contentRect.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { plot, ...size };
}

export function useChartLoading(id: string, compact: boolean | undefined) {
  const hasDemo = id.endsWith("-loading");
  const [loading, setLoading] = useState(hasDemo);
  const control = hasDemo && !compact ? <div className={styles.controls}>
    <Toggle className={styles.control} pressed={loading} onPressedChange={setLoading}>Loading</Toggle>
  </div> : null;
  return { loading, hasDemo, control };
}

export function selectMark(event: KeyboardEvent<SVGSVGElement>, active: number | null, count: number, update: (next: number | null) => void) {
  if (event.key === "Escape" && active !== null) {
    event.preventDefault();
    event.stopPropagation();
    update(null);
    return;
  }
  const index = nextChartFocus(event.key, active, count);
  if (index === undefined) return;
  event.preventDefault();
  update(index);
}

export function hierarchyShare(value: number, total: number) {
  const percentage = percent(value, total);
  return `${percentage < 10 && percentage > 0 ? percentage.toPrecision(2) : Math.round(percentage)}%`;
}
