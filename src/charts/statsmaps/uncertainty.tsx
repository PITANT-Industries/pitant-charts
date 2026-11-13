import type { CSSProperties, PointerEvent } from "react";
import {
  Grid, Legend, NoData, PLOT, SvgPlot, createRandom, domain, format, linePath,
  linear, markEvents, number, rows, string, ticks, useVariantLoading, type DemoProps,
} from "./primitives";

interface Estimate {
  label: string;
  value: number;
  low: number;
  high: number;
  innerLow?: number;
  innerHigh?: number;
}

const conversion = new Intl.NumberFormat("en", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat("en", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const day = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const month = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
const pointColor = "var(--chart-1)";
const rangeColor = "var(--chart-2)";

function sampleIntervals(labels: string[], intervals: number[][]) {
  return labels.map((label, index) => {
    const [value, low, high] = intervals[index];
    return { label, value, low, high };
  });
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
  if (mode === "uncertainty-forest") return sampleIntervals(
    ["Welcome checklist", "Sample project", "Invite prompt", "Product tour", "Email nudges", "Template gallery"],
    [[3.4, 1.7, 5.1], [2.1, .3, 3.9], [1.2, -1, 3.4], [-.4, -2.1, 1.3], [.8, -1.1, 2.7], [2.9, .6, 5.2]],
  );
  if (mode === "uncertainty-loading") return sampleIntervals(
    ["Free", "Starter", "Pro", "Team", "Enterprise"],
    [[3.3, 2.4, 4.2], [4.9, 3.8, 6], [6, 4.8, 7.2], [7.1, 5.8, 8.5], [8.2, 6.8, 9.7]],
  );
  if (mode === "uncertainty-forecast") return [412, 428, 435, 437, 458, 472, 484, 495, 506, 520, 531, 543].map((value, index) => {
    const spread = Math.max(0, index - 5) * (62 / 6);
    return { label: month.format(Date.UTC(2026, index, 1)), value, low: value - spread, high: value + spread, innerLow: value - spread * .59, innerHigh: value + spread * .59 };
  });
  if (mode === "uncertainty-ribbon") {
    const random = createRandom(2159);
    return Array.from({ length: 30 }, (_, index) => {
      const spike = Math.max(0, 1 - Math.abs(index - 17) / 3);
      const value = Math.round(176 + Math.sin(index * .7) * 12 + random() * 24 + spike * 44);
      return { label: day.format(Date.UTC(2026, 5, index + 1)), value, low: Math.round(value * .72), high: Math.round(value * 1.44 + spike * 29), innerLow: Math.round(value * .87), innerHigh: Math.round(value * 1.18 + spike * 13) };
    });
  }
  return sampleIntervals(["Control", "Shorter form", "Social proof", "Annual default", "Free trial"],
    [[.041, .037, .045], [.046, .042, .05], [.052, .048, .057], [.039, .035, .044], [.044, .04, .049]]);
}

export function Uncertainty({ example, compact, data }: DemoProps) {
  const { loading, button } = useVariantLoading(example.id);
  const forest = example.id === "uncertainty-forest";
  const forecast = example.id === "uncertainty-forecast";
  const temporal = forecast || example.id === "uncertainty-ribbon";
  const loadingExample = example.id === "uncertainty-loading";
  const items = estimates(data, example.id);
  if (!items.length) return <NoData example={example} compact={compact} />;
  const customScale = domain(items.flatMap((item) => [item.low, item.high, item.innerLow ?? item.low, item.innerHigh ?? item.high, forest ? 0 : item.value]), .13);
  const scale: [number, number] = data ? customScale : forest ? [-4, 6] : forecast ? [400, 650] : temporal ? [100, 350] : loadingExample ? [2, 12] : [.03, .06];
  const plotLeft = forest ? 152 : PLOT.left;
  const p = linear(scale, forest ? [plotLeft, PLOT.right] : [PLOT.bottom, PLOT.top]);
  const reference = forest ? 0 : items[0].value;
  const positions = items.map((_, index) => {
    if (temporal) return PLOT.left + (PLOT.right - PLOT.left) * index / Math.max(1, items.length - 1);
    const gap = forest ? (PLOT.bottom - PLOT.top) / items.length : (PLOT.right - PLOT.left) / items.length;
    return forest ? PLOT.bottom - (index + .5) * gap : PLOT.left + (index + .5) * gap;
  });
  const scaleTicks = ticks(scale, data ? 5 : temporal || forest || loadingExample ? 6 : 7);
  const metric = (n: number) => data ? format.format(n) : forest ? `${n > 0 ? "+" : ""}${decimal.format(n)} pts`
    : forecast ? `$${format.format(n)}k` : temporal ? `${format.format(n)} ms` : loadingExample ? `${decimal.format(n)} min` : conversion.format(n);
  const forecastStart = Math.max(0, Math.floor(items.length / 2) - 1);
  const interval = (low: number, high: number) => `${metric(low)} – ${metric(high)}`;
  const innerLow = (point: Estimate) => point.innerLow ?? (point.value + point.low) / 2;
  const innerHigh = (point: Estimate) => point.innerHigh ?? (point.value + point.high) / 2;
  const hints = items.map((item, index) => ({
    x: forest ? p(item.value) : positions[index], y: forest ? positions[index] : p(item.value),
    lines: forecast ? [item.label, ...(index <= forecastStart ? [`Actual: ${metric(item.value)}`] : []),
      ...(index >= forecastStart ? [`Forecast: ${metric(item.value)}`, `95% interval: ${interval(item.low, item.high)}`, `80% interval: ${interval(innerLow(item), innerHigh(item))}`] : [])]
      : temporal ? [item.label, `Median: ${metric(item.value)}`, `10th–90th: ${interval(item.low, item.high)}`, `25th–75th: ${interval(innerLow(item), innerHigh(item))}`]
      : [item.label, `${forest ? "Effect" : loadingExample ? "Session length" : "Conversion"}: ${metric(item.value)}`, `${forest ? "90% interval" : "95% CI"}: ${interval(item.low, item.high)}`],
  }));
  const line = (start: number, end: number) => linePath(items.slice(start, end).map((item, index) => [positions[start + index], p(item.value)]));
  const area = (inside: boolean) => {
    const start = forecast ? forecastStart : 0;
    const shown = items.slice(start);
    const upper = shown.map((point, index) => [positions[start + index], p(inside ? innerHigh(point) : point.high)] as const);
    const lower = shown.map((point, index) => [positions[start + index], p(inside ? innerLow(point) : point.low)] as const).reverse();
    return `${linePath(upper)} ${linePath(lower).replace("M", "L")}Z`;
  };
  const labels = items.map(({ label }, index) => temporal && (forecast ? index % 3 !== 0 : (index + 1) % 7 !== 0) ? "" : label);
  const legend = temporal && <Legend entries={[
    { name: forecast ? "Actual" : "Median", color: pointColor },
    ...(forecast ? [{ name: "Forecast", color: rangeColor }] : []),
    { name: forecast ? "80% interval" : "25th–75th percentile", color: `color-mix(in srgb, ${forecast ? rangeColor : pointColor} 55%, transparent)` },
    { name: forecast ? "95% interval" : "10th–90th percentile", color: `color-mix(in srgb, ${forecast ? rangeColor : pointColor} 27%, transparent)` },
  ]} />;
  function nearest(event: PointerEvent<SVGRectElement>) {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const pointer = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return hints.reduce((best, hint) => Math.abs(hint.x - pointer.x) < Math.abs(best.x - pointer.x) ? hint : best);
  }
  return (
    <SvgPlot example={example} compact={compact} hints={hints} loading={loading} controls={button} legend={legend} loadingLabel="Loading estimates">
      {(show, active) => (
        <>
          <Grid
            x={forest ? scaleTicks.map(p) : positions} xLabels={forest ? scaleTicks.map(metric) : labels}
            y={forest ? undefined : scaleTicks.map(p)} yLabels={forest ? undefined : scaleTicks.map(metric)}
            hideVertical={!forest} horizontalLabelsAtTop={forest}
          />
          {forest && positions.map((position, index) => <text key={index} className="stat-axis" x={plotLeft - 9} y={position + 4} textAnchor="end">{labels[index]}</text>)}
          {!temporal && <path d={forest ? `M${p(reference)} ${PLOT.top}V${PLOT.bottom}` : `M${PLOT.left} ${p(reference)}H${PLOT.right}`} stroke="var(--muted-foreground)" strokeDasharray="5 5" />}
          {temporal ? (
            <>
              <path d={area(false)} data-interval={forecast ? "95" : "10–90"} fill={forecast ? rangeColor : pointColor} fillOpacity=".17" />
              <path d={area(true)} data-interval={forecast ? "80" : "25–75"} fill={forecast ? rangeColor : pointColor} fillOpacity=".27" />
              <path d={line(0, forecast ? forecastStart + 1 : items.length)} fill="none" stroke={pointColor} strokeWidth="2.5" />
              {forecast && <path d={line(forecastStart, items.length)} data-forecast="true" fill="none" stroke={rangeColor} strokeWidth="2.5" strokeDasharray="5 5" />}
              {active && <><path d={`M${active.x} ${PLOT.top}V${PLOT.bottom}`} fill="none" stroke="var(--muted-foreground)" strokeDasharray="4 4" opacity=".5" /><circle cx={active.x} cy={active.y} r="5" fill={forecast && active.x > positions[forecastStart] ? rangeColor : pointColor} stroke="var(--background)" strokeWidth="1.5" /></>}
              {!compact && <rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} fill="transparent" onPointerMove={(event) => show(nearest(event))} onPointerLeave={() => show(null)} />}
            </>
          ) : items.map((item, index) => {
            const hint = hints[index];
            const offset = positions[index];
            const low = loading ? PLOT.bottom - 46 - (index % 3) * 18 : p(item.low);
            const high = loading ? low - 56 : p(item.high);
            const color = forest ? rangeColor : pointColor;
            const path = forest ? `M${low} ${offset}H${high}M${low} ${offset - 6}v12M${high} ${offset - 6}v12`
              : `M${offset} ${low}V${high}M${offset - 6} ${low}h12M${offset - 6} ${high}h12`;
            return (
              <g key={index} data-interval-mark={item.label} opacity={active && active !== hint ? .37 : 1} {...markEvents(hint, show, !loading)}>
                <g className={!loading && loadingExample ? "stat-interval-reveal" : undefined} style={{ "--interval-origin": `${offset}px ${low}px`, "--stat-delay": `${index * 38}ms` } as CSSProperties}>
                <path className={loading ? "stat-load" : undefined} d={path} fill="none" stroke={color} strokeWidth={active === hint ? 3.5 : 2.3} />
                <path d={path} fill="none" stroke="transparent" strokeWidth={20} />
                <circle className={loading ? "stat-load" : undefined} cx={hint.x} cy={loading ? (low + high) / 2 : hint.y} r={active === hint ? 6.8 : 5} fill={color} stroke="var(--background)" strokeWidth={1.7} />
                </g>
              </g>
            );
          })}
        </>
      )}
    </SvgPlot>
  );
}
