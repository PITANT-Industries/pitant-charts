import { useState, type CSSProperties, type PointerEvent } from "react";
import { Toggle } from "@ui-sdk/react/toggle";
import {
  Grid, Legend, NoData, PLOT, SvgPlot, createRandom, domain, format, linePath, linear,
  markEvents, minMax, normal, percent, quantile, sampleSeries, ticks, useVariantLoading,
  type DemoProps,
} from "./primitives";
import { distributionStatistics, estimate } from "./simplify-statistics";

const themeColor = (index: number) => `var(--chart-${index % 8 + 1})`;
const regionNames = ["US East", "EU West", "Asia Pacific", "South America"];
const deployTeams = ["Platform", "Mobile", "Search", "Payments"];
const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const cumulativePercent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });
const precise = new Intl.NumberFormat("en", { maximumFractionDigits: 2 });
const checkoutBins = [1, 6, 10, 24, 23, 27, 22, 23, 21, 20, 15, 8, 11, 5, 2, 4, 4, 0, 7, 0, 3, 1, 0, 0, 1, 0, 0, 1, 1];

function positiveSamples(center: number, spread: number, count: number, seed: number, floor: number, ceiling: number) {
  const random = createRandom(seed);
  return Array.from({ length: count }, () => Math.round(Math.max(floor, Math.min(ceiling, center * Math.exp(normal(random) * spread))) * 10) / 10).sort((a, b) => a - b);
}

function deploySamples() {
  return deployTeams.map((name, index) => ({ name, color: themeColor(1), values: positiveSamples([7.6, 14.7, 7.9, 11.6][index], [.38, .48, .32, .41][index], 32, 3733 + index, 2, 39) }));
}

function regionalSamples(grouped: boolean) {
  return regionNames.flatMap((name, index) => (grouped ? ["Desktop", "Mobile"] : [name]).map((series, seriesIndex) => {
    const center = grouped ? [725, 875, 1212, 1383][index] * (seriesIndex === 1 ? 1.55 : 1) : [851, 948, 1251, 1715][index];
    const spread = [.26, .36, .39, .49][index] + (seriesIndex === 1 ? .11 : 0);
    const values = positiveSamples(center, spread, grouped ? 60 : 90, 9157 + index * 71 + seriesIndex * 101, 250, grouped ? 5950 : 4970);
    if (!grouped) values[values.length - 1] = Math.max(values[values.length - 1], Math.min(4950, center * 2.95));
    values.sort((a, b) => a - b);
    return { region: name, name: series, seriesIndex: grouped && seriesIndex === 1 ? 2 : 0, values };
  }));
}

function sessionRidges() {
  return monthNames.map((name, index) => {
    const random = createRandom(6317 + index);
    const values = Array.from({ length: 120 }, (_, i) => {
      const briefVisit = i < 39;
      const value = (briefVisit ? 6.6 + index * .43 : 18 + index * 1.8) + normal(random) * (briefVisit ? 1.8 : 4.1 + index * .33);
      return Math.max(.3, Math.min(48, value));
    }).sort((a, b) => a - b);
    return { name, color: undefined, values };
  });
}

function requestFixtures(names: readonly string[], sessions = false) {
  return names.map((name, index) => {
    const random = createRandom(2914 + index);
    const center = sessions ? name === "Mobile" ? 7 : 14 : name === "Before" ? 323 : 208;
    const dispersion = sessions ? .57 : name === "Before" ? .47 : .41;
    const after = !sessions && name !== "Before";
    const values = Array.from({ length: sessions ? 200 : 240 }, () => {
      const sample = Math.round(center * Math.exp(normal(random) * dispersion));
      return after ? Math.max(73, Math.min(632, sample)) : sample;
    })
      .sort((a, b) => a - b);
    if (after) {
      values[0] = 73;
      values[values.length - 1] = 632;
    }
    return { name, color: undefined, values };
  });
}

