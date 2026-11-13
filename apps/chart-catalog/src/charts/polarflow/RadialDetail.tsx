import { arc as d3Arc, areaRadial, curveCatmullRom, curveCatmullRomClosed, curveLinearClosed, lineRadial } from "d3-shape";
import NumberFlow from "@number-flow/react";
import { useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { Button } from "@ui-sdk/react/button";
import { usePlotSize } from "../usePlotSize";
import { useChartTheme } from "../theme";
import { arc, nextChartFocus, number, numeric, point, seriesData, short, tone, type Props } from "./shared";
import { ClockAxis, dotStack, polarTurn, radialDots, radialPoint, radialRadius } from "./radial-geometry";
import { cafeOrders, cloud, cloudTypes, devices, deviceTypes, forecastEnergy, hourEnd, hours, meteredEnergy, monthNames, observedEnd, observedTemperatures } from "./radial-fixtures";
import { usAgeBands, usStateAgeData } from "./upstream/us-state-age-data";
import styles from "./radial-detail.module.css";
import shared from "./styles.module.css";

const tenths = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const tenthsFormat = { minimumFractionDigits: 1, maximumFractionDigits: 1 };
const total = (items: readonly (number | null)[]) => items.reduce<number>((sum, item) => sum + (item ?? 0), 0);
const categoriesAtQuarters = [0, 6, 12, 18].map(hour => hours[hour].slice(0, 2));

function useInspection(count: number, compact?: boolean) {
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const requested = hover ?? focus;
  const active = requested !== null && requested < count ? requested : null;
  return {
    active,
    select: (index: number | null) => { if (!compact) setHover(index); },
    events: {
      tabIndex: compact || !count ? undefined : 0,
      onBlur: () => setFocus(null),
      onPointerLeave: (event: PointerEvent<SVGSVGElement>) => { if (event.pointerType !== "touch") setHover(null); },
      onKeyDown: (event: KeyboardEvent<SVGSVGElement>) => {
        if (event.key === "Escape" && active !== null) {
          event.preventDefault();
          event.stopPropagation();
          setHover(null);
          setFocus(null);
          return;
        }
        const next = nextChartFocus(event.key, active, count);
        if (next !== undefined) {
          event.preventDefault();
          setHover(null);
          setFocus(next);
        }
      },
    },
  };
}

function pointerAngle(event: PointerEvent<SVGSVGElement>, center: number, min: number, max: number) {
  const inverse = event.currentTarget.getScreenCTM()?.inverse();
  if (!inverse) return null;
  const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
  const x = p.x - center, y = p.y - center;
  const distance = Math.hypot(x, y);
  if (distance < min || distance > max) return null;
  return (Math.atan2(x, -y) + polarTurn) % polarTurn;
}

function frameStatus(text: string, compact?: boolean) {
  return !compact && <span className={shared.screenReader} role="status">{text}</span>;
}

function Center({ center, size, offset = 0, temperature, children }: {
  center: number; size: number; offset?: number; temperature?: boolean; children: ReactNode;
}) {
  return <foreignObject x={center - size / 2} y={center - size / 2 - offset} width={size} height={size} pointerEvents="none" aria-hidden="true">
    <div className={styles.center} data-temperature={temperature || undefined} style={{ "--radial-center-size": `${size}px` } as CSSProperties}>{children}</div>
  </foreignObject>;
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
  const { plot, width } = usePlotSize<SVGSVGElement>(activity ? 220 : 640, activity ? 220 : 640);
  const { categories, series } = seriesData(data, hours, activity ? cafeOrders : meteredEnergy);
  const count = categories.length;
  const selection = useInspection(count, compact);
  const active = selection.active;
  const future = !data && active !== null && active > hourEnd;
  const samples = categories.map((_, index) => total(series.map(row => row.values[index] ?? null)));
  const totals = series.map(row => total(row.values));
  const maximum = data ? Math.max(1, ...samples) : activity ? 106 : 3.2;
  const activeTotal = active === null ? total(totals) : samples[active] ?? 0;
  const label = active === null ? activity ? "cups sold today" : "kWh so far" : activity
    ? `cups ${categories[active]}–${categories[(active + 1) % count]}${future ? " · later today" : ""}`
    : future ? `forecast ${categories[active]}` : `kWh at ${categories[active]}`;
  const value = future && !activity ? forecastEnergy[active!] : activeTotal;
  const shown = activity ? future ? "–" : number.format(value) : tenths.format(value);
  const peak = samples.indexOf(Math.max(...samples));
  const center = width / 2;
  const inner = center * .408, outer = center * .83;
  const spacing = (outer - inner) / 5;
  const dots = radialDots(count, inner, outer, 5, true);
  const colors = series.map((row, i) => tone(theme, data ? i : activity ? [0, 2][i] : [1, 0][i], row.color));
  const slice = polarTurn / Math.max(1, count);
  const labelText = data ? categoriesAtQuarters.map((_, i) => categories[Math.floor(i * count / 4)] ?? "") : categoriesAtQuarters;
  function move(event: PointerEvent<SVGSVGElement>) {
    const phase = pointerAngle(event, center, center * .35, center * .98);
    selection.select(phase === null || !count ? null : Math.min(count - 1, Math.floor(phase / slice)));
  }
  function pattern(id: string, color: string, strokeWidth: number) {
    return <pattern id={id} width=".25" height=".25" viewBox="0 0 6 6">
      <path d="M-2 1L1 -2M-1 6L6 -1M4 7L7 4" fill="none" stroke={color} strokeWidth={strokeWidth} />
    </pattern>;
  }
  return <div className={styles.frame} data-radial-activity={activity || undefined} data-radial-compact={compact || undefined}>
    <svg ref={plot} className={styles.plot} viewBox={`0 0 ${width} ${width}`} role="img" aria-roledescription="chart" aria-label={example.title}
      {...selection.events} onPointerMove={move} onPointerDown={move}>
      <defs>
        {pattern(`${instance}-grid`, colors[1] ?? theme.muted, 1.5)}
        {!activity && pattern(`${instance}-forecast`, theme.muted, 1)}
      </defs>
      <g transform={`translate(${center} ${center})`} aria-hidden="true">
        <ClockAxis radius={center} theme={theme} labels={labelText} />
        {categories.map((time, index) => {
          const projected = !activity && !data && index > hourEnd;
          const readings = projected ? [forecastEnergy[index]] : series.map(row => numeric(row.values[index]));
          const levels = dotStack(readings, maximum, inner, outer, 5);
          return <g key={index} data-hour={time}>{dots[index].map(({ row, x, y }) => {
            const layer = levels.findIndex(end => row < end);
            if (layer < 0) return null;
            const hatch = layer === 1 && !data;
            return <circle key={row} data-dot-type={projected ? "forecast" : "actual"} data-dot-series={layer} cx={x} cy={y}
              r={Math.max(0, spacing * .45 - (hatch ? .5 : 0))} stroke={hatch ? colors[layer] : undefined}
              opacity={projected ? .6 : 1} fill={projected ? `url(#${instance}-forecast)` : hatch ? `url(#${instance}-grid)` : colors[layer]} />;
          })}</g>;
        })}
        {(!activity || active !== null) && <g transform={`rotate(${((active ?? hourEnd) + .5) * 360 / Math.max(1, count)})`}>
          <line x1="0" y1={-center * .38} x2="0" y2={-center * .895} stroke={theme.text} strokeOpacity=".45" strokeDasharray="3 3" />
          <circle cx="0" cy={-center * .895} r={Math.max(2.5, width * .0055)} fill={theme.text} />
        </g>}
      </g>
      {(!activity || compact) && <Center center={center} size={center * .69}>
        <strong>{compact ? shown : <NumberFlow value={value} locales="en-US" format={tenthsFormat} respectMotionPreference />}</strong><span>{label}</span>
      </Center>}
    </svg>
    {!compact && <div className={activity ? styles.cardMetrics : undefined}>
      {activity && <CardReadout value={shown} label={label} />}
      <ReadingKey>
        {series.map((row, layer) => <span key={layer}><i style={{ background: colors[layer] }} />{row.name} <strong>{activity
          ? future ? "–" : number.format(active === null ? totals[layer] : numeric(row.values[active]))
          : `${tenths.format(totals[layer])} kWh`}</strong></span>)}
        {activity && peak >= 0 && <span><i style={{ background: theme.muted }} />Busiest hour <strong>{categories[peak]} · {number.format(samples[peak])} cups</strong></span>}
      </ReadingKey>
    </div>}
    {frameStatus(`${shown} ${label}`, compact)}
  </div>;
}

function Temperature({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const seasonal = example.id === "radial-seasonal-card";
  const { plot, width } = usePlotSize<SVGSVGElement>(seasonal ? 240 : 640, seasonal ? 240 : 640);
  const rows = observedTemperatures;
  const initial = [{ name: seasonal ? "Daily average" : "2026", values: rows.map(row => seasonal ? row.avg : row.temperature) }];
  const { categories, series } = seriesData(data, rows.map(row => row.label), initial);
  const count = categories.length;
  const selection = useInspection(count, compact);
  const latest = data ? count - 1 : rows.findIndex(row => row.date === observedEnd);
  const index = selection.active ?? (seasonal ? null : latest);
  const normal = !data && index !== null ? rows[index] : undefined;
  const activeValue = index !== null && index >= 0 ? series[0]?.values[index] : undefined;
  const average = data ? total(series[0]?.values ?? []) / Math.max(1, series[0]?.values.filter(value => value !== null).length ?? 0)
    : total(rows.map(row => row.avg)) / rows.length;
  const center = width / 2;
  const inner = center * .408, outer = center * .83;
  const slice = polarTurn / Math.max(1, count);
  const angle = (position: number) => (position + .5) * slice;
  const domain = series.flatMap(row => row.values.filter(value => value != null));
  const scale = (value: number) => radialRadius(value, data ? Math.min(0, ...domain) : 32, data ? Math.max(1, ...domain) : 105, inner, outer);
  const indices = categories.map((_, i) => i);
  const monthBoundaries = !data ? [...monthNames.map((_, month) => rows.findIndex(row => new Date(row.date).getUTCMonth() === month)), count]
    : Array.from({ length: 13 }, (_, i) => Math.floor(i * count / 12));
  const band = (low: "min" | "minmin", high: "max" | "maxmax") => areaRadial<number>().angle(angle)
    .innerRadius(i => scale(rows[i][low])).outerRadius(i => scale(rows[i][high])).curve(curveLinearClosed)(indices) ?? undefined;
  function move(event: PointerEvent<SVGSVGElement>) {
    const phase = pointerAngle(event, center, center * .32, center * .98);
    selection.select(phase === null || !count ? null : Math.min(count - 1, Math.floor(phase / slice)));
  }
  const forecast = index !== null && activeValue == null && normal;
  const difference = normal && activeValue != null ? Math.round((activeValue - normal.avg) * 10) / 10 : 0;
  const value = index === null ? average : activeValue ?? normal?.avg ?? 0;
  const shown = `${tenths.format(value)}°F`;
  const readout = index === null ? "annual average" : seasonal ? `average on ${categories[index]}`
    : `${!data && index === latest ? "Today · " : ""}${categories[index] ?? "No data"}`;
  const delta = forecast ? "normal average" : difference === 0 ? "at normal" : `${difference > 0 ? "+" : "−"}${tenths.format(Math.abs(difference))}° vs normal`;
  const normalRange = normal ? `${Math.round(normal.min)}–${Math.round(normal.max)}°F`
    : `${Math.round(Math.min(...rows.map(row => row.min)))}–${Math.round(Math.max(...rows.map(row => row.max)))}°F`;
  const recordRange = normal ? `${normal.minmin}–${normal.maxmax}°F`
    : `${Math.min(...rows.map(row => row.minmin))}–${Math.max(...rows.map(row => row.maxmax))}°F`;
  const [markerX, markerY] = radialPoint(scale(value), angle(index ?? 0));
  return <div className={styles.frame} data-radial-seasonal={seasonal || undefined} data-radial-compact={compact || undefined}>
    <svg ref={plot} className={styles.plot} viewBox={`0 0 ${width} ${width}`} role="img" aria-roledescription="chart" aria-label={example.title}
      {...selection.events} onPointerMove={move} onPointerDown={move}>
      <g transform={`translate(${center} ${center})`} aria-hidden="true">
        {monthBoundaries.map((at, i) => {
          const [x1, y1] = radialPoint(inner, at * slice);
          const [x2, y2] = radialPoint(outer, at * slice);
          return <line key={i} data-temperature-spoke="" x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.text} strokeOpacity=".12" strokeLinecap="round" />;
        })}
        {!seasonal && !data && [40, 60, 80, 100].map(tick => <g key={tick} data-temperature-tick="">
          <circle r={scale(tick)} fill="none" stroke={theme.text} strokeOpacity=".12" />
          <text className={styles.halo} y={-scale(tick)} fontSize={Math.max(8.5, center * .03825)} dominantBaseline="middle" textAnchor="middle" fill={theme.muted}>{tick}°F</text>
        </g>)}
        {!data && <><path data-temperature-band="record" d={band("minmin", "maxmax")} fill={theme.colors[0]} fillOpacity=".14" />
          <path data-temperature-band="normal" d={band("min", "max")} fill={theme.colors[0]} fillOpacity={seasonal ? .30 : .28} /></>}
        {series.map((row, layer) => <path data-temperature-series="" key={layer}
          d={lineRadial<number>().angle(angle).radius(i => scale(numeric(row.values[i]))).defined(i => row.values[i] != null)
            .curve(row.values.length === count && row.values.every(value => value !== null) ? curveCatmullRomClosed : curveCatmullRom)(indices) ?? undefined}
          fill="none" stroke={tone(theme, layer, row.color)} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />)}
        {monthBoundaries.slice(0, -1).map((at, i) => {
          if (data && (at >= count || at === monthBoundaries[i + 1])) return null;
          const [x, y] = radialPoint(center * .955, (at + monthBoundaries[i + 1]) / 2 * slice);
          return <text key={i} data-temperature-month="" x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(10, center * .045)} fill={theme.muted}>{data ? categories[at] : monthNames[i]}</text>;
        })}
        {index !== null && index >= 0 && <g pointerEvents="none">
          {selection.active !== null && <line x1={radialPoint(inner, angle(index))[0]} y1={radialPoint(inner, angle(index))[1]} x2={radialPoint(center * .895, angle(index))[0]}
            y2={radialPoint(center * .895, angle(index))[1]} stroke={theme.muted} strokeOpacity=".5" />}
          {(activeValue != null || normal) && <><circle cx={markerX} cy={markerY} r={width * .016} fill={theme.colors[0]} opacity=".16" />
            <circle data-temperature-marker="" cx={markerX} cy={markerY} r={Math.max(3.5, width * .008)} fill={theme.colors[0]} stroke={theme.surface} strokeWidth={Math.max(1, width * .004)} /></>}
        </g>}
      </g>
      {(!seasonal || compact) && <Center center={center} size={center * .69} temperature>
        <span>{readout}</span><strong>{compact ? shown : <NumberFlow value={value} locales="en-US" format={tenthsFormat} suffix="°F" respectMotionPreference />}</strong>
        {!data && <><span>{delta}</span><span>normal {normalRange.replace("°F", "°")}</span><span>record {recordRange.replace("°F", "°")}</span></>}
      </Center>}
    </svg>
    {!compact && seasonal && <div className={styles.cardMetrics}>
      <CardReadout value={shown} label={readout} />
      {!data && <ReadingKey>
        <span><i style={{ background: theme.colors[0], opacity: .45 }} />{index === null ? "Normal range" : "Normal low–high"} <strong>{normalRange}</strong></span>
        <span><i style={{ background: theme.colors[0], opacity: .24 }} />Record low–high <strong>{recordRange}</strong></span>
      </ReadingKey>}
    </div>}
    {frameStatus(`${shown}, ${readout}${!data ? `, normal ${normalRange}, record ${recordRange}` : ""}`, compact)}
  </div>;
}

