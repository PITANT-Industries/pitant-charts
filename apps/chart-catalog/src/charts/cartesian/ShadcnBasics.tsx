/**
 * Adapted from shadcn/ui's chart-line-default, chart-area-default and
 * chart-bar-default registry examples. Copyright (c) 2023 shadcn, MIT.
 * See LICENSE-SHADCN.md in this directory.
 */
import { useId, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type BarShapeProps, useXAxisScale, useYAxisScale,
} from "recharts";
import type { CartesianData } from "./data";
import { colorFor, type ChartTheme } from "./options";
import { lineDateLabel } from "./line-format";
import { CartesianReadout } from "./CartesianFocus";
import { BasicFocusOverlay, BasicStrokeGradients, BasicTick, useBasicInspection } from "./basic-cartesian-focus";

const fixtureAxes = {
  line: { max: 10_000, grid: [0, 2000, 4000, 6000, 8000, 10_000] },
  area: { max: 28_000, grid: [0, 5000, 10_000, 15_000, 20_000, 25_000] },
  bar: { max: 24_000, grid: [0, 5000, 10_000, 15_000, 20_000] },
};
const dates = [0, 7, 15, 22, 29];

function BasicGrid({ color, values }: { color: string; values?: number[] }) {
  const scale = useYAxisScale();
  const horizontalPoints = values?.flatMap(value => {
    const y = scale?.(value);
    return y === undefined ? [] : [y];
  });
  return <CartesianGrid vertical={false} stroke={color} strokeDasharray="4 4" horizontalPoints={horizontalPoints} />;
}

function BasicBarMark({ x, y, width, height, fill, originalDataIndex, dismissed, fixture }: BarShapeProps & {
  dismissed: boolean;
  fixture: boolean;
}) {
  const active = useBasicInspection(dismissed);
  const scale = useXAxisScale();
  const center = fixture ? scale?.(originalDataIndex, { position: "middle" }) : undefined;
  return <rect x={center === undefined ? x : center - width / 2} y={height < 0 ? y + height : y} width={width} height={Math.abs(height)} rx={8} fill={fill}
    opacity={active === undefined || active === originalDataIndex ? 1 : 0.3} />;
}

export function ShadcnBasics({ family, data, theme, label, compact, fixture }: {
  family: string;
  data: CartesianData;
  theme: ChartTheme;
  label: string;
  compact: boolean;
  fixture: boolean;
}) {
  const [width, setWidth] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const kind = family === "bar" || family === "area" ? family : "line";
  const axisFixture = fixture ? fixtureAxes[kind] : undefined;
  const rows = data.categories.map((_, index) => Object.fromEntries([
    ["index", index],
    ...data.series.map((item, seriesIndex) => [`series${seriesIndex}`, item.values[index] ?? null]),
  ]));
  const colors = data.series.map((item, index) => colorFor(item, index, theme));
  const inset = compact ? 16 : 40;
  const axisHeight = compact ? 20 : 40;
  const chartProps = {
    accessibilityLayer: !compact,
    "aria-label": label,
    data: rows,
    margin: { top: inset, left: inset, right: inset, bottom: 0 },
  };
  // Reference bands have 20% inner and outer padding. Recharts already provides
  // half the inner gap at each end of the band scale.
  const barStep = Math.max(0, width - 2 * inset) / (data.categories.length + 0.2);
  const barInset = axisFixture && kind === "bar" ? barStep * 0.1 : 0;
  const fixtureTicks = axisFixture ? kind === "bar" ? data.categories.map((_, index) => index) : dates : undefined;
  const grid = <BasicGrid color={theme.grid} values={axisFixture?.grid} />;
  const yAxis = <YAxis hide domain={axisFixture ? [0, axisFixture.max] : [minimum => Math.min(minimum, 0), "auto"]} />;
  const xAxis = <XAxis dataKey="index" height={axisHeight} tickLine={false} axisLine={false}
    padding={{ left: barInset, right: barInset }} ticks={fixtureTicks} interval={fixtureTicks ? 0 : "preserveStartEnd"}
    tickMargin={compact ? 5 : 9} minTickGap={16} tickFormatter={index => data.categories[Number(index)] ?? ""}
    tick={props => <BasicTick {...props} categories={data.categories} color={theme.muted} compact={compact} dismissed={dismissed} />} />;
  const tooltip = !compact && <Tooltip cursor={false} active={dismissed ? false : undefined} position={{ y: inset }} offset={16}
    wrapperStyle={{ zIndex: 3 }} animationDuration={120} content={({ active, label: activeLabel }) => {
      const index = Number(activeLabel);
      const category = data.categories[index];
      if (!active || category === undefined) return null;
      const entries = data.series.flatMap(({ name, values }, seriesIndex) => {
        const value = values[index];
        return typeof value === "number" && Number.isFinite(value) ? [{ name, value, color: colors[seriesIndex] }] : [];
      });
      return entries.length ? <CartesianReadout label={kind === "bar" ? category : lineDateLabel(category)} entries={entries} /> : null;
    }} />;
  const focus = !compact && <BasicFocusOverlay kind={kind} data={data} colors={colors} theme={theme} id={id} dismissed={dismissed} />;
  const gradients = <BasicStrokeGradients id={id} colors={colors} isArea={kind === "area"}
    pointCount={data.categories.length} dismissed={dismissed} />;
  const barShape = (props: BarShapeProps) => <BasicBarMark {...props} dismissed={dismissed} fixture={fixture} />;
  const curveType = axisFixture && kind === "line" ? "natural" : "monotoneX";

  return (
    <div className="cartesian-shadcn" onPointerMove={() => setDismissed(false)} onBlur={() => setDismissed(false)}
      onKeyDownCapture={event => {
        if (event.key === "Escape" && event.currentTarget.querySelector("[data-line-date-pill]")) {
          event.preventDefault();
          event.stopPropagation();
          setDismissed(true);
        } else if (["ArrowLeft", "ArrowRight", "Enter"].includes(event.key)) setDismissed(false);
      }}>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} onResize={setWidth}>
        {kind === "bar" ? (
          <BarChart {...chartProps} barCategoryGap="10%">
            {grid}{yAxis}{xAxis}{tooltip}
            {data.series.map((item, index) => <Bar key={index} dataKey={`series${index}`} name={item.name} fill={colors[index]}
              barSize={axisFixture ? barStep * 0.8 : undefined} maxBarSize={axisFixture ? undefined : 110}
              shape={barShape} animationDuration={520} />)}
            {focus}
          </BarChart>
        ) : kind === "area" ? (
          <AreaChart {...chartProps} baseValue={0}>
            {gradients}{grid}{yAxis}{xAxis}{tooltip}
            {data.series.map((item, index) => <Area key={index} dataKey={`series${index}`} name={item.name} type="monotoneX"
              fill={`url(#${id}-area-${index})`} fillOpacity={1} stroke={`url(#${id}-stroke-${index})`} strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round"
              activeDot={false} animationDuration={590} />)}
            {focus}
          </AreaChart>
        ) : (
          <LineChart {...chartProps}>
            {gradients}{grid}{yAxis}{xAxis}{tooltip}
            {data.series.map((item, index) => <Line key={index} dataKey={`series${index}`} name={item.name} type={curveType}
              stroke={`url(#${id}-stroke-${index})`} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
              dot={false} activeDot={false} animationDuration={590} />)}
            {focus}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