export function Histogram({ example, compact, data }: DemoProps) {
  const loadingVariant = example.id === "histogram-loading";
  const fixtureBins = loadingVariant && !data ? checkoutBins : undefined;
  const { loading, button } = useVariantLoading(example.id, loadingVariant ? "Loading" : undefined);
  const overlay = example.id === "histogram-overlay";
  const stacked = example.id === "histogram-stacked";
  const names = overlay ? ["Before", "After"] : stacked ? ["Mobile", "Desktop"] : ["Requests"];
  const sets = data ? sampleSeries(data, []) : requestFixtures(names, stacked);
  const [hidden, setHidden] = useState<string[]>([]);
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);
  if (!sets.length) return <NoData example={example} compact={compact} />;
  const [dataMin, dataMax] = minMax(sets.flatMap(({ values }) => values));
  const step = stacked ? 2 : overlay ? 50 : 20;
  const min = data ? dataMin : fixtureBins ? 60 : stacked ? 0 : Math.floor(dataMin / step) * step;
  const max = data ? dataMax : fixtureBins ? 640 : stacked ? 40 : Math.ceil(dataMax / step) * step;
  const count = data ? 16 : Math.max(1, Math.round((max - min) / step));
  const width = (max - min) / count;
  const x = linear([min, max], [PLOT.left, PLOT.right]);
  const tickStep = stacked ? 10 : overlay ? 200 : 100;
  const xTicks = data ? ticks([min, max], 6) : Array.from({ length: Math.floor(max / tickStep) + 1 }, (_, index) => index * tickStep).filter((value) => value >= min);
  const unit = data ? "" : stacked ? " min" : " ms";
  const axisLabel = (value: number) => `${format.format(value)}${unit}`;
  const bins = fixtureBins ? [fixtureBins] : sets.map(({ values }) => {
    const histogram = new Array<number>(count).fill(0);
    values.forEach((value) => {
      if (value < min || value > max) return;
      histogram[Math.min(count - 1, Math.max(0, Math.floor((value - min) / width)))]++;
    });
    return histogram;
  });
  const visible = sets.map(({ name }) => !hidden.includes(name));
  const maximum = Math.max(1, ...bins[0].map((_, index) => {
    const counts = bins.map((set, setIndex) => visible[setIndex] ? set[index] : 0);
    return stacked ? counts.reduce((sum, value) => sum + value, 0) : Math.max(...counts);
  }));
  const y = linear([0, fixtureBins ? 30 : maximum * 1.1], [PLOT.bottom, PLOT.top]);
  const yTicks = fixtureBins ? [0, 5, 10, 15, 20, 25, 30] : ticks([0, maximum], 5);
  const barWidth = (PLOT.right - PLOT.left) / count;
  const positions = new Array<number>(count).fill(0);
  const bars = sets.flatMap(({ name, color }, seriesIndex) => {
    if (!visible[seriesIndex]) return [];
    return bins[seriesIndex].map((value, binIndex) => {
      const base = stacked ? positions[binIndex] : 0;
      positions[binIndex] += value;
      const bx = x(min + binIndex * width) + 1;
      const by = y(base + value);
      const displayHeight = loading ? 24 + 122 * Math.sin(Math.PI * (binIndex + 1) / (count + 2)) ** 2 : y(base) - by;
      return { x: bx, y: loading ? PLOT.bottom - displayHeight : by, height: displayHeight, name,
        color: color ?? themeColor(seriesIndex), value,
        hint: { x: bx + barWidth / 2, y: by, lines: [fixtureBins
          ? `${axisLabel(min + binIndex * width)} – ${axisLabel(min + (binIndex + 1) * width)}`
          : `${format.format(min + binIndex * width)}–${axisLabel(min + (binIndex + 1) * width)}`, `${name}: ${value}`] },
        binIndex,
        key: `${seriesIndex}-${binIndex}`,
      };
    });
  });
  const toggle = (name: string) => setHidden((prev) => prev.includes(name) ? prev.filter((entry) => entry !== name) : [...prev, name]);
  const legend = fixtureBins && !loading && !compact ? <p className="stat-map-summary">Median response 208 ms, p90 354 ms</p>
    : overlay && sets.length > 1 ? <div className="stat-legend" aria-label="Median response">
    <span>Median response</span>
    {sets.map(({ name, color, values }, i) => <Toggle key={name} aria-label={name} pressed={visible[i]} disabled={compact} onPointerEnter={() => setHoveredSeries(name)} onPointerLeave={() => setHoveredSeries(null)} onFocus={() => setHoveredSeries(name)} onBlur={() => setHoveredSeries(null)} onPressedChange={() => toggle(name)}>
      <i style={{ background: color ?? themeColor(i) }} aria-hidden="true" /> {name} <strong>{axisLabel(quantile(values, .5))}</strong>
    </Toggle>)}
  </div> : sets.length > 1 && (
    <Legend
      entries={sets.map(({ name, color }, i) => ({ name, color: color ?? themeColor(i) }))}
      active={sets.filter((_, i) => visible[i]).map(({ name }) => name)}
      onToggle={compact ? undefined : toggle}
    />
  );
  return (
    <SvgPlot example={example} compact={compact} hints={bars.filter(({ value }) => value > 0 || !fixtureBins).map(({ hint }) => hint)} loading={loading} loadingLabel={loadingVariant ? "Loading requests" : undefined} controls={button} legend={legend}>
      {(show, active) => (
        <>
          <Grid x={xTicks.map(x)} xLabels={xTicks.map(axisLabel)} y={yTicks.map(y)} yLabels={yTicks.map((value) => format.format(value))} xTitle={data ? "Sample value" : undefined} yTitle={data ? "Frequency" : undefined} hideVertical />
          {bars.filter(({ value }) => loading || value > 0 || !fixtureBins).map((bar) => (
            <rect
              key={`${bar.key}-${loading}`}
              data-series={bar.name}
              data-histogram-count={bar.value}
              className={loading ? "stat-load" : loadingVariant ? "stat-interval-reveal" : undefined}
              style={loadingVariant && !loading ? { "--interval-origin": `0px ${PLOT.bottom}px`, "--stat-delay": `${bar.binIndex * 19}ms` } as CSSProperties : undefined}
              x={bar.x}
              y={bar.y}
              width={barWidth - 2}
              height={Math.max(0, bar.height)}
              fill={bar.color}
              rx={3}
              opacity={hoveredSeries && hoveredSeries !== bar.name ? .18 : active && active !== bar.hint ? .42 : overlay ? .63 : .9}
              {...markEvents(bar.hint, show, !loading)}
            />
          ))}
        </>
      )}
    </SvgPlot>
  );
}

