import { useLayoutEffect, useRef } from "react";
import { useChartTheme } from "../theme";
import { Canvas2DRenderContext } from "../pitant/renderer/canvas2d-render-context";
import type { heatmapLayout } from "./heatmap-layout";

type Layout = ReturnType<typeof heatmapLayout>;
type Cell = NonNullable<ReturnType<Layout["cellAt"]>>;
type Props = {
  layout: Layout;
  left: number;
  width: number;
  active?: Cell;
  filtered: number | null;
  inactiveOpacity: number;
  dots: boolean;
  weekdays: boolean;
  stripes: boolean;
  mutedByFocus: boolean;
  scaled: boolean;
  instant: boolean;
  loading: boolean;
};

function readPalette(canvas: HTMLCanvasElement, stripe: boolean) {
  const probe = document.createElement("span");
  probe.hidden = true;
  canvas.parentElement?.append(probe);
  function color(value: string) {
    probe.style.color = value;
    return getComputedStyle(probe).color;
  }
  const colors = Array.from({ length: 5 }, (_, i) => color(`var(--heat-level-${i})`));
  const hatch = stripe ? color("color-mix(in oklch, var(--heat-level-2) 45%, white)") : "";
  probe.remove();
  const surface = stripe ? document.createElement("canvas") : undefined;
  if (surface) {
    surface.width = surface.height = 6;
    const ctx = surface.getContext("2d")!;
    ctx.fillStyle = colors[2];
    ctx.fillRect(0, 0, 6, 6);
    ctx.strokeStyle = hatch;
    ctx.beginPath();
    for (const [x, y] of [[-2, 1], [1, 4], [4, 7]]) {
      ctx.moveTo(x, y);
      ctx.lineTo(x + 3, y - 3);
    }
    ctx.stroke();
  }
  return { colors, surface };
}

export function HeatmapTiles(props: Props) {
  const { layout, left, width, active, filtered, inactiveOpacity, dots, weekdays, stripes, mutedByFocus, scaled, instant, loading } = props;
  const theme = useChartTheme();
  const ref = useRef<HTMLCanvasElement>(null);
  const backend = useRef<Canvas2DRenderContext>(undefined);
  const palette = useRef<ReturnType<typeof readPalette>>(undefined);

  useLayoutEffect(() => {
    if (!ref.current) return;
    const renderer = new Canvas2DRenderContext(ref.current);
    backend.current = renderer;
    return () => { renderer.dispose(); backend.current = undefined; };
  }, []);

  useLayoutEffect(() => {
    if (ref.current) palette.current = readPalette(ref.current, stripes);
  }, [theme, stripes]);

  useLayoutEffect(() => {
    const renderer = backend.current;
    const colors = palette.current;
    if (!renderer || !colors) return;
    const context = renderer.canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    if (renderer.width !== width || renderer.height !== layout.height || renderer.dpr !== dpr) renderer.resize(width, layout.height, dpr);
    const pattern = colors.surface ? context.createPattern(colors.surface, "repeat") : null;
    pattern?.setTransform(new DOMMatrix().translate(layout.paddingStart - left, layout.top - 2));
    const tile = (cell: Cell, scale: number, opacity: number) => {
      const w = layout.cellWidth * scale;
      const h = layout.cellHeight * scale;
      const paint = loading ? colors.colors[0] : cell.strength === 2 && pattern ? pattern : colors.colors[cell.strength];
      context.globalAlpha = opacity;
      renderer.drawTile(cell.x - left + (layout.cellWidth - w) / 2, cell.y + (layout.cellHeight - h) / 2, w, h, dots ? Math.min(w, h) / 2 : Math.min(2, w / 2, h / 2), paint);
    };
    const visible = layout.visibleCells(left, width);
    renderer.beginFrame();
    try {
      for (const cell of visible) {
        const muted = (filtered !== null && filtered !== cell.strength) || Boolean(active && mutedByFocus);
        const opacity = (weekdays && cell.row >= 5 ? .35 : 1) * (muted ? inactiveOpacity : 1);
        tile(cell, dots && muted ? .94 : 1, loading ? 1 : opacity);
      }
      if (active && !instant && active.x + layout.cellWidth * 1.1 >= left && active.x <= left + width) {
        tile(active, scaled ? 1.1 : 1, weekdays && active.row >= 5 ? .35 : 1);
      }
    } finally {
      renderer.endFrame();
    }
    renderer.canvas.dataset.heatPainted = String(visible.length);
    renderer.canvas.dataset.heatPaintedLeft = String(left);
  }, [layout, left, width, active, filtered, inactiveOpacity, dots, weekdays, stripes, mutedByFocus, scaled, instant, loading, theme]);

  return <canvas aria-hidden="true" className="stat-heatmap-tiles" ref={ref} style={{ width, height: layout.height }} />;
}
