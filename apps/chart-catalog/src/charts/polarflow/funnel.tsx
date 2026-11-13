import { Button } from "@ui-sdk/react/button";
import { useId, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { useChartTheme } from "../theme";
import { metrics, nextChartFocus, number, Pattern, percent, short, tone, type Props } from "./shared";
import styles from "./styles.module.css";
import flow from "./flow.module.css";

const pipeline = { stages: ["Visitors", "Leads", "Qualified", "Proposals", "Closed"], values: [12400, 6800, 3200, 1500, 620] };
const fixtures = {
  "funnel-vertical": { stages: ["Landing", "Started", "Verified", "Onboarded", "Activated"], values: [48200, 21690, 15906, 9399, 5302] },
  "funnel-vertical-curved": { stages: ["Sent", "Delivered", "Opened", "Clicked", "Converted"], values: [52000, 49000, 21200, 4800, 910] },
  "funnel-colors": { stages: ["Leads", "Qualified", "Proposal", "Won"], values: [5000, 3100, 1900, 1200] },
  "funnel-pattern": { stages: ["Installs", "Accounts", "Subscribed", "Renewed"], values: [24800, 14300, 3900, 2650] },
  "funnel-interactive": { stages: ["Product views", "Added to cart", "Checkout", "Payment", "Purchased"], values: [18600, 7450, 3980, 2710, 2240] },
  "funnel-straight": { stages: ["Trials", "Activated", "Invited team", "Paid"], values: [9600, 5100, 2700, 1400] },
  "funnel-gradient": { stages: ["Awareness", "Interest", "Consideration", "Intent", "Purchase"], values: [4100, 2957, 1084, 1038, 320] },
  "funnel-grouped": { stages: ["Applied", "Screened", "Interviewed", "Offered", "Hired"], values: [2480, 1120, 386, 64, 41] },
  "funnel-grid": { stages: ["Signed up", "Verified", "Profile", "First project", "Invited"], values: [8200, 6100, 4300, 2900, 2200] },
};
const haloScales = [1, .884, .768];
const haloOpacities = [.22, .47, 1];

function funnelSegment(vertical: boolean, straight: boolean, start: number, end: number, center: number, from: number, to: number) {
  const at = (along: number, cross: number) => vertical ? `${cross} ${along}` : `${along} ${cross}`;
  const bend = (end - start) * .55;
  const edge = (a: number, x: number, b: number, y: number) => straight ? `L ${at(b, y)}` :
    `C ${at(a + (a < b ? bend : -bend), x)} ${at(b + (a < b ? -bend : bend), y)} ${at(b, y)}`;
  return `M ${at(start, center - from)} ${edge(start, center - from, end, center - to)} L ${at(end, center + to)} ${edge(end, center + to, start, center + from)} Z`;
}

export function Funnel({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const uid = useId();
  const [pointer, setPointer] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const active = pointer ?? focus;
  const id = example.id;
  const fixture = fixtures[id as keyof typeof fixtures] ?? pipeline;
  const rows = metrics(data, fixture.stages, fixture.values);
  const baseline = rows[0]?.value ?? 0;
  const maximum = Math.max(1, ...rows.map(row => row.value));
  const vertical = id.includes("vertical");
  const straight = id === "funnel-vertical" || id === "funnel-straight";
  const grid = id === "funnel-vertical" || id === "funnel-grid";
  const colorStages = id === "funnel-colors" || id === "funnel-gradient";
  const grouped = id === "funnel-grouped" || id === "funnel-colors";
  const pattern = id === "funnel-pattern";
  const interactive = id === "funnel-interactive";
  const legend = !compact && id === "funnel-legend";
  const fullValues = pattern || grouped || interactive || id === "funnel-gradient";
  const length = vertical ? 436 : 574;
  const offset = vertical ? 6 : 13;
  const center = vertical ? 130 : 135;
  const step = length / Math.max(1, rows.length);
  const half = vertical ? 111 : 116;
  const stage = active === null ? undefined : rows[active];
  const previous = active === null ? undefined : rows[active - 1];
  const ratio = (value: number) => `${percent(value, baseline).toFixed(id === "funnel-vertical" ? 1 : 0)}%`;
  const stageColor = (index: number) => tone(theme, colorStages ? index : interactive ? 2 : id === "funnel-straight" || pattern ? 1 : 0, rows[index]?.color);
  const activeText = stage ? `${stage.name}: ${number.format(stage.value)}${interactive ? " sessions" : ""}, ${ratio(stage.value)} of ${interactive ? "views" : "first stage"}` : "";
  const drop = previous && stage ? previous.value > 0
    ? `${Math.max(0, Math.round(100 - percent(stage.value, previous.value)))}% dropped off after ${previous.name.toLocaleLowerCase()}`
    : `Previous stage: ${previous.name}, ${number.format(previous.value)}`
    : data ? "First stage" : "Every session that viewed a product";
  const summary = data ? `${number.format(rows.at(-1)?.value ?? 0)} at the final stage out of ${number.format(baseline)} at the first` :
    `${number.format(rows.at(-1)?.value ?? 0)} purchases from ${number.format(baseline)} product views`;
  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      setPointer(null);
      setFocus(null);
      return;
    }
    const next = nextChartFocus(event.key, focus, rows.length);
    if (next !== undefined) {
      event.preventDefault();
      setPointer(null);
      setFocus(next);
    }
  }

  return <div className={`${styles.frame} ${legend ? flow.legendFrame : ""}`}>
    <svg className={`${styles.native} ${vertical ? flow.verticalFunnel : ""} ${legend ? flow.legendFunnel : ""}`} viewBox={vertical ? "0 0 260 448" : "0 0 600 270"}
      role="img" aria-roledescription="chart" aria-label={example.title} tabIndex={compact ? undefined : 0}
      onKeyDown={key} onFocus={() => { if (rows.length) setFocus(0); }} onBlur={() => setFocus(null)} onPointerLeave={() => setPointer(null)}>
      <defs>{rows.map((_, index) => <g key={index}>
        {(id === "funnel-gradient" || (id === "funnel-colors" && index === 0)) && <linearGradient id={`${uid}-gradient-${index}`} x1="0%" x2="100%">
          <stop offset="0" stopColor={stageColor(index)} />
          <stop offset="100%" stopColor={tone(theme, index + 1)} />
        </linearGradient>}
        {pattern && <Pattern id={`${uid}-pattern-${index}`} color={stageColor(index)} />}
      </g>)}</defs>
      {rows.map((row, index) => {
        const a = offset + index * step + (index === 0 ? 0 : 1.5);
        const b = offset + (index + 1) * step - (index === rows.length - 1 ? 0 : 1.5);
        const middle = (a + b) / 2;
        const from = half * Math.max(0, row.value) / maximum;
        const to = half * Math.max(0, rows[index + 1]?.value ?? row.value) / maximum;
        const color = stageColor(index);
        const fill = pattern ? `url(#${uid}-pattern-${index})` :
          id === "funnel-gradient" || (id === "funnel-colors" && index === 0) ? `url(#${uid}-gradient-${index})` : color;
        const value = fullValues ? number.format(row.value) : short.format(row.value).toLowerCase();
        const percentage = ratio(row.value);
        const pillWidth = Math.max(34, 13 + percentage.length * 5.8);
        const x = vertical ? center : middle;
        const y = vertical ? middle : center;
        const layers = id === "funnel-colors" ? [0, 2] : [0, 1, 2];
        const textSize = compact && rows.length > 5 ? 8 : 9.5;
        return <g key={index} className={flow.funnelStage} data-stage={row.name} data-active={active === index} data-dimmed={active !== null && active !== index}
          onPointerEnter={(event) => { if (event.pointerType !== "touch") setPointer(index); }}
          onPointerDown={(event) => { if (event.pointerType === "touch") setPointer(index); }}>
          {grid && (vertical
            ? <rect data-funnel-grid="" x="4" y={a} width="252" height={b - a} fill={theme.grid} fillOpacity={index % 2 ? .16 : .53} />
            : <g data-funnel-grid=""><rect x={a} y="13" width={b - a} height="244" fill={theme.grid} fillOpacity={index % 2 ? .19 : .53} />
              {index > 0 && <line x1={a - 1.5} x2={a - 1.5} y1="13" y2="257" stroke={theme.grid} />}</g>)}
          {layers.map(layer => <path key={layer} data-funnel-layer={layer} className={compact ? undefined : flow.funnelLayer}
            style={{ "--flow-delay": `${index * 55}ms` } as CSSProperties}
            d={funnelSegment(vertical, straight, a, b, center, from * haloScales[layer], to * haloScales[layer])}
            fill={layer === 2 ? fill : color} opacity={haloOpacities[layer]} />)}
          <g pointerEvents="none" textAnchor="middle" fill={theme.text} fontSize={textSize}>
            <text data-funnel-value="" x={vertical ? 24 : x} y={vertical ? y + 3 : grouped ? y - 18 : 38} fontWeight="650">{value}</text>
            <rect x={x - pillWidth / 2} y={y - 8} width={pillWidth} height="16" rx="8" fill={theme.text} />
            <text data-funnel-ratio="" x={x} y={y + 3.2} fontSize="8.5" fontWeight="700" fill={theme.surface}>{percentage}</text>
            <text data-funnel-label="" x={vertical ? 234 : x} y={vertical ? y + 3 : grouped ? y + 19 : 237}
              fill={theme.muted} fontSize={textSize}>{row.name}</text>
          </g>
          {vertical ? <rect x="0" y={a} width="260" height={b - a} fill="transparent" /> :
            <rect x={a} y="13" width={b - a} height="244" fill="transparent" />}
        </g>;
      })}
    </svg>
    {legend && <div className={flow.funnelLegend} aria-label="Funnel stages">
      {rows.map((row, index) => <Button key={index} type="button" data-active={active === index} data-dimmed={active !== null && active !== index}
        onPointerEnter={() => setPointer(index)} onPointerLeave={() => setPointer(null)}
        onFocus={() => setFocus(index)} onBlur={() => setFocus(null)} onClick={() => setFocus(index)}>
        <span><i style={{ backgroundColor: stageColor(index) }} />{row.name}</span><span>{number.format(row.value)}</span>
        <span className={flow.progress} aria-hidden="true"><span style={{ width: `${Math.min(100, Math.max(0, percent(row.value, baseline)))}%`, backgroundColor: stageColor(index) }} /></span>
        <small>{ratio(row.value)}</small>
      </Button>)}
    </div>}
    {!compact && <div role="status" aria-atomic="true" className={interactive ? flow.flowFooter : styles.screenReader}>
      {interactive && !stage ? <><strong>{summary}</strong><span>Hover a stage, or use the arrow keys to inspect it</span></> :
        <><strong>{activeText}</strong>{interactive && <span>{drop}</span>}</>}
    </div>}
  </div>;
}