export function Ecdf({ example, compact, data }: DemoProps) {
  const { loading, button } = useVariantLoading(example.id);
  const [hidden, setHidden] = useState<string[]>([]);
  const compare = example.id === "ecdf-compare";
  const sets = data ? sampleSeries(data, []) : requestFixtures(compare ? ["Before", "After"] : ["Requests"]);
  if (!sets.length) return <NoData example={example} compact={compact} />;
  const samples = sets.flatMap(({ values }) => values);
  const extent = minMax(samples);
  const [min, max] = data ? domain(samples, .04) : [0, Math.max(800, Math.ceil(extent[1] / 200) * 200)];
  const x = linear([min, max], [PLOT.left, PLOT.right]);
  const y = linear([0, 1], [PLOT.bottom, PLOT.top]);
  const xTicks = data ? ticks([min, max], 5) : Array.from({ length: Math.round(max / 200) + 1 }, (_, index) => index * 200);
  const yTicks = ticks([0, 1], 6);
  const axisLabel = (value: number) => `${format.format(value)}${data ? "" : " ms"}`;
  const graphs = sets.map(({ name, color, values }, i) => {
    const start: [number, number] = [x(min), y(0)];
    const points: [number, number][] = [start];
    values.forEach((value, index) => {
      const share = (index + 1) / values.length;
      points.push([x(value), y(index / values.length)], [x(value), y(share)]);
    });
    points.push([x(max), y(1)]);
    return { name, path: linePath(points), color: color ?? themeColor(i), values };
  }).filter(({ name }) => !hidden.includes(name));
  const legend = sets.length > 1 && <Legend
    entries={sets.map(({ name, color }, i) => ({ name, color: color ?? themeColor(i) }))}
    active={graphs.map(({ name }) => name)}
    onToggle={compact ? undefined : (name) => setHidden((prev) => prev.includes(name) ? prev.filter((entry) => entry !== name) : [...prev, name])}
  />;
  const thresholds = [...new Set(graphs.flatMap(({ values }) => values))].sort((a, b) => a - b);
  const proportion = (values: readonly number[], threshold: number) => {
    let lower = 0;
    let upper = values.length;
    while (lower < upper) {
      const middle = Math.floor((lower + upper) / 2);
      if (values[middle] <= threshold) lower = middle + 1;
      else upper = middle;
    }
    return lower / values.length;
  };
  const hints = thresholds.map((threshold) => {
    const groups = graphs.map(({ name, values, color }) => ({ name, color, value: proportion(values, threshold) }));
    return {
      x: x(threshold), y: y(Math.max(...groups.map(({ value }) => value))), groups,
      lines: [`≤ ${axisLabel(threshold)}`, ...groups.map(({ name, value }) => `${name}: ${cumulativePercent.format(value)}`)],
    };
  });
  const marks = compare ? [.9] : [.5, .9];
  const placeholder = Array.from({ length: 10 }, (_, index) => {
    const position = x(min + (max - min) * (index + 1) / 10);
    return `H${position}V${y(Math.min(1, (index + 1) / 10))}`;
  }).join("");
  function nearestThreshold(event: PointerEvent<SVGRectElement>) {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix || !hints.length) return null;
    const { x } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return hints.reduce((closest, hint) => Math.abs(hint.x - x) < Math.abs(closest.x - x) ? hint : closest);
  }
  return (
    <SvgPlot example={example} compact={compact} hints={hints} loading={loading} controls={button} legend={legend}>
      {(show, active, id) => (
        <>
          <defs>
            <linearGradient id={`${id}-cdf`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={themeColor(0)} stopOpacity=".29" /><stop offset="100%" stopColor={themeColor(0)} stopOpacity=".04" /></linearGradient>
            <clipPath id={`${id}-reveal`}><rect className="stat-ecdf-reveal" x={PLOT.left - 2} y={PLOT.top - 2} width={PLOT.right - PLOT.left + 4} height={PLOT.bottom - PLOT.top + 4} /></clipPath>
          </defs>
          <Grid x={xTicks.map(x)} xLabels={xTicks.map(axisLabel)} y={yTicks.map(y)} yLabels={yTicks.map((value) => percent.format(value))} xTitle={data ? "Sample value" : undefined} yTitle={data ? "Cumulative share" : undefined} hideVertical />
          {loading ? <path d={`M${x(min)} ${y(0)}${placeholder}`} fillOpacity={0} className="stat-load" strokeWidth={5} /> : (
            <>
              <g clipPath={example.id === "ecdf-loading" ? `url(#${id}-reveal)` : undefined}>
                {graphs.map((graph) => <g key={graph.name}>
                  {!compare && <path d={`${graph.path}L${x(max)} ${y(0)}Z`} fill={`url(#${id}-cdf)`} />}
                  <path d={graph.path} fill="none" stroke={graph.color} strokeWidth={2.8} strokeLinejoin="round" />
                </g>)}
              </g>
              {graphs.length > 0 && marks.map((p) => <g key={p}>
                <text className="stat-axis" x={PLOT.left - 9} y={y(p) + 3} textAnchor="end">p{Math.round(p * 100)}</text>
                <path d={`M${PLOT.left} ${y(p)}H${Math.max(...graphs.map(({ values }) => x(quantile(values, p))))}`} fill="none" stroke={themeColor(0)} opacity=".55" strokeDasharray="5 4" />
                {graphs.map(({ name, values, color }) => {
                  const qx = x(quantile(values, p));
                  return <path key={name} d={`M${qx} ${y(p)}V${PLOT.bottom}`} fill="none" stroke={color} opacity=".45" strokeDasharray="5 4" />;
                })}
              </g>)}
              {active && <g aria-hidden="true">
                <path d={`M${active.x} ${PLOT.top}V${PLOT.bottom}`} stroke="var(--muted-foreground)" opacity=".6" strokeDasharray="4 4" />
                {hints.find((hint) => hint === active)?.groups.map(({ name, value, color }) => <circle key={name} cx={active.x} cy={y(value)} r="4.5" fill={color} stroke="var(--background)" strokeWidth="1.6" />)}
              </g>}
              {!compact && <rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} fill="transparent" onPointerMove={(event) => show(nearestThreshold(event))} onPointerLeave={() => show(null)} />}
            </>
          )}
        </>
      )}
    </SvgPlot>
  );
}

