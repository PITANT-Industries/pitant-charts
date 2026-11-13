/**
 * Adapted from shadcn/ui's chart-line-default, chart-area-default and
 * chart-bar-default registry examples. Copyright (c) 2023 shadcn, MIT.
 * See LICENSE-SHADCN.md in this directory.
 */
import { useId } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import type { CartesianData } from "./data";
import { colorFor, tint, type ChartTheme } from "./options";

export function ShadcnBasics({ family, data, theme, label }: {
  family: string;
  data: CartesianData;
  theme: ChartTheme;
  label: string;
}) {
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
          <AreaChart {...chartProps}>
            <defs>{colors.map((color, index) => <linearGradient key={index} id={`${id}-area-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.42} /><stop offset="100%" stopColor={color} stopOpacity={0.04} />
            </linearGradient>)}</defs>
            {grid}
            {axis}
            {tooltip}
            {data.series.map((item, index) => <Area key={index} dataKey={`series${index}`} name={item.name} type="natural"
              fill={`url(#${id}-area-${index})`} stroke={colors[index]} strokeWidth={2.2} animationDuration={590} />)}
          </AreaChart>
        ) : (
          <LineChart {...chartProps}>
            {grid}
            {axis}
            {tooltip}
            {data.series.map((item, index) => <Line key={index} dataKey={`series${index}`} name={item.name} type="natural"
              stroke={colors[index]} strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} animationDuration={590} />)}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
