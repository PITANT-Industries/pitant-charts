/**
 * Adapted from shadcn/ui's chart-line-default, chart-area-default and
 * chart-bar-default registry examples. Copyright (c) 2023 shadcn, MIT.
 * See LICENSE-SHADCN.md in this directory.
 */
import { useEffect, useId, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, useActiveTooltipCoordinate, useActiveTooltipLabel, usePlotArea } from "recharts";
import type { CartesianData } from "./data";
import { colorFor, tint, type ChartTheme } from "./options";
import { lineDateLabel } from "./line-format";

export function ShadcnBasics({ family, data, theme, label }: {
  family: string;
  data: CartesianData;
  theme: ChartTheme;
  label: string;
}) {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    if (family !== "area") return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [family]);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const rows = data.categories.map((category, index) => Object.fromEntries([
    ["category", category],
    ...data.series.map((item, seriesIndex) => [`series${seriesIndex}`, item.values[index] ?? null]),
  ]));
  const colors = data.series.map((item, index) => colorFor(item, index, theme));
  const chartProps = { accessibilityLayer: true, data: rows, margin: { top: 5, left: 10, right: 12, bottom: 0 } };
  const grid = <CartesianGrid vertical={false} stroke={theme.grid} strokeDasharray="3 4" />;
  const axis = <XAxis dataKey="category" tickLine={false} axisLine={false} tickMargin={8} minTickGap={19}
    tick={{ fill: theme.muted, fontSize: 10 }} />;
  const tooltip = <Tooltip cursor={{ stroke: theme.muted, strokeDasharray: "3 3", fill: tint(theme.muted, 0.07) }}
    wrapperStyle={{ zIndex: 3 }} contentStyle={{ background: theme.surface, color: theme.text, borderColor: theme.grid, borderRadius: 8, fontSize: 12 }}
    labelStyle={{ color: theme.muted }} />;

  return (
    <div className="cartesian-shadcn" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        {family === "bar" ? (
          <BarChart {...chartProps}>
            {grid}
            {axis}
            {tooltip}
            {data.series.map((item, index) => <Bar key={index} dataKey={`series${index}`} name={item.name} fill={colors[index]} radius={[5, 5, 0, 0]} maxBarSize={38} animationDuration={520} />)}
          </BarChart>
        ) : family === "area" ? (
          <AreaChart {...chartProps} baseValue={0}>
            <defs>{colors.map((color, index) => <g key={index}>
              <linearGradient id={`${id}-area-${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} /><stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
              <linearGradient id={`${id}-area-stroke-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={color} stopOpacity={0} /><stop offset="15%" stopColor={color} />
                <stop offset="85%" stopColor={color} /><stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </g>)}</defs>
            {grid}
            <XAxis dataKey="category" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16}
              ticks={data.categories.length === 30 ? [0, 7, 15, 22, 29].map(index => data.categories[index]) : undefined}
              interval="preserveStartEnd" tick={{ fill: theme.muted, fontSize: 10 }} />
            {tooltip}
            {data.series.map((item, index) => <Area key={index} dataKey={`series${index}`} name={item.name} type="monotoneX"
              fill={`url(#${id}-area-${index})`} stroke={`url(#${id}-area-stroke-${index})`} strokeWidth={2} animationDuration={590} isAnimationActive={!reduceMotion}
              activeDot={{ fill: colors[index], stroke: theme.surface, strokeWidth: 1.5, r: 4 }} />)}
          </AreaChart>
        ) : (
          <LineChart {...chartProps}>
            {grid}
            {axis}
            <Tooltip cursor={{ stroke: theme.muted, strokeDasharray: "3 3" }} wrapperStyle={{ zIndex: 3 }}
              contentStyle={{ background: theme.surface, color: theme.text, borderColor: theme.grid, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: theme.muted }} labelFormatter={category => lineDateLabel(String(category))}
              formatter={value => typeof value === "number" ? value.toLocaleString("en") : value} />
            {data.series.map((item, index) => <Line key={index} dataKey={`series${index}`} name={item.name} type="monotoneX"
              stroke={colors[index]} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} animationDuration={590} />)}
            <DatePill theme={theme} />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function DatePill({ theme }: { theme: ChartTheme }) {
  const coordinate = useActiveTooltipCoordinate();
  const label = useActiveTooltipLabel();
  const plot = usePlotArea();
  if (!coordinate || label === undefined || !plot) return null;
  const width = 48;
  const center = Math.max(plot.x + width / 2, Math.min(plot.x + plot.width - width / 2, coordinate.x));
  return <g aria-hidden="true" pointerEvents="none" data-line-date-pill="">
    <rect x={center - width / 2} y={plot.y + plot.height + 5} width={width} height={18} rx={7} fill={theme.surface} stroke={theme.grid} />
    <text x={center} y={plot.y + plot.height + 18} textAnchor="middle" fill={theme.text} fontSize={10}>{label}</text>
  </g>;
}