export function Ridgeline({ example, compact, data }: DemoProps) {
  const { loading, button } = useVariantLoading(example.id);
  const colored = example.id === "ridgeline-colors";
  const sets = data ? sampleSeries(data, []) : colored ? regionalSamples(false).map(({ name, values }) => ({ name, values, color: undefined })) : sessionRidges();
  if (!sets.length) return <NoData example={example} compact={compact} />;
  const d: [number, number] = data ? domain(sets.flatMap(({ values }) => values), .12) : colored ? [0, 4500] : [0, 50];
  const left = colored ? 120 : PLOT.left + 24;
  const x = linear(d, [left, PLOT.right]);
  const coordinates = ticks(d, 65);
  const step = (PLOT.bottom - PLOT.top - 28) / sets.length;
  const density = sets.map(({ values }) => estimate(values, coordinates, (d[1] - d[0]) / (colored ? 17 : 23)));
  const maximum = Math.max(Number.EPSILON, ...density.flat());
  const unit = data ? "" : colored ? " ms" : " min";
  const valueLabel = (value: number) => `${format.format(value)}${unit}`;
  const lines = sets.map(({ name, color, values }, i) => {
    const base = PLOT.top + 33 + (i + 1) * step;
    const ys = loading ? coordinates.map((_, j) => Math.sin(j / 64 * Math.PI) ** 3 * maximum) : density[i];
    const points = coordinates.map((value, index) => [x(value), base - ys[index] / maximum * step * (colored ? 1.15 : 1.75)] as const);
    const middle = quantile(values, .5);
    const nearest = Math.max(0, Math.min(64, Math.round((middle - d[0]) / (d[1] - d[0]) * 64)));
    return { name, color: color ?? themeColor(colored ? i : 0), base, path: linePath(points),
      hint: { x: x(middle), y: points[nearest][1], lines: [name, `Median: ${valueLabel(middle)}`, `Middle half: ${valueLabel(quantile(values, .25))} – ${valueLabel(quantile(values, .75))}`, `Observations: ${values.length}`] },
    };
  });
  const xTicks = data ? ticks(d, 5) : colored ? [0, 1000, 2000, 3000, 4000] : [0, 10, 20, 30, 40, 50];
  return (
    <SvgPlot example={example} compact={compact} hints={lines.map(({ hint }) => hint)} loading={loading} controls={button} loadingLabel="Loading sessions">
      {(show, active) => (
        <>
          <Grid x={xTicks.map(x)} xLabels={xTicks.map(valueLabel)} xTitle={data ? "Sample value" : undefined} />
          {lines.map((line, index) => (
            <g key={line.name} {...markEvents(line.hint, show, !loading)}>
              <text className="stat-axis" x={left - 10} y={line.base - 3} textAnchor="end">{line.name}</text>
              <path d={`${line.path}L${PLOT.right} ${line.base}H${left}Z`} data-ridge={line.name} className={loading ? "stat-load" : example.id.endsWith("-loading") ? "stat-ridge-reveal" : undefined} style={{ "--stat-delay": `${index * 45}ms`, "--ridge-baseline": `${line.base}px` } as CSSProperties} fill={line.color} fillOpacity={active && active !== line.hint ? .15 : .3} stroke={line.color} strokeWidth="1.4" />
            </g>
          ))}
        </>
      )}
    </SvgPlot>
  );
}

