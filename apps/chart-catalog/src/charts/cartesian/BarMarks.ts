import type { CustomSeriesOption } from "echarts";
import type { CartesianData } from "./data";
import { colorFor, type ChartTheme } from "./options";

export function squareBars(data: CartesianData, theme: ChartTheme, active?: number): CustomSeriesOption[] {
  return data.series.map((item, index) => ({
    type: "custom",
    name: item.name,
    data: data.categories.map((_, i) => [i, item.values[i]]),
    encode: { x: 0, y: 1, tooltip: 1 },
    renderItem: (params, api) => {
      const category = Number(api.value(0)), value = Number(api.value(1));
      if (!Number.isFinite(value)) return;
      const plot = params.coordSys as unknown as { y: number; width: number; height: number };
      const [center, bottom] = api.coord([category, 0]), [, top] = api.coord([category, value]);
      const span = plot.width / Math.max(1, data.categories.length) * .8 / Math.max(1, data.series.length);
      const gap = data.series.length > 1 ? Math.min(4, span * .12) : 0;
      const width = Math.max(1, span - gap);
      const left = center + (index - data.series.length / 2) * span + gap / 2;
      const height = Math.abs(bottom - top);
      const squareGap = Math.min(4, width * .16);
      const color = colorFor(item, index > 0 ? index + 1 : index, theme);
      const light = active === undefined || active === index ? 1 : .22;
      const direction = value < 0 ? 1 : -1;
      const squareCount = Math.min(40, Math.ceil(height / (width + squareGap)));
      const unusedStart = value < 0 ? top + squareGap : plot.y;
      const unusedEnd = value < 0 ? plot.y + plot.height : top - squareGap;
      return { type: "group", children: [
        { type: "rect", silent: true, shape: { x: left, y: unusedStart, width, height: Math.max(0, unusedEnd - unusedStart), r: width / 4 },
          style: { fill: theme.grid, opacity: light * .5 } },
        ...Array.from({ length: squareCount }, (_, i) => {
          const offset = i * (width + squareGap);
          const size = Math.max(0, Math.min(width, height - offset));
          const percentage = 100 - (i + .5) / Math.max(1, squareCount) * 100;
          const fill = index === 0 ? `color-mix(in srgb, ${color} ${percentage}%, ${theme.colors[1]})` : color;
          return { type: "rect" as const, shape: { x: left, y: bottom + direction * (offset + (value < 0 ? 0 : size)), width, height: size, r: width / 4 },
            style: { fill, opacity: light } };
        }),
      ] };
    },
  }));
}
