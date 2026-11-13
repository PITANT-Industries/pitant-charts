import { Button } from "@ui-sdk/react/button";
import { useId, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { useChartTheme } from "../theme";
import { usePlotSize } from "../usePlotSize";
import { metrics, nextChartFocus, number, percent, short, tone, type Props } from "./shared";
import styles from "./styles.module.css";
import funnel from "./funnel.module.css";

const pipeline = { stages: ["Visitors", "Leads", "Qualified", "Proposals", "Closed"], values: [12400, 6800, 3200, 1500, 620] };
const fixtures = {
  "funnel-vertical": { stages: ["Landing", "Started", "Verified", "Onboarded", "Activated"], values: [48200, 21700, 15900, 9400, 5300] },
  "funnel-vertical-curved": { stages: ["Sent", "Delivered", "Opened", "Clicked", "Converted"], values: [52000, 49100, 21300, 4800, 910] },
  "funnel-colors": { stages: ["Leads", "Qualified", "Proposal", "Won"], values: [5000, 3100, 1900, 1200] },
  "funnel-pattern": { stages: ["Installs", "Accounts", "Subscribed", "Renewed"], values: [24800, 14300, 3900, 2650] },
  "funnel-interactive": { stages: ["Product views", "Added to cart", "Checkout", "Payment", "Purchased"], values: [18600, 7450, 3980, 2710, 2240] },
  "funnel-straight": { stages: ["Trials", "Activated", "Invited team", "Paid"], values: [9600, 5100, 2700, 1400] },
  "funnel-gradient": { stages: ["Awareness", "Interest", "Consideration", "Intent", "Purchase"], values: [4100, 2957, 1084, 1038, 320] },
  "funnel-grouped": { stages: ["Applied", "Screened", "Interviewed", "Offered", "Hired"], values: [2480, 1120, 386, 64, 41] },
  "funnel-grid": { stages: ["Signed up", "Verified", "Profile", "First project", "Invited"], values: [8200, 6100, 4300, 2900, 2200] },
};
const haloScales = [1, 1 - .35 / 3, 1 - .7 / 3];
const haloOpacities = [.18, .51, .83];
const funnelFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumSignificantDigits: 2 });
const footers: Record<string, readonly [string, string]> = {
  "funnel-default": ["5% of visitors closed, up from 4.1% in Q2", "July 1 to September 30, 2026"],
  "funnel-vertical": ["11% of visitors activated", "The biggest drop is from landing to starting a signup"],
  "funnel-vertical-curved": ["43% of delivered emails were opened", "Sent October 7, 2026, tracked for 30 days"],
  "funnel-colors": ["24% of leads won", "January 1 to November 8, 2026"],
  "funnel-pattern": ["68% of subscribers renewed", "Installs from September 1 to 30, renewals through November 8"],
  "funnel-legend": ["620 deals closed from 12,400 visitors", "Hover a stage or a row to follow it through the pipeline"],
  "funnel-straight": ["15% of trials became paying teams", "Trials started October 1 to 31, 2026"],
  "funnel-gradient": ["7.8% of the audience reached purchase", "September 15 to October 31, 2026"],
  "funnel-grouped": ["64% of offers were accepted", "January 1 to November 8, 2026"],
  "funnel-grid": ["27% of sign-ups invited a teammate", "Accounts created October 1 to 31, 2026"],
};

function funnelSegment(vertical: boolean, straight: boolean, start: number, end: number, center: number, from: number, to: number) {
  const at = (along: number, cross: number) => vertical ? `${cross} ${along}` : `${along} ${cross}`;
  const bend = (end - start) * .55;
  const edge = (a: number, x: number, b: number, y: number) => straight ? `L ${at(b, y)}` :
    `C ${at(a + (a < b ? bend : -bend), x)} ${at(b + (a < b ? -bend : bend), y)} ${at(b, y)}`;
  return `M ${at(start, center - from)} ${edge(start, center - from, end, center - to)} L ${at(end, center + to)} ${edge(end, center + to, start, center + from)} Z`;
}