interface Distribution {
  name: string;
  region: string;
  seriesIndex: number;
  values: number[];
  color?: string;
}

function distributions(data: DemoProps["data"], grouped: boolean, horizontal: boolean): Distribution[] {
  if (data) {
    if (data.rows) {
      const fromRows = new Map<string, Distribution>();
      const palette = new Map<string, number>();
      for (const row of data.rows) {
        if (typeof row.value !== "number" || !Number.isFinite(row.value)) continue;
        const region = typeof row.group === "string" ? row.group : "Samples";
        const name = typeof row.series === "string" ? row.series : region;
        if (!palette.has(name)) palette.set(name, palette.size);
        const key = JSON.stringify([region, name]);
        let entry = fromRows.get(key);
        if (!entry) {
          entry = { region, name, seriesIndex: palette.get(name) ?? 0, values: [] };
          fromRows.set(key, entry);
        }
        entry.values.push(row.value);
      }
      return [...fromRows.values()].map((entry) => ({ ...entry, values: entry.values.sort((a, b) => a - b) }));
    }
    return sampleSeries(data, []).map((series, index) => ({ ...series, region: series.name, seriesIndex: index }));
  }
  return horizontal ? deploySamples().map((series) => ({ ...series, region: series.name, seriesIndex: 1 })) : regionalSamples(grouped);
}

