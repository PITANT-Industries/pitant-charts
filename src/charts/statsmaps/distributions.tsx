import { useState, type PointerEvent } from "react";
import {
  Grid, Legend, NoData, PLOT, SvgPlot, createRandom, domain, format, linePath, linear,
  markEvents, minMax, normal, percent, quantile, sampleSeries, ticks, useVariantLoading,
  type DemoProps,
} from "./primitives";
import { distributionStatistics, estimate } from "./simplify-statistics";

const themeColor = (index: number) => `var(--chart-${index % 8 + 1})`;
const regionNames = ["North", "South", "East", "West"];
const monthNames = ["January", "February", "March", "April", "May", "June"];
const cumulativePercent = new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 1 });

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
  const { loading, button } = useVariantLoading(example.id);
  const overlay = example.id === "histogram-overlay";
  const stacked = example.id === "histogram-stacked";
  const names = overlay ? ["Before", "After"] : stacked ? ["Mobile", "Desktop"] : ["Requests"];
  const sets = data ? sampleSeries(data, []) : requestFixtures(names, stacked);
  const [hidden, setHidden] = useState<string[]>([]);
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null);
  if (!sets.length) return <NoData example={example} compact={compact} />;
  const [dataMin, dataMax] = minMax(sets.flatMap(({ values }) => values));
  const step = stacked ? 2 : overlay ? 50 : 20;
  const min = data ? dataMin : stacked ? 0 : Math.floor(dataMin / step) * step;
  const max = data ? dataMax : stacked ? 40 : Math.ceil(dataMax / step) * step;
  const count = data ? 16 : Math.max(1, Math.round((max - min) / step));
  const width = (max - min) / count;
  const x = linear([min, max], [PLOT.left, PLOT.right]);
  const tickStep = stacked ? 10 : overlay ? 200 : 100;
  const xTicks = data ? ticks([min, max], 6) : Array.from({ length: Math.floor(max / tickStep) + 1 }, (_, index) => index * tickStep).filter((value) => value >= min);
  const unit = data ? "" : stacked ? " min" : " ms";
  const axisLabel = (value: number) => `${format.format(value)}${unit}`;
  const bins = sets.map(({ values }) => {
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
  const y = linear([0, maximum * 1.1], [PLOT.bottom, PLOT.top]);
  const yTicks = ticks([0, maximum], 5);
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
        hint: { x: bx + barWidth / 2, y: by, lines: [`${format.format(min + binIndex * width)}–${axisLabel(min + (binIndex + 1) * width)}`, `${name}: ${value}`] },
        key: `${seriesIndex}-${binIndex}`,
      };
    });
  });
  const toggle = (name: string) => setHidden((prev) => prev.includes(name) ? prev.filter((entry) => entry !== name) : [...prev, name]);
  const legend = overlay && sets.length > 1 ? <div className="stat-legend" aria-label="Median response">
    <span>Median response</span>
    {sets.map(({ name, color, values }, i) => <button key={name} type="button" aria-label={name} aria-pressed={visible[i]} disabled={compact} onPointerEnter={() => setHoveredSeries(name)} onPointerLeave={() => setHoveredSeries(null)} onFocus={() => setHoveredSeries(name)} onBlur={() => setHoveredSeries(null)} onClick={() => toggle(name)}>
      <i style={{ background: color ?? themeColor(i) }} aria-hidden="true" /> {name} <strong>{axisLabel(quantile(values, .5))}</strong>
    </button>)}
  </div> : sets.length > 1 && (
    <Legend
      entries={sets.map(({ name, color }, i) => ({ name, color: color ?? themeColor(i) }))}
      active={sets.filter((_, i) => visible[i]).map(({ name }) => name)}
      onToggle={compact ? undefined : toggle}
    />
  );
  return (
    <SvgPlot example={example} compact={compact} hints={bars.map(({ hint }) => hint)} loading={loading} controls={button} legend={legend}>
      {(show, active) => (
        <>
          <Grid x={xTicks.map(x)} xLabels={xTicks.map(axisLabel)} y={yTicks.map(y)} yLabels={yTicks.map((value) => format.format(value))} xTitle={data ? "Sample value" : undefined} yTitle={data ? "Frequency" : undefined} hideVertical />
          {bars.map((bar) => (
            <rect
              key={bar.key}
              data-series={bar.name}
              className={loading ? "stat-load" : undefined}
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
  const sets = sampleSeries(data, colored ? regionNames : monthNames, 84);
  if (!sets.length) return <NoData example={example} compact={compact} />;
  const d = domain(sets.flatMap(({ values }) => values), .12);
  const x = linear(d, [PLOT.left + 24, PLOT.right]);
  const coordinates = ticks(d, 65);
  const step = (PLOT.bottom - PLOT.top - 28) / sets.length;
  const density = sets.map(({ values }) => estimate(values, coordinates, (d[1] - d[0]) / 16));
  const maximum = Math.max(...density.flat());
  const lines = sets.map(({ name, color, values }, i) => {
    const base = PLOT.top + 33 + (i + 1) * step;
    const ys = loading ? coordinates.map((_, j) => Math.sin(j / 64 * Math.PI) ** 3 * maximum) : density[i];
    const points = coordinates.map((value, index) => [x(value), base - ys[index] / maximum * step * (colored ? 1.15 : 1.75)] as const);
    const middle = quantile(values, .5);
    const nearest = Math.max(0, Math.min(64, Math.round((middle - d[0]) / (d[1] - d[0]) * 64)));
    return { name, color: color ?? themeColor(colored ? i : 0), base, path: linePath(points),
      hint: { x: x(middle), y: points[nearest][1], lines: [name, `Median: ${format.format(middle)}`, `${values.length} samples`] },
    };
  });
  const xTicks = ticks(d, 5);
  return (
    <SvgPlot example={example} compact={compact} hints={lines.map(({ hint }) => hint)} loading={loading} controls={button}>
      {(show, active) => (
        <>
          {lines.map((line) => (
            <g key={line.name} {...markEvents(line.hint, show, !loading)}>
              <text className="stat-axis" x={PLOT.left + 14} y={line.base - 3} textAnchor="end">{line.name}</text>
              <path d={`${line.path}L${PLOT.right} ${line.base}H${PLOT.left + 24}Z`} className={loading ? "stat-load" : undefined} fill={line.color} fillOpacity={active && active !== line.hint ? .2 : .37} stroke={line.color} strokeWidth="1.4" />
            </g>
          ))}
          <Grid x={xTicks.map(x)} xLabels={xTicks.map((value) => format.format(value))} xTitle="Sample value" hideVertical />
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
  const names = horizontal ? ["Platform", "Growth", "Core", "Mobile"] : regionNames;
  const sets = sampleSeries(undefined, names.flatMap((name) => grouped ? [`${name} Desktop`, `${name} Mobile`] : [name]), 65);
  return sets.map((series, index) => ({
    ...series,
    region: names[grouped ? Math.floor(index / 2) : index],
    name: grouped ? index % 2 ? "Mobile" : "Desktop" : series.name,
    seriesIndex: grouped ? index % 2 : index,
  }));
}

export function QuantilePlot({ example, compact, data }: DemoProps) {
  const { loading, button } = useVariantLoading(example.id);
  const violin = example.family === "violin";
  const grouped = example.id.endsWith("-grouped");
  const horizontal = example.id.endsWith("-horizontal");
  const sets = distributions(data, grouped, horizontal);
  if (!sets.length) return <NoData example={example} compact={compact} />;
  const names = [...new Set(sets.map(({ region }) => region))];
  const d = domain(sets.flatMap(({ values }) => values), .12);
  const coordinates = ticks(d, 58);
  const gap = (horizontal ? PLOT.bottom - PLOT.top : PLOT.right - PLOT.left) / names.length;
  const v = linear(d, horizontal ? [PLOT.left, PLOT.right] : [PLOT.bottom, PLOT.top]);
  const category = (name: string) => (horizontal ? PLOT.top : PLOT.left) + (names.indexOf(name) + .5) * gap;
  const drawables = sets.map(({ name, region, color, values, seriesIndex }) => {
    const regionSets = sets.filter((entry) => entry.region === region);
    const position = regionSets.findIndex((entry) => entry.name === name);
    const bandWidth = gap * (horizontal && violin ? .92 : .67) / regionSets.length;
    const center = category(region) + (position - (regionSets.length - 1) / 2) * bandWidth;
    const { q1, median, q3, whiskerLow, whiskerHigh, outliers, bandwidth } = distributionStatistics(values, (d[1] - d[0]) / 35);
    const at = (value: number, offset = 0): [number, number] => horizontal ? [v(value), center + offset] : [center + offset, v(value)];
    const [hx, hy] = at(median);
    const hint = { x: hx, y: hy, lines: [region === name ? region : `${region} · ${name}`, `Median: ${format.format(median)}`, `Middle half: ${format.format(q1)}–${format.format(q3)}`, `Samples: ${values.length}`] };
    const kde = violin ? estimate(values, coordinates, bandwidth) : [];
    const peak = Math.max(...kde);
    const shape = violin ? `${linePath(coordinates.map((coordinate, i) => at(coordinate, kde[i] / peak * bandWidth * .45)))} ${linePath(coordinates.map((coordinate, i) => at(coordinate, -kde[i] / peak * bandWidth * .45)).reverse()).replace("M", "L")}Z` : "";
    const rect = (first: number, last: number, radius: number) => horizontal
      ? { x: v(first), y: center - radius, width: Math.max(2, v(last) - v(first)), height: 2 * radius }
      : { x: center - radius, y: v(last), width: 2 * radius, height: Math.max(2, v(first) - v(last)) };
    return { at, rect, q1, median, q3, whiskerLow, whiskerHigh, outliers, shape, hint, center, bandWidth, color: color ?? themeColor(seriesIndex) };
  });
  const labels = ticks(d, 5);
  const seriesNames = [...new Set(sets.map(({ name }) => name))];
  const legend = grouped && <Legend entries={seriesNames.map((name, index) => ({ name, color: themeColor(index) }))} />;
  return (
    <SvgPlot example={example} compact={compact} hints={drawables.map(({ hint }) => hint)} loading={loading} controls={button} legend={legend}>
      {(show, active) => (
        <>
          <Grid
            x={horizontal ? labels.map(v) : names.map(category)}
            xLabels={horizontal ? labels.map((value) => format.format(value)) : names}
            y={horizontal ? names.map(category) : labels.map(v)}
            yLabels={horizontal ? names : labels.map((value) => format.format(value))}
            hideVertical={!horizontal}
          />
          {drawables.map((plot, index) => {
            const { at, rect, q1, median, q3, whiskerLow, whiskerHigh, outliers, shape, hint, bandWidth, color } = plot;
            const thickness = Math.min(25, bandWidth * .33);
            const [mx, my] = at(median);
            return (
              <g key={index} opacity={active && active !== hint ? .42 : 1} {...markEvents(hint, show, !loading)}>
                {violin && <path className={loading ? "stat-load" : undefined} d={shape} fill={color} fillOpacity=".27" stroke={color} strokeWidth="1.75" />}
                {(!loading || !violin) && <>
                  <path className={loading ? "stat-load" : undefined} d={linePath([at(whiskerLow), at(whiskerHigh)])} fill="none" stroke={color} strokeWidth={2} />
                  {!violin && [whiskerLow, whiskerHigh].map((value, i) => (
                    <path key={i} className={loading ? "stat-load" : undefined} d={linePath([at(value, -thickness * .63), at(value, thickness * .63)])} fill="none" stroke={color} strokeWidth={2} />
                  ))}
                  <rect className={loading ? "stat-load" : undefined} {...rect(q1, q3, violin ? 3 : thickness)} fill={color} fillOpacity={violin ? 1 : .22} stroke={color} strokeWidth={1.5} rx={3} />
                  {violin
                    ? <circle cx={mx} cy={my} r={4} fill="var(--background)" stroke={color} strokeWidth={1.8} />
                    : <path className={loading ? "stat-load" : undefined} d={linePath([at(median, -thickness), at(median, thickness)])} fill="none" stroke={color} strokeWidth={2} />}
                  {!loading && !violin && outliers.map((outlier, i) => {
                    const [cx, cy] = at(outlier);
                    return <circle key={i} cx={cx} cy={cy} r={2.5} fill={color} opacity=".7" />;
                  })}
                </>}
                <rect {...rect(d[0], d[1], bandWidth * .48)} fill="transparent" />
              </g>
            );
          })}
        </>
      )}
    </SvgPlot>
  );
}

export function Beeswarm({ example, compact, data }: DemoProps) {
  const { loading, button } = useVariantLoading(example.id);
  const vertical = example.id === "beeswarm-vertical";
  const shared = example.id === "beeswarm-series";
  const sets = sampleSeries(data, shared ? ["Before", "After"] : ["Core", "Web", "Data", "Platform"], shared ? 44 : 32);
  if (!sets.length) return <NoData example={example} compact={compact} />;
  const d = domain(sets.flatMap(({ values }) => values), .1);
  const v = linear(d, vertical ? [PLOT.bottom, PLOT.top] : [PLOT.left, PLOT.right]);
  const names = sets.map(({ name }) => name);
  const gap = (vertical ? PLOT.right - PLOT.left : PLOT.bottom - PLOT.top) / (shared ? 1 : sets.length);
  const category = (i: number) => (vertical ? PLOT.left : PLOT.top) + ((shared ? 0 : i) + .5) * gap;
  const radius = vertical ? 3 : 4;
  const diameter = radius * 2.35;
  const packed: { along: number; cross: number; lane: number }[] = [];
  const dots = sets.flatMap(({ name, color, values }, index) => {
    return values.map((value) => {
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
      return { x, y, color: color ?? themeColor(index), hint: { x, y, lines: [name, `Value: ${format.format(value)}`] } };
    });
  });
  const valueTicks = ticks(d, 5);
  const legend = shared && <Legend entries={sets.map(({ name, color }, i) => ({ name, color: color ?? themeColor(i) }))} />;
  return (
    <SvgPlot example={example} compact={compact} hints={dots.map(({ hint }) => hint)} loading={loading} controls={button} legend={legend}>
      {(show, active) => (
        <>
          <Grid
            x={vertical ? names.map((_, i) => category(i)) : valueTicks.map(v)}
            xLabels={vertical ? names : valueTicks.map((value) => format.format(value))}
            y={vertical ? valueTicks.map(v) : shared ? [category(0)] : names.map((_, i) => category(i))}
            yLabels={vertical ? valueTicks.map((value) => format.format(value)) : shared ? [""] : names}
            hideVertical={!vertical}
          />
          {dots.map(({ x, y, color, hint }, i) => <circle key={i} className={loading ? "stat-load" : undefined} cx={x} cy={y} r={active === hint ? radius + 2 : radius} fill={color} opacity={active && active !== hint ? .28 : .8} {...markEvents(hint, show, !loading)} />)}
        </>
      )}
    </SvgPlot>
  );
}