export function Funnel({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const { plot, width, height } = usePlotSize<SVGSVGElement>(728, 331);
  const { plot: frame, height: frameHeight } = usePlotSize<HTMLDivElement>(728, 168);
  const uid = useId();
  const [pointer, setPointer] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const id = example.id;
  const fixture = fixtures[id as keyof typeof fixtures] ?? pipeline;
  const rows = metrics(data, fixture.stages, fixture.values);
  const active = [pointer, pinned, focus].find(index => index !== null && index < rows.length) ?? null;
  const baseline = rows[0]?.value ?? 0;
  const maximum = rows.reduce((max, row) => Math.max(max, row.value), 1);
  const vertical = id.includes("vertical");
  const straight = id === "funnel-vertical" || id === "funnel-straight";
  const grid = id === "funnel-vertical" || id === "funnel-grid";
  const customColors = id === "funnel-colors";
  const gradient = id === "funnel-gradient";
  const colorStages = customColors || gradient;
  const grouped = id === "funnel-grouped" || customColors;
  const pattern = id === "funnel-pattern";
  const interactive = id === "funnel-interactive";
  const legend = !compact && id === "funnel-legend";
  const fullValues = pattern || grouped || interactive || gradient;
  const logicalHeight = vertical ? width * 1.8 : width / 2.2;
  const length = vertical ? logicalHeight : width;
  const gap = Math.min(4, length / Math.max(1, rows.length * 2));
  const step = (length + gap) / Math.max(1, rows.length);
  const center = (vertical ? width : logicalHeight) / 2;
  const half = center * .88;
  const plotHeight = Math.max(1, height);
  const stage = active === null ? undefined : rows[active];
  const previous = active === null ? undefined : rows[active - 1];
  const ratio = (value: number) => `${percent(value, baseline).toFixed(id === "funnel-vertical" ? 1 : 0)}%`;
  const stageColor = (index: number) => {
    const colorIndex = colorStages ? index % theme.colors.length : interactive ? 2 : id === "funnel-straight" || pattern ? 1 : 0;
    return rows[index]?.color ?? `var(--chart-${colorIndex + 1}, ${tone(theme, colorIndex)})`;
  };
  const formatValue = (value: number) => (fullValues ? number : id === "funnel-vertical-curved" ? funnelFormat : short).format(value).toLowerCase();
  const activeText = stage ? `${stage.name}: ${number.format(stage.value)}${data ? "" : " sessions"}, ${ratio(stage.value)} of ${data ? "first stage" : "views"}` : "";
  const drop = previous && stage ? previous.value > 0
    ? `${Math.max(0, Math.round(100 - percent(stage.value, previous.value)))}% dropped off after ${previous.name.toLocaleLowerCase()}`
    : `Previous stage: ${previous.name}, ${number.format(previous.value)}`
    : data ? "First stage" : "Every session that viewed a product";
  const summary = data ? `${number.format(rows.at(-1)?.value ?? 0)} at the final stage out of ${number.format(baseline)} at the first` :
    `${number.format(rows.at(-1)?.value ?? 0)} purchases from ${number.format(baseline)} product views`;
  const footer = interactive
    ? stage ? [activeText, drop] : [summary, "Hover a stage, or tab to the chart and use the arrow keys"]
    : data ? undefined : footers[id];
  const labelColor = `var(--foreground, ${theme.text})`;
  const mutedColor = `var(--muted-foreground, ${theme.muted})`;
  const pillTextColor = `var(--background, ${theme.surface})`;

  function clear() {
    setPointer(null);
    setFocus(null);
    setPinned(null);
  }

  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      event.stopPropagation();
      clear();
      return;
    }
    const next = nextChartFocus(event.key, focus === null ? active : Math.min(focus, rows.length - 1), rows.length);
    if (next !== undefined) {
      event.preventDefault();
      setPointer(null);
      setPinned(null);
      setFocus(next);
    }
  }

  return <div ref={frame} className={`${styles.frame} ${funnel.frame}`} data-compact={Boolean(compact)}
    style={{ "--funnel-height": `${frameHeight}px` } as CSSProperties}>
    <svg ref={plot} className={`${styles.native} ${funnel.plot}`} viewBox={`0 0 ${width} ${plotHeight}`} data-vertical={vertical}
      role="img" aria-roledescription="chart" aria-label={example.title} tabIndex={compact ? undefined : 0}
      onKeyDown={compact ? undefined : key}
      onBlur={() => setFocus(null)} onPointerLeave={() => setPointer(null)}>
      <defs>{rows.map((_, index) => <g key={index}>
        {(gradient || customColors && index === 0) && <linearGradient id={`${uid}-gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={stageColor(index)} />
          <stop offset="100%" stopColor={stageColor(Math.min(rows.length - 1, index + 1))} />
        </linearGradient>}
        {pattern && <pattern id={`${uid}-pattern-${index}`} patternUnits="userSpaceOnUse" width="6" height="6"
          patternTransform={`translate(${Math.round(index * step)} 0)`}>
          <rect width="6" height="6" fill={stageColor(index)} fillOpacity=".35" />
          <path d="M0 6 L6 0" stroke={stageColor(index)} strokeWidth="1.5" />
        </pattern>}
      </g>)}</defs>
      {grid && <g data-funnel-grid="" aria-hidden="true">{rows.map((_, index) => {
        const a = index * step;
        const boundary = a - gap / 2;
        return <g key={index}>
          {index % 2 === 0 && <rect data-funnel-band="" x={vertical ? .75 : a + .75} y={vertical ? a + .75 : .75}
            width={Math.max(0, (vertical ? width : step - gap) - 1.5)}
            height={Math.max(0, (vertical ? step - gap : logicalHeight) - 1.5)} fill={`var(--muted, ${theme.grid})`} />}
          {index > 0 && <line x1={vertical ? 0 : boundary} x2={vertical ? width : boundary}
            y1={vertical ? boundary : 0} y2={vertical ? boundary : logicalHeight} stroke={`var(--chart-grid, ${theme.grid})`} />}
        </g>;
      })}</g>}
      {rows.map((row, index) => {
        const a = Math.round(index * step);
        const b = a + step - gap;
        const middle = index * step + (step - gap) / 2;
        const from = half * Math.max(0, row.value) / maximum;
        const to = half * Math.max(0, rows[index + 1]?.value ?? row.value) / maximum;
        const color = stageColor(index);
        const fill = pattern ? `url(#${uid}-pattern-${index})` :
          gradient || customColors && index === 0 ? `url(#${uid}-gradient-${index})` : color;
        const percentage = ratio(row.value);
        const pillWidth = compact ? Math.min(34, 10 + 4 * percentage.length)
          : 24 + Math.round([...percentage].reduce((total, glyph) => total + (glyph === "." ? 3 : glyph === "%" ? 9 : 6.6), 0));
        const x = vertical ? center : middle;
        const y = Math.round(vertical ? middle : customColors ? logicalHeight * .045 + 37.5 : grouped ? center + 2 : center);
        const valueY = vertical ? y + 1.55 : grouped ? y - 26.45 : Math.round(logicalHeight * .16) - 12.45;
        const nameY = vertical ? y + 1.04 : grouped ? y + 27.04 : Math.round(logicalHeight * .84) + 13.04;
        return <g key={index} className={funnel.stage} data-stage={row.name} data-active={active === index}
          data-dimmed={active !== null && active !== index}
          style={{ "--funnel-delay": `${index * 120}ms` } as CSSProperties}>
          <g data-funnel-rings="" className={compact ? undefined : funnel.rings}>
            {(customColors ? [0, 2] : [0, 1, 2]).map(layer => {
              const scale = customColors && layer === 2 ? .825 : haloScales[layer];
              return <path key={layer} data-funnel-layer={layer}
                d={funnelSegment(vertical, straight, a, b, center, from * scale, to * scale)}
                fill={layer === 2 ? fill : color} fillOpacity={haloOpacities[layer]} />;
            })}
          </g>
          <g data-funnel-labels="" className={compact ? undefined : funnel.labels} pointerEvents="none" textAnchor="middle" dominantBaseline="middle" fontSize={compact ? 8 : 12}>
            <text data-funnel-value="" x={vertical ? width * .16 - 8 : x} y={valueY} textAnchor={vertical ? "end" : "middle"}
              fill={labelColor} fontSize={compact ? 8 : 14} fontWeight="600">{formatValue(row.value)}</text>
            <rect data-funnel-pill="" className={funnel.pill} x={Math.round(x - pillWidth / 2)} y={y - (compact ? 7 : 12)}
              width={pillWidth} height={compact ? 14 : 24} rx={compact ? 7 : 12} fill={labelColor} />
            <text data-funnel-ratio="" x={x} y={y + 1.04} fontWeight="700" fill={pillTextColor}>{percentage}</text>
            <text data-funnel-label="" x={vertical ? width * .84 + 8 : x} y={nameY} textAnchor={vertical ? "start" : "middle"}
              fill={mutedColor} fontWeight="500">{row.name}</text>
          </g>
          {!compact && <rect data-funnel-target="" x={vertical ? 0 : index * step} y={vertical ? index * step : 0}
            width={vertical ? width : step - gap} height={vertical ? step - gap : logicalHeight} fill="transparent"
            onPointerEnter={event => { if (event.pointerType !== "touch") setPointer(index); }}
            onPointerLeave={() => setPointer(null)}
            onPointerDown={event => {
              if (event.pointerType === "touch") {
                setFocus(null);
                setPinned(selected => selected === index ? null : index);
              }
            }} />}
        </g>;
      })}
    </svg>
    {legend && <div className={funnel.legend} aria-label="Funnel stages">
      {rows.map((row, index) => {
        const progress = Math.min(100, Math.max(0, percent(row.value, baseline)));
        return <Button key={index} type="button" data-active={active === index} data-dimmed={active !== null && active !== index}
          onPointerEnter={() => setPointer(index)} onPointerLeave={() => setPointer(null)}
          onFocus={event => { if (event.currentTarget.matches(":focus-visible")) setFocus(index); }}
          onBlur={() => setFocus(null)} onClick={event => { if (event.detail === 0) setFocus(index); }}
          onKeyDown={event => { if (event.key === "Escape" && active !== null) { event.stopPropagation(); clear(); } }}>
          <i style={{ backgroundColor: stageColor(index) }} aria-hidden="true" />
          <span>{row.name}</span><span className={funnel.value}>{number.format(row.value)}</span>
          <span className={funnel.progress} aria-hidden="true"><span style={{ width: `${progress}%`, backgroundColor: stageColor(index) }} /></span>
          <span className={funnel.percent}>{ratio(row.value)}</span>
        </Button>;
      })}
    </div>}
    {!compact && footer && <div className={funnel.footer} role={interactive ? "status" : undefined} aria-atomic={interactive || undefined}>
      <strong>{footer[0]}</strong><span>{footer[1]}</span>
    </div>}
    {!compact && !interactive && <div role="status" aria-atomic="true" className={styles.screenReader}>
      {stage && `${stage.name}: Value ${formatValue(stage.value)}, Of first stage ${ratio(stage.value)}`}
    </div>}
  </div>;
}