export function QuantilePlot({ example, compact, data }: DemoProps) {
  const { loading, button } = useVariantLoading(example.id);
  const violin = example.family === "violin";
  const grouped = example.id.endsWith("-grouped");
  const horizontal = example.id.endsWith("-horizontal");
  const sets = distributions(data, grouped, horizontal);
  if (!sets.length) return <NoData example={example} compact={compact} />;
  const names = [...new Set(sets.map(({ region }) => region))];
  const d: [number, number] = data ? domain(sets.flatMap(({ values }) => values), .12) : [0, horizontal ? 40 : grouped ? 6000 : 5000];
  const coordinates = ticks(d, 58);
  const gap = (horizontal ? PLOT.bottom - PLOT.top : PLOT.right - PLOT.left) / names.length;
  const v = linear(d, horizontal ? [PLOT.left, PLOT.right] : [PLOT.bottom, PLOT.top]);
  const category = (name: string) => horizontal ? PLOT.bottom - (names.indexOf(name) + .5) * gap : PLOT.left + (names.indexOf(name) + .5) * gap;
  const unit = data ? "" : horizontal ? " min" : " ms";
  const labelValue = (value: number) => `${precise.format(value)}${unit}`;
  const drawables = sets.map(({ name, region, color, values, seriesIndex }) => {
    const regionSets = sets.filter((entry) => entry.region === region);
    const position = regionSets.findIndex((entry) => entry.name === name);
    const bandWidth = gap * (horizontal && violin ? .95 : .69) / regionSets.length;
    const center = category(region) + (position - (regionSets.length - 1) / 2) * bandWidth;
    const { q1, median, q3, whiskerLow, whiskerHigh, outliers, bandwidth } = distributionStatistics(values, (d[1] - d[0]) / 35);
    const at = (value: number, offset = 0): [number, number] => horizontal ? [v(value), center + offset] : [center + offset, v(value)];
    const [hx, hy] = at(median);
    const hint = { x: hx, y: hy, lines: [region === name ? region : `${region} · ${name}`, ...(violin || horizontal ? [
      `Median: ${labelValue(median)}`, `Middle half: ${labelValue(q1)} – ${labelValue(q3)}`,
      ...(violin ? [`Range: ${labelValue(values[0])} – ${labelValue(values[values.length - 1])}`, `Observations: ${values.length}`] : [`${data ? "Observations" : "Deploys"}: ${values.length}`]),
    ] : [`High: ${labelValue(whiskerHigh)}`, `Q3: ${labelValue(q3)}`, `Median: ${labelValue(median)}`, `Q1: ${labelValue(q1)}`, `Low: ${labelValue(whiskerLow)}`, `Outliers: ${outliers.length}`])] };
    const kde = violin ? estimate(values, coordinates, bandwidth) : [];
    const peak = Math.max(Number.EPSILON, ...kde);
    const shape = violin ? `${linePath(coordinates.map((coordinate, i) => at(coordinate, kde[i] / peak * bandWidth * .45)))} ${linePath(coordinates.map((coordinate, i) => at(coordinate, -kde[i] / peak * bandWidth * .45)).reverse()).replace("M", "L")}Z` : "";
    const rect = (first: number, last: number, radius: number) => horizontal
      ? { x: v(first), y: center - radius, width: Math.max(2, v(last) - v(first)), height: 2 * radius }
      : { x: center - radius, y: v(last), width: 2 * radius, height: Math.max(2, v(first) - v(last)) };
    return { name, region, at, rect, q1, median, q3, minimum: values[0], maximum: values[values.length - 1], whiskerLow, whiskerHigh, outliers, shape, hint, bandWidth, color: color ?? themeColor(seriesIndex) };
  });
  const groupedHints = new Map(names.map((name) => {
    const marks = drawables.filter((plot) => plot.region === name);
    return [name, { x: category(name), y: Math.min(...marks.map(({ hint }) => hint.y)), lines: [name, ...marks.map((plot) => `${plot.name} median: ${labelValue(plot.median)}`)] }];
  }));
  const hints = grouped ? [...groupedHints.values()] : drawables.map(({ hint }) => hint);
  const labels = ticks(d, data ? 5 : horizontal ? 5 : grouped ? 7 : 6);
  const seriesNames = [...new Set(sets.map(({ name }) => name))];
  const legend = grouped && <Legend entries={seriesNames.map((name) => ({ name, color: drawables.find((plot) => plot.name === name)?.color ?? themeColor(0) }))} />;
  return (
    <SvgPlot example={example} compact={compact} hints={hints} loading={loading} controls={button} legend={legend} loadingLabel="Loading page loads">
      {(show, active) => (
        <>
          <Grid
            x={horizontal ? labels.map(v) : names.map(category)}
            xLabels={horizontal ? labels.map(labelValue) : names}
            y={horizontal ? names.map(category) : labels.map(v)}
            yLabels={horizontal ? names : labels.map(labelValue)}
            hideVertical={!horizontal} hideHorizontal={horizontal} horizontalLabelsAtTop={horizontal}
          />
          {drawables.map((plot, index) => {
            const { at, rect, q1, median, q3, minimum, maximum, whiskerLow, whiskerHigh, outliers, shape, bandWidth, color } = plot;
            const hint = grouped ? groupedHints.get(plot.region)! : plot.hint;
            const thickness = Math.min(25, bandWidth * .33);
            const [mx, my] = at(median);
            const animation = !loading && example.id.endsWith("-loading") ? `stat-quantile-reveal stat-quantile-${horizontal ? "horizontal" : "vertical"}` : undefined;
            return (
              <g key={index} data-region={plot.region} data-series={plot.name} opacity={active && active !== hint ? .42 : 1} {...markEvents(hint, show, !loading)}>
                <g className={animation} style={{ "--quantile-origin": `${mx}px ${my}px`, "--stat-delay": `${index * 40}ms` } as CSSProperties}>
                {violin && <path className={loading ? "stat-load" : undefined} data-violin="" d={shape} fill={color} fillOpacity=".57" stroke={color} strokeWidth="1.15" />}
                {loading && violin && <rect {...rect(q1, q3, 2.4)} fill="var(--background)" opacity=".5" />}
                {(!loading || !violin) && <>
                  <path className={loading ? "stat-load" : undefined} d={linePath([at(violin ? minimum : whiskerLow), at(violin ? maximum : whiskerHigh)])} fill="none" stroke={violin ? "var(--background)" : color} strokeWidth={violin ? 1 : 2} />
                  {!violin && [whiskerLow, whiskerHigh].map((value, i) => (
                    <path key={i} className={loading ? "stat-load" : undefined} d={linePath([at(value, -thickness * .63), at(value, thickness * .63)])} fill="none" stroke={color} strokeWidth={2} />
                  ))}
                  <rect data-quartiles="" className={loading ? "stat-load" : undefined} {...rect(q1, q3, violin ? 3 : thickness)} fill={violin ? "var(--background)" : color} fillOpacity={violin ? 1 : .62} stroke={violin ? "none" : color} strokeWidth={1.5} rx={3} />
                  {violin
                    ? <circle data-median="" cx={mx} cy={my} r={horizontal || grouped ? 2.5 : 4} fill={color} />
                    : <path data-median="" d={linePath([at(median, -thickness), at(median, thickness)])} fill="none" stroke="var(--background)" strokeWidth={2} />}
                  {!loading && !violin && outliers.map((outlier, i) => {
                    const [cx, cy] = at(outlier);
                    return <circle key={i} data-outlier="" cx={cx} cy={cy} r={3} fill={color} opacity=".55" />;
                  })}
                </>}
                </g>
                {!loading && !grouped && <rect {...rect(d[0], d[1], bandWidth * .48)} fill="transparent" />}
              </g>
            );
          })}
          {!loading && grouped && names.map((name) => <rect key={name} x={category(name) - gap / 2} y={PLOT.top} width={gap} height={PLOT.bottom - PLOT.top} fill="transparent" {...markEvents(groupedHints.get(name)!, show)} />)}
        </>
      )}
    </SvgPlot>
  );
}

