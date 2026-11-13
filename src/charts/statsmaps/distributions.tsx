import { useState } from "react";
import {
  Grid, Legend, NoData, PLOT, SvgPlot, domain, format, linePath, linear,
  markEvents, minMax, percent, quantile, sampleSeries, ticks, useVariantLoading,
  type DemoProps,
} from "./primitives";
import { distributionStatistics, estimate } from "./simplify-statistics";

const themeColor = (index: number) => `var(--chart-${index % 8 + 1})`;
const regionNames = ["North", "South", "East", "West"];
const monthNames = ["January", "February", "March", "April", "May", "June"];

export function Histogram({ example, compact, data }: DemoProps) {
  const { loading, button } = useVariantLoading(example.id);
  const overlay = example.id === "histogram-overlay";
  const stacked = example.id === "histogram-stacked";
  const sets = sampleSeries(data, overlay ? ["Before", "After"] : stacked ? ["Mobile", "Desktop"] : ["Requests"], 240);
  const [hidden, setHidden] = useState<string[]>([]);
  if (!sets.length) return <NoData example={example} compact={compact} />;
  const [min, max] = minMax(sets.flatMap(({ values }) => values));
  const count = 16;
  const width = (max - min) / count;
  const x = linear([min, max], [PLOT.left, PLOT.right]);
  const xTicks = ticks([min, max], 6);
  const bins = sets.map(({ values }) => {
    const histogram = new Array<number>(count).fill(0);
    values.forEach((value) => {
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
      return { x: bx, y: loading ? PLOT.bottom - displayHeight : by, height: displayHeight,
        color: color ?? themeColor(seriesIndex), value,
        hint: { x: bx + barWidth / 2, y: by, lines: [`${format.format(min + binIndex * width)}–${format.format(min + (binIndex + 1) * width)}`, `${name}: ${value}`] },
        key: `${seriesIndex}-${binIndex}`,
      };
    });
  });
  const legend = sets.length > 1 && (
    <Legend
      entries={sets.map(({ name, color }, i) => ({ name, color: color ?? themeColor(i) }))}
      active={sets.filter((_, i) => visible[i]).map(({ name }) => name)}
      onToggle={compact ? undefined : (name) => setHidden((prev) => prev.includes(name) ? prev.filter((entry) => entry !== name) : [...prev, name])}
    />
  );
  return (
    <SvgPlot example={example} compact={compact} hints={bars.map(({ hint }) => hint)} loading={loading} controls={button} legend={legend}>
      {(show, active) => (
        <>
          <Grid x={xTicks.map(x)} xLabels={xTicks.map((value) => format.format(value))} y={yTicks.map(y)} yLabels={yTicks.map((value) => format.format(value))} xTitle="Sample value" yTitle="Frequency" hideVertical />
          {bars.map((bar) => (
            <rect
              key={bar.key}
              className={loading ? "stat-load" : undefined}
              x={bar.x}
              y={bar.y}
              width={barWidth - 2}
              height={Math.max(0, bar.height)}
              fill={bar.color}
              rx={3}
              opacity={active && active !== bar.hint ? .42 : overlay ? .63 : .9}
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
  const sets = sampleSeries(data, compare ? ["After", "Before"] : ["Requests"], 60);
  if (!sets.length) return <NoData example={example} compact={compact} />;
  const [min, max] = domain(sets.flatMap(({ values }) => values), .04);
  const x = linear([min, max], [PLOT.left, PLOT.right]);
  const y = linear([0, 1], [PLOT.bottom, PLOT.top]);
  const xTicks = ticks([min, max], 5);
  const yTicks = ticks([0, 1], 5);
  const graphs = sets.map(({ name, color, values }, i) => {
    const start: [number, number] = [x(min), y(0)];
    const points: [number, number][] = [start];
    const hints = values.map((value, index) => {
      const share = (index + 1) / values.length;
      points.push([x(value), y(index / values.length)], [x(value), y(share)]);
      return { x: x(value), y: y(share), lines: [name, `Value: ${format.format(value)}`, `Cumulative: ${percent.format(share)}`] };
    });
    points.push([x(max), y(1)]);
    return { name, path: linePath(points), color: color ?? themeColor(i), hints };
  }).filter(({ name }) => !hidden.includes(name));
  const legend = sets.length > 1 && <Legend
    entries={sets.map(({ name, color }, i) => ({ name, color: color ?? themeColor(i) }))}
    active={graphs.map(({ name }) => name)}
    onToggle={compact ? undefined : (name) => setHidden((prev) => prev.includes(name) ? prev.filter((entry) => entry !== name) : [...prev, name])}
  />;
  const hints = graphs.flatMap((graph) => graph.hints);
  const placeholder = Array.from({ length: 10 }, (_, index) => {
    const position = x(min + (max - min) * (index + 1) / 10);
    return `H${position}V${y(Math.min(1, (index + 1) / 10))}`;
  }).join("");
  return (
    <SvgPlot example={example} compact={compact} hints={hints} loading={loading} controls={button} legend={legend}>
      {(show, active, id) => (
        <>
          <defs><linearGradient id={`${id}-cdf`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={themeColor(0)} stopOpacity=".29" /><stop offset="100%" stopColor={themeColor(0)} stopOpacity=".04" /></linearGradient></defs>
          <Grid x={xTicks.map(x)} xLabels={xTicks.map((value) => format.format(value))} y={yTicks.map(y)} yLabels={yTicks.map((value) => percent.format(value))} xTitle="Sample value" yTitle="Cumulative share" />
          {loading ? <path d={`M${x(min)} ${y(0)}${placeholder}`} fillOpacity={0} className="stat-load" strokeWidth={5} /> : (
            <>
              {graphs.map((graph) => (
                <g key={graph.name}>
                  {!compare && <path d={`${graph.path}L${x(max)} ${y(0)}Z`} fill={`url(#${id}-cdf)`} />}
                  <path d={graph.path} fill="none" stroke={graph.color} strokeWidth={2.8} strokeLinejoin="round" />
                  {graph.hints.map((hint, index) => <circle key={index} cx={hint.x} cy={hint.y} r={7} fill="transparent" {...markEvents(hint, show)} />)}
                </g>
              ))}
              {!compare && graphs.length > 0 && [.5, .9].map((p) => {
                const qx = x(quantile(sets[0].values, p));
                return <path key={p} d={`M${PLOT.left} ${y(p)}H${qx}V${PLOT.bottom}`} fill="none" stroke={themeColor(0)} opacity=".6" strokeDasharray="5 4" />;
              })}
              {active && <circle cx={active.x} cy={active.y} r={5} fill={themeColor(0)} stroke="var(--background)" strokeWidth={2} />}
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
