import { useId, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { Button } from "@ui-sdk/react/button";
import { useChartTheme } from "../theme";
import { arc, nextChartFocus, number, numeric, point, sector, seriesData, short, tone, type Props } from "./shared";
import { PiePattern } from "./PiePattern";
import { cafeOrders, cloud, cloudTypes, devices, deviceTypes, forecastEnergy, hourEnd, hours, meteredEnergy, monthNames, normals, observedEnd, observedTemperatures } from "./radial-fixtures";
import { usAgeBands, usStateAgeData } from "./upstream/us-state-age-data";
import styles from "./radial-detail.module.css";
import shared from "./styles.module.css";

const chartCenter = 160;
const labels = [0, 6, 12, 18];
const tenths = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const total = (items: readonly (number | null)[]) => items.reduce<number>((sum, item) => sum + (item ?? 0), 0);

function useInspection(count: number, compact?: boolean) {
  const [requested, setActive] = useState<number | null>(null);
  const active = requested !== null && requested < count ? requested : null;
  return {
    active,
    select: (index: number | null) => { if (!compact) setActive(index); },
    events: {
      tabIndex: compact || !count ? undefined : 0,
      onBlur: () => setActive(null),
      onPointerLeave: (event: PointerEvent<SVGSVGElement>) => { if (event.pointerType !== "touch") setActive(null); },
      onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => {
        if (event.key === "Escape" && active !== null) {
          event.preventDefault();
          event.stopPropagation();
          setActive(null);
          return;
        }
        const next = nextChartFocus(event.key, active, count);
        if (next !== undefined) {
          event.preventDefault();
          setActive(next);
        }
      },
    },
  };
}

function pointerAngle(event: PointerEvent<SVGSVGElement>, cx: number, cy: number, min: number, max: number) {
  const inverse = event.currentTarget.getScreenCTM()?.inverse();
  if (!inverse) return null;
  const pointer = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
  const dx = pointer.x - cx;
  const dy = pointer.y - cy;
  const distance = Math.hypot(dx, dy);
  if (distance < min || distance > max) return null;
  return (Math.atan2(dy, dx) * 180 / Math.PI + 450) % 360;
}

function frameStatus(text: string, compact?: boolean) {
  return !compact && <span className={shared.screenReader} role="status">{text}</span>;
}

function Readout({ x = chartCenter, y = chartCenter, value, label, extra }: { x?: number; y?: number; value: string; label: string; extra?: string }) {
  return <g textAnchor="middle" aria-hidden="true" pointerEvents="none">
    <text className={styles.readout} data-radial-value="" x={x} y={y - 1} fontSize="24">{value}</text>
    <text className={styles.caption} data-radial-caption="" x={x} y={y + 17} fontSize="10">{label}</text>
    {extra && <text className={styles.caption} x={x} y={y + 32} fontSize="8.5">{extra}</text>}
  </g>;
}

function CardReadout({ value, label }: { value: string; label: string }) {
  return <div className={styles.cardReadout} aria-hidden="true"><strong>{value}</strong><span>{label}</span></div>;
}

function ReadingKey({ children }: { children: ReactNode }) {
  return <div className={styles.key}>{children}</div>;
}

export function RadialDetail(props: Props) {
  const id = props.example.id;
  if (id === "radial-temperature" || id === "radial-seasonal-card") return <Temperature {...props} />;
  if (id === "radial-population") return <Population {...props} />;
  if (id === "radial-semicircle" || id === "radial-storage-card") return <Storage {...props} />;
  return <DotClock {...props} />;
}

function DotClock({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const instance = useId();
  const activity = example.id === "radial-activity-card";
  const { categories, series } = seriesData(data, hours, activity ? cafeOrders : meteredEnergy);
  const count = categories.length;
  const selection = useInspection(count, compact);
  const active = selection.active;
  const future = !data && active !== null && active > hourEnd;
  const samples = categories.map((_, index) => total(series.map(row => row.values[index] ?? null)));
  const totals = series.map(row => total(row.values));
  const max = Math.max(1, ...samples, ...(activity || data ? [] : forecastEnergy));
  const activeTotal = active === null ? total(totals) : samples[active] ?? 0;
  const label = active === null ? activity ? "cups sold today" : "kWh so far" : activity
    ? `cups ${categories[active]}–${categories[(active + 1) % count]}${future ? " · later today" : ""}`
    : future ? `forecast ${categories[active]}` : `kWh at ${categories[active]}`;
  const shown = activity ? future ? "–" : number.format(activeTotal) : tenths.format(future ? forecastEnergy[active!] : activeTotal);
  const peakIndex = samples.indexOf(Math.max(...samples));
  const center = chartCenter;
  const angle = (index: number) => (index + .5) * 360 / Math.max(1, count) - 90;
  const levels = activity ? 6 : 7;
  function move(event: PointerEvent<SVGSVGElement>) {
    const phase = pointerAngle(event, center, center, 55, 135);
    selection.select(phase === null || !count ? null : Math.min(count - 1, Math.floor(phase / 360 * count)));
  }
  function dots(index: number, layer: number, value: number, offset: number, forecast = false) {
    if (value <= 0) return null;
    const count = Math.max(1, Math.round(value / max * levels));
    return Array.from({ length: count }, (_, dot) => {
      const [x, y] = point(center, center, 67 + (offset + dot) * 8, angle(index));
      return <circle key={dot} data-dot-type={forecast ? "forecast" : "actual"} data-dot-series={layer} cx={x} cy={y} r="3.9"
        fill={forecast ? `url(#${instance}-forecast)` : layer === 1 ? `url(#${instance}-grid)` : tone(theme, 0, series[0]?.color)} />;
    });
  }
  return <div className={`${styles.frame} ${styles.withKey} ${activity && !compact ? styles.withSide : ""}`}>
    <svg className={styles.plot} viewBox="0 0 320 310" role="img" aria-label={example.title}
      {...selection.events} onPointerMove={move} onPointerDown={move}>
      <defs>
        <PiePattern id={`${instance}-grid`} color={tone(theme, 1, series[1]?.color)} type="hatch" />
        {!activity && <PiePattern id={`${instance}-forecast`} color={theme.muted} type="hatch" />}
      </defs>
      <circle cx={center} cy={center} r="59" fill="none" stroke={theme.grid} />
      {categories.map((_, index) => {
        const [x1, y1] = point(center, center, 53, angle(index));
        const [x2, y2] = point(center, center, 58, angle(index));
        let offset = 0;
        const projected = !activity && !data && index > hourEnd;
        return <g key={index} data-hour={categories[index]} opacity={active === null || active === index ? projected ? .62 : 1 : .32}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.muted} />
          {projected ? dots(index, 0, forecastEnergy[index], 0, true) : series.map((row, layer) => {
            const value = Math.max(0, numeric(row.values[index]));
            const marks = dots(index, layer, value, offset);
            if (value > 0) offset += Math.max(1, Math.round(value / max * levels));
            return <g key={layer}>{marks}</g>;
          })}
        </g>;
      })}
      {(data ? categories.filter((_, index) => index % Math.ceil(Math.max(1, count) / 4) === 0) : labels.map(index => hours[index].slice(0, 2))).map((tick, index, ticks) => {
        const [x, y] = point(center, center, 125, index * 360 / ticks.length - 90);
        return <text key={index} x={x} y={y + 3} fill={theme.muted} fontSize="10" textAnchor="middle">{tick}</text>;
      })}
      {(!activity || compact) && <Readout value={shown} label={label} />}
    </svg>
    {!compact && <div className={activity ? styles.cardMetrics : undefined}>
      {activity && <CardReadout value={shown} label={label} />}
      <ReadingKey>
      {series.map((row, layer) => <span key={row.name}>{row.name} <strong>{activity
        ? future ? "–" : number.format(active === null ? totals[layer] : numeric(row.values[active]))
        : `${tenths.format(totals[layer])} kWh`}</strong></span>)}
      {activity && peakIndex >= 0 && <span>Busiest hour <strong>{categories[peakIndex]} · {number.format(samples[peakIndex])} cups</strong></span>}
    </ReadingKey></div>}
    {frameStatus(`${shown} ${label}`, compact)}
  </div>;
}

function Temperature({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const uid = useId();
  const seasonal = example.id === "radial-seasonal-card";
  const rows = seasonal ? normals : observedTemperatures;
  const initial = [{ name: seasonal ? "Daily average" : "2026", values: seasonal ? normals.map(row => row.avg) : observedTemperatures.map(row => row.temperature) }];
  const { categories, series } = seriesData(data, rows.map(row => row.label), initial);
  const count = categories.length;
  const selection = useInspection(count, compact);
  const latest = data ? Math.max(0, count - 1) : rows.findIndex(row => row.date === observedEnd);
  const index = selection.active ?? (seasonal ? null : latest);
  const normal = !data && index !== null ? rows[index] : undefined;
  const activeValue = index !== null && index >= 0 ? series[0]?.values[index] : undefined;
  const average = data ? total(series[0]?.values ?? []) / Math.max(1, series[0]?.values.filter(value => value !== null).length ?? 0)
    : total(rows.map(row => row.avg)) / rows.length;
  const angle = (position: number) => -90 + (position + .5) * 360 / Math.max(1, count);
  const scale = (value: number) => data
    ? 52 + 70 * Math.max(0, value) / Math.max(1, ...series.flatMap(row => row.values).map(value => numeric(value)))
    : Math.sqrt(49 ** 2 + (Math.max(20, value) - 20) / 90 * (125 ** 2 - 49 ** 2));
  const samplePoint = (value: number, at: number) => point(chartCenter, chartCenter, scale(value), angle(at));
  function toPath(values: readonly (number | null)[], closed = false) {
    let previous = false;
    const path = values.map((value, at) => {
      if (value === null || !Number.isFinite(value)) { previous = false; return ""; }
      const command = previous ? "L" : "M";
      previous = true;
      return `${command}${samplePoint(value, at).join(" ")}`;
    }).join(" ");
    return closed && path ? `${path}Z` : path;
  }
  function band(low: "min" | "minmin", high: "max" | "maxmax") {
    const a = rows.map((row, at) => samplePoint(row[high], at).join(" "));
    const b = rows.map((row, at) => samplePoint(row[low], at).join(" ")).reverse();
    return `M${a.join(" L")} L${a[0]} L${b[0]} L${b.join(" L")} Z`;
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const phase = pointerAngle(event, chartCenter, chartCenter, 45, 140);
    selection.select(phase === null || !count ? null : Math.min(count - 1, Math.floor(phase / 360 * count)));
  }
  const forecast = index !== null && activeValue == null && normal;
  const difference = normal && activeValue != null ? activeValue - normal.avg : 0;
  const shown = index === null ? `${tenths.format(average)}°F` : `${tenths.format(activeValue ?? normal?.avg ?? 0)}°F`;
  const readout = index === null ? "annual average" : seasonal ? `average on ${categories[index]}`
    : `${selection.active === null ? "Today · " : forecast ? "Normal · " : ""}${categories[index] ?? "No data"}`;
  const normalRange = normal ? `${Math.round(normal.min)}–${Math.round(normal.max)}°F`
    : `${Math.round(Math.min(...rows.map(row => row.min)))}–${Math.round(Math.max(...rows.map(row => row.max)))}°F`;
  const recordRange = normal ? `${normal.minmin}–${normal.maxmax}°F`
    : `${Math.min(...rows.map(row => row.minmin))}–${Math.max(...rows.map(row => row.maxmax))}°F`;
  return <div className={`${styles.frame} ${styles.withKey} ${seasonal && !compact ? styles.withSide : ""}`}>
    <svg className={styles.plot} viewBox="0 0 320 320" role="img" aria-label={example.title}
      {...selection.events} onPointerMove={move} onPointerDown={move}>
      <defs>{[.23, .37].map((opacity, i) => <radialGradient key={i} id={`${uid}-band-${i}`}>
        <stop offset="0%" stopColor={tone(theme, i)} stopOpacity={opacity * .6} />
        <stop offset="100%" stopColor={tone(theme, i)} stopOpacity={opacity} />
      </radialGradient>)}</defs>
      {!seasonal && [40, 60, 80, 100].map(value => <g key={value} data-temperature-tick="">
        <circle cx={chartCenter} cy={chartCenter} r={scale(value)} fill="none" stroke={theme.grid} />
        {!data && <text x={chartCenter + 3} y={chartCenter - scale(value) - 2} fontSize="7" fill={theme.muted}>{value}°F</text>}
      </g>)}
      {!data && <><path data-temperature-band="record" d={band("minmin", "maxmax")} fill={`url(#${uid}-band-0)`} />
        <path data-temperature-band="normal" d={band("min", "max")} fill={`url(#${uid}-band-1)`} /></>}
      {series.map((row, layer) => <path data-temperature-series="" key={layer} d={toPath(row.values, seasonal || Boolean(data))} fill="none" stroke={tone(theme, layer, row.color)} strokeWidth="1.35" />)}
      {(!data ? monthNames : categories.filter((_, at) => at % Math.ceil(Math.max(1, count) / 12) === 0)).map((month, at, list) => {
        const monthAt = !data ? rows.findIndex(row => new Date(row.date).getUTCMonth() === at) : Math.floor(at * count / list.length);
        const [x, y] = point(chartCenter, chartCenter, 137, angle(monthAt));
        return <text key={at} x={x} y={y + 3} textAnchor="middle" fontSize="8" fill={theme.muted}>{month}</text>;
      })}
      {index !== null && index >= 0 && <g pointerEvents="none">
        {selection.active !== null && <line x1={chartCenter} y1={chartCenter} x2={point(chartCenter, chartCenter, 130, angle(index))[0]} y2={point(chartCenter, chartCenter, 130, angle(index))[1]} stroke={theme.grid} strokeDasharray="2 3" />}
        {(activeValue != null || normal) && <circle data-temperature-marker="" cx={samplePoint(activeValue ?? normal!.avg, index)[0]} cy={samplePoint(activeValue ?? normal!.avg, index)[1]} r="3" fill={tone(theme, 0)} stroke={theme.surface} />}
      </g>}
      {(!seasonal || compact) && <Readout value={shown} label={readout} extra={!seasonal && normal && !forecast ? `${difference >= 0 ? "+" : "−"}${tenths.format(Math.abs(difference))}° vs normal` : undefined} />}
    </svg>
    {!compact && <div className={seasonal ? styles.cardMetrics : undefined}>
      {seasonal && <CardReadout value={shown} label={readout} />}
      {!data && <ReadingKey><span>{index === null ? "Normal range" : "Normal low–high"} <strong>{normalRange}</strong></span><span>Record low–high <strong>{recordRange}</strong></span></ReadingKey>}
    </div>}
    {frameStatus(`${shown}, ${readout}${!data ? `, normal ${normalRange}, record ${recordRange}` : ""}`, compact)}
  </div>;
}

function Population({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const { categories, series } = seriesData(data, usStateAgeData.map(row => row.state),
    usAgeBands.map(({ dataKey, label }) => ({ name: label, values: usStateAgeData.map(row => row[dataKey]) })));
  const selection = useInspection(categories.length, compact);
  const index = selection.active;
  const samples = categories.map((_, at) => series.map(row => Math.max(0, numeric(row.values[at]))));
  const totals = samples.map(total);
  const maximum = data ? Math.max(1, ...totals) : 40_000_000;
  const scale = (value: number) => Math.sqrt(57 ** 2 + value / maximum * (126 ** 2 - 57 ** 2));
  const slice = 360 / Math.max(1, categories.length);
  const region = index === null ? "US population" : !data ? usStateAgeData[index]?.name ?? categories[index] : categories[index];
  const selected = index === null ? [] : samples[index];
  const biggest = selected.indexOf(Math.max(...selected));
  const caption = index === null ? data ? `${categories.length} regions` : "50 states + DC"
    : selected.length && totals[index] > 0 ? `Largest: ${series[biggest].name} · ${Math.round(selected[biggest] / totals[index] * 100)}%` : "No values";
  function move(event: PointerEvent<SVGSVGElement>) {
    const phase = pointerAngle(event, chartCenter, chartCenter, 54, 143);
    selection.select(phase === null || !categories.length ? null : Math.min(categories.length - 1, Math.floor(phase / slice)));
  }
  return <div className={`${styles.frame} ${styles.withKey}`}>
    <svg className={styles.plot} viewBox="0 0 320 320" role="img" aria-label={example.title} {...selection.events} onPointerMove={move} onPointerDown={move}>
      {[.25, .5, .75, 1].map(tick => <g key={tick}><circle cx={chartCenter} cy={chartCenter} r={scale(tick * maximum)} fill="none" stroke={theme.grid} />
        <text x={chartCenter + 3} y={chartCenter - scale(tick * maximum)} fontSize="7" fill={theme.muted}>{short.format(tick * maximum)}</text></g>)}
      {samples.map((values, at) => {
        let lower = 0;
        const start = at * slice - 90;
        const [x, y] = point(chartCenter, chartCenter, 138, start + slice / 2);
        return <g key={at} data-state={categories[at]} opacity={index === null || index === at ? 1 : .46}>
          {values.map((value, layer) => {
            const inner = scale(lower);
            lower += value;
            return value > 0 && <path key={layer} data-age-band={series[layer].name} fill={tone(theme, layer, series[layer].color)}
              d={sector(chartCenter, chartCenter, scale(lower), inner, start + slice * .08, start + slice * .92)} />;
          })}
          <text x={x} y={y + 2} textAnchor="middle" fontSize="7" fill={theme.muted}>{categories[at]}</text>
        </g>;
      })}
      <Readout value={index === null ? short.format(total(totals)) : short.format(totals[index])} label={region} extra={caption} />
    </svg>
    {!compact && <ReadingKey>{series.map((row, layer) => <span key={row.name}><i style={{ background: tone(theme, layer, row.color) }} /> {row.name}</span>)}</ReadingKey>}
    {frameStatus(index === null ? `${region}, ${caption}` : `${region}, ${caption}. ${series.map((row, layer) => `${row.name}: ${number.format(selected[layer])}`).join(", ")}`, compact)}
  </div>;
}

function Storage({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const cloudCard = example.id === "radial-storage-card";
  const fixture = cloudCard ? cloud : devices;
  const types = cloudCard ? cloudTypes : deviceTypes;
  const { categories, series } = seriesData(data, fixture.map(row => row.name), types.map((name, layer) => ({ name, values: fixture.map(row => row.values[layer]) })));
  const [highlight, setHighlight] = useState<number | null>(null);
  const selection = useInspection(categories.length, compact);
  const index = selection.active;
  const amounts = categories.map((_, at) => series.map(row => Math.max(0, numeric(row.values[at]))));
  const capacities = amounts.map((values, at) => data ? Math.max(100, total(values)) : fixture[at].capacity);
  const used = index === null ? total(amounts.map(total)) : total(amounts[index]);
  const capacity = index === null ? total(capacities) : capacities[index];
  const actual = capacity > 0 ? used / capacity : 0;
  const width = cloudCard ? 27 : Math.min(18, 62 / Math.max(1, categories.length));
  const cx = chartCenter, cy = 154, start = 180, end = 360;
  const radiusAt = (at: number) => 74 + at * (width + 5);
  const caption = cloudCard && !data ? `of 2.0 TB used · ${number.format(Math.max(0, capacity - used))} GB free`
    : `${number.format(used)} of ${number.format(capacity)} GB`;
  function move(event: PointerEvent<SVGSVGElement>) {
    const inverse = event.currentTarget.getScreenCTM()?.inverse();
    if (!inverse) return;
    const pointer = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
    const radius = Math.hypot(pointer.x - cx, pointer.y - cy);
    const selected = categories.findIndex((_, at) => Math.abs(radiusAt(at) - radius) <= width / 2 + 1);
    selection.select(pointer.y <= cy && selected !== -1 ? selected : null);
  }
  return <div className={`${styles.frame} ${styles.withKey}`}>
    <svg className={styles.plot} viewBox="0 0 320 195" role="img" aria-label={example.title} {...selection.events} onPointerMove={move} onPointerDown={move}>
      {!cloudCard && [0, 25, 50, 75, 100].map(tick => {
        const angle = start + tick * 1.8;
        const [x1, y1] = point(cx, cy, 59, angle);
        const [x2, y2] = point(cx, cy, 129, angle);
        const [x, y] = point(cx, cy, 141, angle);
        return <g key={tick} data-storage-tick=""><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.grid} />
          <text x={x} y={y - 2} textAnchor="middle" fontSize="8" fill={theme.muted}>{tick}%</text></g>;
      })}
      {amounts.map((values, at) => {
        const radius = radiusAt(at);
        let angle = start;
        return <g key={at} data-device={categories[at]} opacity={index === null || index === at ? 1 : .38}>
          <path data-device-track="" d={arc(cx, cy, radius, start, end)} fill="none" stroke={theme.grid} strokeWidth={width} />
          {values.map((amount, layer) => {
            const from = angle;
            angle += 180 * amount / Math.max(1, capacities[at]);
            const gap = Math.min(.7, (angle - from) / 4);
            return amount > 0 && <path key={layer} data-storage-type={series[layer].name}
              d={arc(cx, cy, radius, from + gap, angle - gap)} fill="none" stroke={tone(theme, layer, series[layer].color)}
              strokeWidth={width} opacity={highlight === null || highlight === layer ? 1 : .3} />;
          })}
          {!cloudCard && <text x={cx - radius} y={cy + 6} transform={`rotate(80 ${cx - radius} ${cy + 6})`} textAnchor="start" fill={theme.muted} fontSize="7.5">{categories[at]}</text>}
        </g>;
      })}
      <Readout x={cx} y={cy - 33} value={cloudCard && !data ? `${tenths.format(used / 1000)} TB` : `${Math.round(actual * 100)}%`}
        label={cloudCard ? caption : index === null ? "used across devices" : `${categories[index]} used`} extra={cloudCard ? undefined : caption} />
    </svg>
    {!compact && <ReadingKey>{series.map((row, layer) => <Button key={row.name} data-active={highlight === layer}
      onPointerEnter={() => setHighlight(layer)} onPointerLeave={() => setHighlight(null)}
      onFocus={() => setHighlight(layer)} onBlur={() => setHighlight(null)} onClick={() => setHighlight(highlight === layer ? null : layer)}>
      <i style={{ background: tone(theme, layer, row.color) }} />{row.name}{cloudCard && <strong>{number.format(total(row.values))} GB</strong>}
    </Button>)}</ReadingKey>}
    {frameStatus(`${index === null ? "Storage" : categories[index]}, ${caption}`, compact)}
  </div>;
}
