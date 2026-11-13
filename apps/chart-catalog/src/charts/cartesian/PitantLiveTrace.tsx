import { area, curveMonotoneX, line } from "d3-shape";
import { memo, useLayoutEffect, useRef } from "react";
import type { ChartTheme } from "../theme";
import { Canvas2DRenderContext } from "../pitant/renderer/canvas2d-render-context";

type Props = {
  width: number;
  height: number;
  top: number;
  bottom: number;
  color: string;
  theme: ChartTheme;
  fill: boolean;
  indices: readonly number[];
  valueAt: (index: number) => number | null;
  x: (index: number) => number;
  y: (value: number) => number;
};

export const PitantLiveTrace = memo(function PitantLiveTrace({ width, height, top, bottom, color, theme, fill, indices, valueAt, x, y }: Props) {
  const surface = useRef<HTMLCanvasElement>(null);
  const backend = useRef<Canvas2DRenderContext | null>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const palette = useRef<{ color: string; resolved: string; theme: ChartTheme }>(undefined);
  useLayoutEffect(() => {
    if (!surface.current) return;
    const renderer = new Canvas2DRenderContext(surface.current);
    backend.current = renderer;
    return () => { renderer.dispose(); backend.current = null; };
  }, []);
  useLayoutEffect(() => {
    const renderer = backend.current;
    const canvas = surface.current;
    if (!renderer || !canvas) return;
    const context = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    if (renderer.width !== width || renderer.height !== height || renderer.dpr !== dpr) renderer.resize(width, height, dpr);
    if (!palette.current || palette.current.color !== color || palette.current.theme !== theme) {
      palette.current = { color, theme, resolved: probe.current ? getComputedStyle(probe.current).color : color };
    }
    const { resolved } = palette.current;

    // d3-shape uses the path methods that Path2D and Canvas2D share.
    const trace = new Path2D();
    const hasValue = (i: number) => i >= 0 && valueAt(i) !== null;
    const ordinate = (i: number) => y(valueAt(i) ?? 0);
    line<number>().defined(hasValue).x(x).y(ordinate).curve(curveMonotoneX).context(trace as unknown as CanvasRenderingContext2D)(indices);
    renderer.beginFrame();
    try {
      if (fill) {
        const shape = new Path2D();
        area<number>().defined(hasValue).x(x).y0(bottom).y1(ordinate).curve(curveMonotoneX).context(shape as unknown as CanvasRenderingContext2D)(indices);
        const gradient = context.createLinearGradient(0, top, 0, bottom);
        gradient.addColorStop(0, `color-mix(in srgb, ${resolved} 16%, transparent)`);
        gradient.addColorStop(1, "transparent");
        renderer.paintPath(shape, gradient, "fill");
      }
      const gradient = context.createLinearGradient(0, top, 0, bottom);
      gradient.addColorStop(0, resolved);
      gradient.addColorStop(1, `color-mix(in srgb, ${resolved} 60%, transparent)`);
      renderer.paintPath(trace, gradient, "stroke", 2);
    } finally {
      renderer.endFrame();
    }
  }, [width, height, top, bottom, color, theme, fill, indices, valueAt, x, y]);
  return <foreignObject x="0" y="0" width={width} height={height} pointerEvents="none" aria-hidden="true" data-live-line="">
    <span ref={probe} style={{ color }} hidden />
    <canvas className="live-line-canvas" ref={surface} data-live-area={fill ? "" : undefined} />
  </foreignObject>;
});
