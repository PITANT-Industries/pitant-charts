import type { ChartTheme } from "../../theme";
import { Canvas2DRenderContext } from "../../pitant/renderer/canvas2d-render-context";
import type { LineOptions } from "../../pitant/renderer/types";
import type { Bounds, ScatterFrame } from "./data";
import { day } from "./bounds";

const defaultInset = { left: 48, top: 22, right: 24, bottom: 39 };
const demoInset = { left: 40, top: 40, right: 40, bottom: 40 };
export const plotInsets = (example: boolean) => example ? demoInset : defaultInset;
export const axisDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const hourLabel = new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
const dateTime = new Intl.DateTimeFormat("en", {
  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3, hourCycle: "h23", timeZone: "UTC",
});
export const number = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
export const exact = (value: number) => String(value);
export const exactTime = (value: number) => `${dateTime.format(value)} UTC`;

export function project([left, right, low, high]: Bounds, width: number, height: number, inset = defaultInset) {
  const w = Math.max(1, width - inset.left - inset.right);
  const h = Math.max(1, height - inset.top - inset.bottom);
  return {
    w, h,
    x: (value: number) => inset.left + (value - left) / (right - left) * w,
    y: (value: number) => inset.top + (high - value) / (high - low) * h,
    at: (x: number, y: number) => [left + (x - inset.left) / w * (right - left), high - (y - inset.top) / h * (high - low)] as const,
  };
}

type Color = LineOptions["color"];
export function makeScatterPainter(canvas: HTMLCanvasElement) {
  const renderer = new Canvas2DRenderContext(canvas);
  const context = canvas.getContext("2d")!;
  const pixel = document.createElement("canvas");
  pixel.width = pixel.height = 1;
  const probe = pixel.getContext("2d", { willReadFrequently: true })!;
  const colors = new Map<string, Color>();
  function rgba(value: string): Color {
    const known = colors.get(value);
    if (known) return known;
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = "#000";
    probe.fillStyle = value;
    probe.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
    const color = [r / 255, g / 255, b / 255, a / 255] as const;
    if (colors.size >= 64) colors.clear();
    colors.set(value, color);
    return color;
  }
  function paint(frame: ScatterFrame | undefined, theme: ChartTheme, demo: boolean, compact: boolean) {
    const { width: w, height: h } = canvas.getBoundingClientRect();
    if (w < 1 || h < 1) return;
    if (w !== renderer.width || h !== renderer.height || renderer.dpr !== window.devicePixelRatio) renderer.resize(w, h);
    renderer.beginFrame();
    try {
      if (!frame) return;
      const { view } = frame;
      const inset = plotInsets(demo && !compact);
      const plot = project(view, w, h, inset);
      const line = new Float32Array(4);
      const label = { color: rgba(theme.muted), fontSize: demo ? 12 : 11, font: getComputedStyle(canvas).fontFamily } as const;
      context.setLineDash([4, 4]);
      for (let i = 0; i <= 5; i++) {
        const value = view[2] + (view[3] - view[2]) * i / 5;
        const y = plot.y(value);
        line.set([inset.left, y, inset.left + plot.w, y]);
        renderer.drawLines(line, { width: 1, color: rgba(theme.grid) });
        if (!compact) renderer.drawText(value === 1000 && demo ? "1k" : number.format(value), inset.left - 8, y, { ...label, align: "right", baseline: "middle" });
      }
      context.setLineDash([]);
      if (!compact) {
        const short = view[1] - view[0] < 2 * day;
        const fullDemo = demo && view.every((edge, index) => edge === frame.full[index]);
        const parts = w < 430 ? 3 : 4;
        const ticks = fullDemo ? [1, 3, 5, 7].map(offset => view[0] + offset * day)
          : Array.from({ length: parts + 1 }, (_, index) => view[0] + (view[1] - view[0]) * index / parts);
        for (const [i, value] of ticks.entries()) {
          const text = demo ? (short ? hourLabel : axisDate).format(value) : number.format(value);
          renderer.drawText(text, plot.x(value), inset.top + plot.h + 12, { ...label, align: fullDemo ? "center" : i === parts ? "right" : i === 0 ? "left" : "center" });
        }
      }
      context.save();
      try {
        context.beginPath();
        context.rect(inset.left, inset.top, plot.w, plot.h);
        context.clip();
        if (frame.mode === "density") {
          const [r, g, b, a] = rgba(theme.colors[0]);
          const max = Math.log1p(frame.peak);
          const cw = plot.w / frame.columns, ch = plot.h / frame.rows;
          for (let i = 0; i < frame.counts.length; i++) {
            const count = frame.counts[i];
            if (!count) continue;
            const x = inset.left + i % frame.columns * cw;
            const y = inset.top + (frame.rows - 1 - Math.floor(i / frame.columns)) * ch;
            renderer.drawRect(Math.round(x), Math.round(y), Math.round(x + cw) - Math.round(x), Math.round(y + ch) - Math.round(y),
              { fillColor: [r, g, b, a * (.13 + .77 * Math.log1p(count) / max)] });
          }
        } else {
          const palette = frame.groups.map(({ color }, i) => {
            const [r, g, b, a] = rgba(color ?? theme.colors[i % theme.colors.length]);
            return `rgba(${r * 255},${g * 255},${b * 255},${a * .52})`;
          });
          for (const point of frame.points) {
            renderer.drawCircle(plot.x(point.x), plot.y(point.y), compact ? 1 : 1.5, palette[point.group]);
          }
        }
      } finally { context.restore(); }
    } finally { renderer.endFrame(); }
  }
  return { paint, dispose: () => renderer.dispose() };
}
