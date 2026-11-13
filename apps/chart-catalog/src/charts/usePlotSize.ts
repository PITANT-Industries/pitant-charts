import { useEffect, useRef, useState } from "react";

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
