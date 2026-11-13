import {
  Grid, Legend, NoData, PLOT, SvgPlot, createRandom, domain, format, linePath,
  linear, markEvents, number, percent, rows, string, ticks, useVariantLoading, type DemoProps,
} from "./primitives";

interface Estimate {
  label: string;
  value: number;
  low: number;
  high: number;
  innerLow?: number;
  innerHigh?: number;
}

function estimates(data: DemoProps["data"], mode: string): Estimate[] {
  if (data?.rows) {
    return rows(data).flatMap((row, index) => {
      const value = number(row.value) ?? number(row.y);
      if (value === undefined) return [];
      return [{
        label: string(row.label) ?? data.categories?.[index] ?? String(index + 1),
        value,
        low: Math.min(value, number(row.low) ?? value),
        high: Math.max(value, number(row.high) ?? value),
        innerLow: number(row.innerLow),
        innerHigh: number(row.innerHigh),
      }];
    });
  }
  if (data?.series) {
    return (data.series[0]?.values ?? []).flatMap((point, index) => {
      const value = number(point);
      if (value === undefined) return [];
      return [{
        label: data.categories?.[index] ?? String(index + 1),
        value,
        low: Math.min(value, number(data.series?.[1]?.values[index]) ?? value),
        high: Math.max(value, number(data.series?.[2]?.values[index]) ?? value),
        innerLow: number(data.series?.[3]?.values[index]),
        innerHigh: number(data.series?.[4]?.values[index]),
      }];
    });
  }
  const random = createRandom(2159);
  const time = mode === "uncertainty-forecast" || mode === "uncertainty-ribbon";
  const forest = mode === "uncertainty-forest";
  const names = forest ? ["Welcome", "Tutorial", "Reminder", "Invite", "Checklist", "Guided tour"]
    : time ? Array.from({ length: mode === "uncertainty-forecast" ? 12 : 30 }, (_, i) => mode === "uncertainty-forecast" ? new Date(2025, i, 1).toLocaleDateString("en", { month: "short" }) : `Day ${i + 1}`)
    : ["Control", "Variant A", "Variant B", "Variant C", "Variant D"];
  return names.map((label, index) => {
    const value = time ? 55 + 2 * index + Math.sin(index / 2) * 7 + random() * 5 : forest ? -.09 + index * .036 + (random() - .5) * .055 : .12 + index * .023 + (random() - .5) * .045;
    const spread = time ? mode === "uncertainty-forecast" ? Math.max(0, (index - 5) * 4) : 12 + 4 * random() : .029 + random() * .028;
    return { label, value, low: value - spread, high: value + spread, innerLow: value - spread * .55, innerHigh: value + spread * .55 };
  });
}