function Population({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const { plot, width } = usePlotSize<SVGSVGElement>(640, 640);
  const { categories, series } = seriesData(data, usStateAgeData.map(row => row.state),
    usAgeBands.map(({ dataKey, label }) => ({ name: label, values: usStateAgeData.map(row => row[dataKey]) })));
  const selection = useInspection(categories.length, compact);
  const index = selection.active;
  const samples = categories.map((_, at) => series.map(row => Math.max(0, numeric(row.values[at]))));
  const totals = samples.map(total);
  const maximum = data ? Math.max(1, ...totals) : 40_000_000;
  const center = width / 2;
  const inner = center * .408, outer = center * .83;
  const scale = (value: number) => radialRadius(value, 0, maximum, inner, outer);
  const slice = polarTurn / Math.max(1, categories.length);
  const region = index === null ? "US population" : !data ? usStateAgeData[index]?.name ?? categories[index] : categories[index];
  const selected = index === null ? [] : samples[index];
  const biggest = selected.indexOf(Math.max(...selected));
  const caption = index === null ? data ? `${categories.length} regions` : "50 states + DC"
    : selected.length && totals[index] > 0 ? `Largest: ${series[biggest].name} · ${Math.round(selected[biggest] / totals[index] * 100)}%` : "No values";
  const value = index === null ? total(totals) : totals[index];
  const wedge = d3Arc().padRadius(inner);
  function move(event: PointerEvent<SVGSVGElement>) {
    const phase = pointerAngle(event, center, inner - 2, center * .96);
    selection.select(phase === null || !categories.length ? null : Math.min(categories.length - 1, Math.floor(phase / slice)));
  }
  return <div className={styles.frame} data-radial-compact={compact || undefined}>
    <svg ref={plot} className={styles.plot} viewBox={`0 0 ${width} ${width}`} role="img" aria-roledescription="chart" aria-label={example.title}
      {...selection.events} onPointerMove={move} onPointerDown={move}>
      <g transform={`translate(${center} ${center})`} aria-hidden="true">
        {[.25, .5, .75, 1].map(tick => <g key={tick} data-population-tick=""><circle r={scale(tick * maximum)} fill="none" stroke={theme.text} strokeOpacity=".12" />
          <text className={styles.halo} x="0" y={-scale(tick * maximum)} fontSize={Math.max(8.5, center * .03825)} textAnchor="middle" dominantBaseline="middle" fill={theme.muted}>{short.format(tick * maximum)}</text>
        </g>)}
        {samples.map((values, at) => {
          let lower = 0;
          const middle = (at + .5) * slice;
          const [x, y] = radialPoint(outer + center * .03, middle);
          const left = middle > Math.PI;
          return <g key={at} data-state={categories[at]} opacity={index === null || index === at ? 1 : .3}>
            {values.map((value, layer) => {
              const innerRadius = scale(lower);
              lower += value;
              return value > 0 && <path key={layer} data-age-band={series[layer].name} fill={tone(theme, layer, series[layer].color)}
                d={wedge({ innerRadius, outerRadius: scale(lower), startAngle: at * slice, endAngle: (at + 1) * slice, padAngle: slice * .18 }) ?? undefined} />;
            })}
            <text data-population-state="" x={x} y={y} textAnchor={left ? "end" : "start"} dominantBaseline="middle"
              transform={`rotate(${middle * 180 / Math.PI - 90 + (left ? 180 : 0)} ${x} ${y})`} fontSize={Math.max(8, center * .036)} fill={theme.muted}>{categories[at]}</text>
          </g>;
        })}
      </g>
      <Center center={center} size={center * .69}><strong>{short.format(value)}</strong><span>{region}</span><span>{caption}</span></Center>
    </svg>
    {!compact && <ReadingKey>{series.map((row, layer) => <span key={layer}><i style={{ background: tone(theme, layer, row.color) }} /> {row.name}</span>)}</ReadingKey>}
    {frameStatus(index === null ? `${region}, ${caption}` : `${region}, ${caption}. ${series.map((row, layer) => `${row.name}: ${number.format(selected[layer])}`).join(", ")}`, compact)}
  </div>;
}

function Storage({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const cloudCard = example.id === "radial-storage-card";
  const { plot, width } = usePlotSize<SVGSVGElement>(640, 358.4);
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
  const radius = width / 2;
  const inner = radius * (cloudCard ? .66 : .408);
  const outer = radius * (cloudCard ? .90 : .83);
  const step = (outer - inner) / Math.max(1, categories.length);
  const halfGap = cloudCard ? 0 : step * .09;
  const start = -Math.PI / 2, end = Math.PI / 2;
  const rounded = d3Arc().cornerRadius(cloudCard ? 4 : 3);
  const caption = cloudCard && !data ? `of 2.0 TB used · ${number.format(Math.max(0, capacity - used))} GB free`
    : `${number.format(used)} of ${number.format(capacity)} GB`;
  function move(event: PointerEvent<SVGSVGElement>) {
    const inverse = event.currentTarget.getScreenCTM()?.inverse();
    if (!inverse) return;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(inverse);
    const distance = Math.hypot(p.x - radius, p.y - radius);
    const active = Math.floor((distance - inner) / step);
    selection.select(p.y <= radius && active >= 0 && active < categories.length ? active : null);
  }
  return <div className={styles.frame} data-radial-compact={compact || undefined}>
    <svg ref={plot} className={styles.plot} viewBox={`0 0 ${width} ${width * .56}`} role="img" aria-roledescription="chart" aria-label={example.title}
      {...selection.events} onPointerMove={move} onPointerDown={move}>
      <g transform={`translate(${radius} ${radius})`} aria-hidden="true">
        {!cloudCard && <>
          <path data-storage-outer="" d={arc(0, 0, outer, 180, 360)} fill="none" stroke={theme.text} strokeOpacity=".12" />
          {[0, 25, 50, 75, 100].map(tick => {
            const angle = 180 + tick * 1.8;
            const [x1, y1] = point(0, 0, inner, angle);
            const [x2, y2] = point(0, 0, outer, angle);
            const [x, y] = point(0, 0, radius * .955, angle);
            return <g key={tick} data-storage-tick=""><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={theme.text} strokeOpacity=".12" strokeLinecap="round" />
              <text x={x} y={y} dominantBaseline="middle" textAnchor="middle" fontSize={Math.max(10, radius * .045)} fill={theme.muted}>{tick}%</text>
            </g>;
          })}
        </>}
        {amounts.map((values, at) => {
          const innerRadius = inner + at * step + halfGap;
          const outerRadius = inner + (at + 1) * step - halfGap;
          const last = values.reduce((lastPositive, value, layer) => value > 0 ? layer : lastPositive, -1);
          const first = values.findIndex(value => value > 0);
          const pad = 3 / Math.hypot(innerRadius, outerRadius);
          const x = -(innerRadius + outerRadius) / 2, y = Math.max(6, radius * .027);
          let angle = start;
          return <g key={at} data-device={categories[at]} opacity={index === null || index === at ? 1 : .38}>
            <path data-device-track="" d={rounded({ innerRadius, outerRadius, startAngle: start, endAngle: end }) ?? undefined} fill={theme.text} fillOpacity=".06" />
            {values.map((amount, layer) => {
              const from = angle;
              angle += Math.PI * amount / Math.max(1, capacities[at]);
              return amount > 0 && <path key={layer} data-storage-type={series[layer].name}
                d={rounded({ innerRadius, outerRadius, startAngle: from - (layer === first ? pad / 2 : 0), endAngle: angle + (layer === last ? pad / 2 : 0), padAngle: pad }) ?? undefined}
                fill={tone(theme, layer, series[layer].color)} opacity={highlight === null || highlight === layer ? 1 : .3} />;
            })}
            {!cloudCard && <text data-storage-label="" x={x} y={y} transform={`rotate(-90 ${x} ${y})`} textAnchor="end" dominantBaseline="middle" fill={theme.muted} fontSize={Math.max(8, radius * .036)}>{categories[at]}</text>}
          </g>;
        })}
      </g>
      <Center center={radius} size={radius * (cloudCard ? 1.19 : .69)} offset={radius * (cloudCard ? .262 : .207)}>
        <strong>{cloudCard && !data ? `${tenths.format(used / 1024)} TB` : `${Math.round(actual * 100)}%`}</strong>
        <span>{cloudCard ? caption : index === null ? "used across devices" : `${categories[index]} used`}</span>
        {!cloudCard && <span>{caption}</span>}
      </Center>
    </svg>
    {!compact && <ReadingKey>{series.map((row, layer) => <Button key={layer} data-active={highlight === layer}
      onPointerEnter={() => setHighlight(layer)} onPointerLeave={() => setHighlight(null)}
      onFocus={() => setHighlight(layer)} onBlur={() => setHighlight(null)} onClick={() => setHighlight(highlight === layer ? null : layer)}>
      <i style={{ background: tone(theme, layer, row.color) }} />{row.name}{cloudCard && <strong>{number.format(total(row.values))} GB</strong>}
    </Button>)}</ReadingKey>}
    {frameStatus(`${index === null ? "Storage" : categories[index]}, ${caption}`, compact)}
  </div>;
}