export function Beeswarm({ example, compact, data }: DemoProps) {
  const { loading, button } = useVariantLoading(example.id);
  const vertical = example.id === "beeswarm-vertical";
  const shared = example.id === "beeswarm-series";
  const sets = data ? sampleSeries(data, []) : shared ? [
    { name: "Before", color: themeColor(2), values: positiveSamples(326, .48, 90, 819, 35, 999) },
    { name: "After", color: themeColor(0), values: positiveSamples(216, .44, 90, 820, 30, 999) },
  ] : vertical ? regionalSamples(false).map(({ name, values }) => ({ name, color: themeColor(1), values })) : deploySamples().map((set) => ({ ...set, color: themeColor(0) }));
  if (!sets.length) return <NoData example={example} compact={compact} />;
  const d: [number, number] = data ? domain(sets.flatMap(({ values }) => values), .1) : [0, shared ? 1000 : vertical ? 5000 : 40];
  const v = linear(d, vertical ? [PLOT.bottom, PLOT.top] : [PLOT.left, PLOT.right]);
  const names = sets.map(({ name }) => name);
  const gap = (vertical ? PLOT.right - PLOT.left : PLOT.bottom - PLOT.top) / (shared ? 1 : sets.length);
  const category = (i: number) => vertical ? PLOT.left + (i + .5) * gap : PLOT.bottom - ((shared ? 0 : i) + .5) * gap;
  const radius = vertical ? 3 : shared ? 4.5 : 4;
  const diameter = radius * 2.35;
  const packed: { along: number; cross: number; lane: number }[] = [];
  const layoutSets = loading && !data ? sets.map((set, i) => ({ ...set, values: positiveSamples(7.5 + i * 2, .43, 48, 4009 + i, 2, 32) })) : sets;
  const unit = data ? "" : shared || vertical ? " ms" : " min";
  const formatValue = (value: number) => `${format.format(value)}${unit}`;
  const dots = layoutSets.flatMap(({ name, color, values }, index) => values.map((value) => ({ name, color, value, index })))
    .sort((a, b) => (shared ? 0 : a.index - b.index) || a.value - b.value).map(({ name, color, value, index }) => {
      const along = v(value);
      const neighbors = packed.filter((point) => (shared || point.lane === index) && Math.abs(point.along - along) < diameter);
      const center = category(index);
      const alternatives = [center, ...neighbors.flatMap((p) => {
        const shift = Math.sqrt(diameter ** 2 - (p.along - along) ** 2);
        return [p.cross - shift, p.cross + shift];
      })].sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
      const cross = alternatives.find((c) => neighbors.every((p) => Math.hypot(p.along - along, p.cross - c) >= diameter - .001)) ?? center;
      packed.push({ along, cross, lane: index });
      const [x, y] = vertical ? [cross, along] : [along, cross];
      return { x, y, name, color: color ?? themeColor(index), hint: { x, y, lines: [name, `${shared ? name : vertical ? "Page load" : data ? "Value" : "Deploy"}: ${formatValue(value)}`] } };
    });
  const valueTicks = ticks(d, shared || vertical ? 6 : 5);
  const legend = shared && <Legend entries={sets.map(({ name, color }, i) => ({ name, color: color ?? themeColor(i) }))} />;
  function nearest(event: PointerEvent<SVGRectElement>) {
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return null;
    const position = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    const distance = ({ x, y }: { x: number; y: number }) => (x - position.x) ** 2 + (y - position.y) ** 2;
    return dots.reduce((previous, dot) => distance(dot) < distance(previous) ? dot : previous).hint;
  }
  return (
    <SvgPlot example={example} compact={compact} hints={dots.map(({ hint }) => hint)} loading={loading} controls={button} legend={legend} loadingLabel="Loading deploys">
      {(show, active) => (
        <>
          <Grid
            x={vertical ? names.map((_, i) => category(i)) : valueTicks.map(v)}
            xLabels={vertical ? names : valueTicks.map(formatValue)}
            y={vertical ? valueTicks.map(v) : shared ? [category(0)] : names.map((_, i) => category(i))}
            yLabels={vertical ? valueTicks.map(formatValue) : shared ? [""] : names}
            hideVertical={vertical} hideHorizontal={!vertical} horizontalLabelsAtTop={!vertical}
          />
          {dots.map(({ x, y, name, color, hint }, i) => <circle key={i} data-swarm={name} className={loading ? "stat-load" : example.id.endsWith("-loading") ? "stat-swarm-reveal" : undefined} style={{ "--stat-delay": `${(x - PLOT.left) * .61}ms` } as CSSProperties} cx={x} cy={y} r={active === hint ? radius + 2 : radius} fill={color} opacity={active && active !== hint ? .28 : .8} />)}
          {!compact && !loading && <rect x={PLOT.left} y={PLOT.top} width={PLOT.right - PLOT.left} height={PLOT.bottom - PLOT.top} fill="transparent" onPointerMove={(event) => show(nearest(event))} onPointerLeave={() => show(null)} />}
        </>
      )}
    </SvgPlot>
  );
}