export function Uncertainty({ example, compact, data }: DemoProps) {
  const { loading, button } = useVariantLoading(example.id);
  const forest = example.id === "uncertainty-forest";
  const forecast = example.id === "uncertainty-forecast";
  const temporal = forecast || example.id === "uncertainty-ribbon";
  const items = estimates(data, example.id);
  if (!items.length) return <NoData example={example} compact={compact} />;
  const scale = domain(items.flatMap((item) => [item.low, item.high, item.innerLow ?? item.low, item.innerHigh ?? item.high, forest ? 0 : item.value]), .13);
  const p = linear(scale, forest ? [PLOT.left, PLOT.right] : [PLOT.bottom, PLOT.top]);
  const reference = forest ? 0 : items[0].value;
  const positions = items.map((_, index) => {
    const gap = forest ? (PLOT.bottom - PLOT.top) / items.length : (PLOT.right - PLOT.left) / items.length;
    return (forest ? PLOT.top : PLOT.left) + (index + .5) * gap;
  });
  const scaleTicks = ticks(scale, 5);
  const metric = (n: number) => !data && !temporal ? percent.format(n) : format.format(n);
  const color = "var(--chart-1)";
  const hints = items.map((item, index) => ({
    x: forest ? p(item.value) : positions[index], y: forest ? positions[index] : p(item.value),
    lines: [item.label, `Estimate: ${metric(item.value)}`, `Interval: ${metric(item.low)}–${metric(item.high)}`],
  }));
  const forecastStart = Math.max(0, Math.floor(items.length / 2) - 1);
  const line = (start: number, end: number) => linePath(items.slice(start, end).map((item, index) => [positions[start + index], p(item.value)]));
  const area = (inside: boolean) => {
    const start = forecast ? forecastStart : 0;
    const shown = items.slice(start);
    const upper = shown.map((point, index) => [positions[start + index], p(inside ? point.innerHigh ?? (point.value + point.high) / 2 : point.high)] as const);
    const lower = shown.map((point, index) => [positions[start + index], p(inside ? point.innerLow ?? (point.value + point.low) / 2 : point.low)] as const).reverse();
    return `${linePath(upper)} ${linePath(lower).replace("M", "L")}Z`;
  };
  const labels = items.map(({ label }, index) => temporal && index % (forecast ? 2 : 5) !== 0 ? "" : label);
  const legend = temporal && <Legend entries={[
    { name: forecast ? "Observed / Forecast" : "Median", color },
    { name: forecast ? "80% interval" : "25th–75th percentile", color: "color-mix(in srgb, var(--chart-1) 55%, transparent)" },
    { name: forecast ? "95% interval" : "10th–90th percentile", color: "color-mix(in srgb, var(--chart-1) 27%, transparent)" },
  ]} />;
  return (
    <SvgPlot example={example} compact={compact} hints={hints} loading={loading} controls={button} legend={legend}>
      {(show, active) => (
        <>
          <Grid
            x={forest ? scaleTicks.map(p) : positions} xLabels={forest ? scaleTicks.map(metric) : labels}
            y={forest ? positions : scaleTicks.map(p)} yLabels={forest ? labels : scaleTicks.map(metric)}
            hideVertical={!forest}
          />
          {!temporal && <path d={forest ? `M${p(reference)} ${PLOT.top}V${PLOT.bottom}` : `M${PLOT.left} ${p(reference)}H${PLOT.right}`} stroke="var(--muted-foreground)" strokeDasharray="5 5" />}
          {temporal ? (
            <>
              <path d={area(false)} fill={color} fillOpacity=".15" />
              <path d={area(true)} fill={color} fillOpacity=".27" />
              <path d={line(0, forecast ? forecastStart + 1 : items.length)} fill="none" stroke={color} strokeWidth="2.5" />
              {forecast && <path d={line(forecastStart, items.length)} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="6 4" />}
              {hints.map((hint, index) => <circle key={index} cx={hint.x} cy={hint.y} r={active === hint ? 5 : 7} fill={active === hint ? color : "transparent"} {...markEvents(hint, show)} />)}
            </>
          ) : items.map((item, index) => {
            const hint = hints[index];
            const offset = positions[index];
            const low = loading ? PLOT.bottom - 46 - (index % 3) * 18 : p(item.low);
            const high = loading ? low - 74 : p(item.high);
            const path = forest ? `M${low} ${offset}H${high}M${low} ${offset - 6}v12M${high} ${offset - 6}v12`
              : `M${offset} ${low}V${high}M${offset - 6} ${low}h12M${offset - 6} ${high}h12`;
            return (
              <g key={index} opacity={active && active !== hint ? .37 : 1} {...markEvents(hint, show, !loading)}>
                <path className={loading ? "stat-load" : undefined} d={path} fill="none" stroke={color} strokeWidth={active === hint ? 3.5 : 2.3} />
                <path d={path} fill="none" stroke="transparent" strokeWidth={20} />
                <circle className={loading ? "stat-load" : undefined} cx={hint.x} cy={loading ? (low + high) / 2 : hint.y} r={active === hint ? 6.8 : 5} fill={color} stroke="var(--background)" strokeWidth={1.7} />
              </g>
            );
          })}
        </>
      )}
    </SvgPlot>
  );
}
