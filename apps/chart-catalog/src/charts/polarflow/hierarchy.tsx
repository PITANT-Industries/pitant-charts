import { Button } from "@ui-sdk/react/button";
import { arc } from "d3-shape";
import { TrendingUp } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { usePlotSize } from "../usePlotSize";
import { useChartTheme } from "../theme";
import { number, percent, tone, type Props } from "./shared";
import type { SunburstNode } from "./upstream/sunburst-data";
import { buildArcs, geometryFor, ringOptions } from "./upstream/sunburst-layout";
import type { ArcGeometry } from "./upstream/sunburst-layout";
import { readHierarchy } from "./treemap-tree-fixtures";
import { sunburstFixtures } from "./sunburst-fixtures";
import styles from "./styles.module.css";
import sunburstStyles from "./sunburst.module.css";

type VisibleArc = ArcGeometry & { opacity: number };

const compactExpense = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1,
});

function collapseArc(arc: VisibleArc): VisibleArc {
  const center = (arc.a0 + arc.a1) / 2;
  return { a0: center, a1: center, innerR: arc.innerR, outerR: arc.innerR, opacity: 0 };
}

function useArcMorph(target: ReadonlyMap<string, VisibleArc>, compact: boolean | undefined) {
  const [view, setView] = useState(target);
  const latest = useRef(target);
  useEffect(() => {
    const start = latest.current;
    if (start === target) return;
    if (compact || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      latest.current = target;
      setView(target);
      return;
    }
    const keys = new Set([...start.keys(), ...target.keys()]);
    const arcs = [...keys].map(id => {
      const from = start.get(id);
      const to = target.get(id);
      return { id, from: from ?? collapseArc(to!), to: to ?? collapseArc(from!) };
    });
    const began = performance.now();
    let frame: number;
    function animate(time: number) {
      const t = Math.min(1, (time - began) / 360);
      if (t === 1) {
        latest.current = target;
        setView(target);
        return;
      }
      const progress = 1 - (1 - t) ** 3;
      const mix = (a: number, b: number) => a + (b - a) * progress;
      const next = new Map(arcs.map(({ id, from, to }) => [id, {
        a0: mix(from.a0, to.a0), a1: mix(from.a1, to.a1),
        innerR: mix(from.innerR, to.innerR), outerR: mix(from.outerR, to.outerR),
        opacity: mix(from.opacity, to.opacity),
      }]));
      latest.current = next;
      setView(next);
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [compact, target]);
  return compact ? target : view;
}

const arcPath = arc<ArcGeometry>()
  .innerRadius(segment => segment.innerR).outerRadius(segment => segment.outerR)
  .startAngle(segment => segment.a0).endAngle(segment => segment.a1);

const examples: Record<string, { size: number; radius: number; title: string; detail: string }> = {
  "sunburst-default": { size: 480, radius: 217, title: "Product brings in 37% of revenue", detail: "$1.18M across four lines of business" },
  "sunburst-breadcrumb": { size: 420, radius: 189, title: "Platform is 46% of cloud spend", detail: "$236k across four teams this month" },
  "sunburst-segment-colors": { size: 400, radius: 184, title: "Social brought 3,000 sessions, 19% of traffic", detail: "LinkedIn leads the social channels with 1,400" },
  "sunburst-patterns": { size: 360, radius: 164, title: "$1.38M in revenue, 72% of it recurring", detail: "Striped: services and partner revenue, billed once" },
  "sunburst-legend": { size: 320, radius: 144, title: "Engineering is half the company", detail: "244 people across five departments" },
  "sunburst-custom-hint": { size: 400, radius: 184, title: "Payroll is 66% of operating expenses", detail: "$1.16M in operating expenses this month" },
};

const fillMix = (color: string, strength: number) => strength === 100 ? color : `color-mix(in oklab, ${color} ${strength}%, var(--card))`;

export function Sunburst({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const uid = useId();
  const id = example.id;
  const demo = examples[id] ?? examples["sunburst-default"];
  const hasBreadcrumb = id === "sunburst-breadcrumb";
  const customHint = id === "sunburst-custom-hint";
  const customColors = id === "sunburst-segment-colors";
  const patterned = id === "sunburst-patterns";
  const showLegend = !compact && id === "sunburst-legend";
  const root = useMemo((): SunburstNode => {
    const fixture = sunburstFixtures[id] ?? sunburstFixtures["sunburst-default"];
    const children = readHierarchy(data?.rows);
    return children ? { name: fixture.name, children } : fixture;
  }, [data?.rows, id]);
  const { arcs, rootId, focusById, maxDepth, total } = useMemo(() => buildArcs(root), [root]);
  const initial = hasBreadcrumb ? arcs.find(item => item.depth === 1 && item.hasChildren)?.id : undefined;
  const [selected, setSelected] = useState<string | undefined>(initial);
  const [active, setActive] = useState<string | null>(null);
  const focus = focusById.get(selected ?? rootId) ?? focusById.get(rootId)!;
  const activeArc = arcs.find(item => item.id === active);
  const { plot, width, height } = usePlotSize<SVGSVGElement>(demo.size, demo.size);
  const scale = Math.min(width, height) / demo.size;
  const radius = demo.radius * scale;
  const visibleDepth = arcs.reduce((depth, item) => item.id.startsWith(`${focus.id} / `) ? Math.max(depth, item.depth) : depth, Math.min(maxDepth, focus.depth + 1));
  const rings = ringOptions(focus.depth, Math.max(1, visibleDepth), radius);
  const targetArcs = useMemo(() => new Map(arcs.flatMap(item => {
    const geometry = geometryFor(item, focus, visibleDepth, radius);
    return geometry && item.value > 0 ? [[item.id, { ...geometry, opacity: 1 }] as const] : [];
  })), [arcs, focus, radius, visibleDepth]);
  const visibleArcs = useArcMorph(targetArcs, compact);
  const labels = arcs.filter(item => item.parentId === rootId && item.value > 0);
  const ancestors = focus.id.split(" / ");
  const visibleIds = [...targetArcs.keys()];
  const patternedBranches = patterned ? labels.filter(item => item.name === "Services" || item.name === "Partners") : [];
  const color = (index: number, override?: string) => override || `var(--chart-${index % theme.colors.length + 1}, ${tone(theme, index)})`;
  const chartTitle = `${example.title} of ${root.name}`;
  const desc = `${chartTitle}, ${arcs.length} items in ${maxDepth} levels. Largest at the top level: ${[...labels].sort((a, b) => b.value - a.value).slice(0, 3).map(item => `${item.name} ${number.format(item.value)}`).join(", ")}. Total ${number.format(total)}. Use arrow keys to inspect segments, Enter or Space to zoom into a branch, and Escape to go back.`;

  function go(nextId: string | null, keyboard = false) {
    const next = nextId ?? rootId;
    setSelected(next);
    setActive(keyboard ? arcs.find(item => item.parentId === next && item.value > 0)?.id ?? null : null);
  }
  function inspect(event: KeyboardEvent<SVGSVGElement>) {
    if (!visibleIds.length) return;
    if (event.key === "Escape") {
      if (focus.parentId || active) {
        event.preventDefault();
        event.stopPropagation();
        if (focus.parentId) go(focus.parentId, true);
        else setActive(null);
      }
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      if (active === focus.id && focus.parentId) {
        event.preventDefault();
        go(focus.parentId, true);
      } else if (activeArc?.hasChildren && targetArcs.has(activeArc.id)) {
        event.preventDefault();
        go(activeArc.id, true);
      }
      return;
    }
    const keys = focus.parentId ? [focus.id, ...visibleIds] : visibleIds;
    const index = keys.indexOf(active ?? "");
    const last = keys.length - 1;
    const previous = index <= 0 ? last : index - 1;
    const following = (index + 1) % keys.length;
    const next = { Home: 0, End: last, ArrowLeft: previous, ArrowUp: previous, ArrowRight: following, ArrowDown: following }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    setActive(keys[next]);
  }

  const marks = [...arcs].sort((a, b) => b.depth - a.depth || b.arcIndex - a.arcIndex).flatMap(item => {
    const geometry = visibleArcs.get(item.id);
    if (!geometry || item.value <= 0 || geometry.a1 - geometry.a0 < .0001) return [];
    const radialSpace = geometry.outerR - geometry.innerR;
    if (radialSpace < 1) return [];
    const interactive = !compact && targetArcs.has(item.id);
    const selected = active === item.id || !!active && item.id.startsWith(`${active} / `);
    const dimmed = !!active && active !== focus.id && !selected && !active.startsWith(`${item.id} / `);
    const trail = item.id.split(" / ");
    const muted = customColors && !item.color && trail[1] !== "Social";
    const pattern = patternedBranches.find(branch => branch.id === item.id);
    const base = muted ? "var(--sunburst-neutral)" : color(customColors && trail[1] === "Social" ? 0 : item.categoryIndex, item.color);
    const fill = item.fill ?? (pattern ? `url(#${uid}-${pattern.categoryIndex})` : fillMix(base, Math.max(40, 100 - (item.depth - focus.depth - 1) * 15)));
    const angle = (geometry.a0 + geometry.a1) / 2 - Math.PI / 2;
    const midRadius = (geometry.outerR + geometry.innerR) / 2;
    const x = Math.cos(angle);
    const y = Math.sin(angle);
    const degrees = angle * 180 / Math.PI;
    const rotation = x < 0 ? degrees + 180 : degrees;
    const grow = 5.4 * scale;
    const nudge = selected && active !== focus.id && !!geometry.innerR;
    const treatment = nudge ? `translate(${grow * x}px, ${grow * y}px) rotate(${angle}rad) scale(1, ${1 + grow / midRadius}) rotate(${-angle}rad)` : undefined;
    const showLabel = !compact && !customHint && !patterned && geometry.opacity > .7;
    return [{ item, geometry, interactive, selected, dimmed, trail, fill, x, y, midRadius, rotation, treatment, showLabel }];
  });

  return <div className={sunburstStyles.frame} data-compact={compact || undefined} style={{ "--sunburst-size": `${demo.size}px` } as CSSProperties}>
    {hasBreadcrumb && !compact && <nav className={sunburstStyles.breadcrumb} aria-label="Drill-down path">{ancestors.map((name, index) =>
      <span key={index}>{index > 0 && <span aria-hidden="true">›</span>}<Button type="button" aria-current={index === ancestors.length - 1 ? "location" : undefined} onClick={() => go(ancestors.slice(0, index + 1).join(" / "))}>{name}</Button></span>
    )}</nav>}
    <svg ref={plot} className={sunburstStyles.plot} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={example.title} aria-roledescription="chart" aria-description={desc}
      tabIndex={compact ? undefined : 0} onKeyDown={inspect} onFocus={() => setActive(previous => previous ?? (focus.parentId ? focus.id : visibleIds[0]) ?? null)}
      onBlur={() => setActive(null)} onPointerLeave={() => { if (document.activeElement !== plot.current) setActive(null); }}>
      {patternedBranches.length > 0 && <defs>{patternedBranches.map(item =>
        <pattern key={item.id} id={`${uid}-${item.categoryIndex}`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill={color(item.categoryIndex, item.color)} fillOpacity=".2" />
          <path d="M-1 1 1-1 M0 6 6 0 M5 7 7 5" stroke={color(item.categoryIndex, item.color)} strokeWidth="1.5" />
        </pattern>
      )}</defs>}
      <g transform={`translate(${width / 2} ${height / 2})`}>
        {!targetArcs.size && <circle r={radius} fill="none" stroke={theme.grid} />}
        {marks.map(({ item, geometry, interactive, selected, dimmed, trail, fill, treatment }) => <path
          key={item.id} data-sunburst-arc={item.arcIndex} data-sunburst-branch={trail[1]} data-dimmed={dimmed || undefined}
          className={sunburstStyles.segment} d={arcPath(geometry) ?? undefined} opacity={geometry.opacity} fill={fill}
          stroke="var(--card)" strokeWidth={scale} strokeLinejoin="round"
          role={interactive && item.hasChildren ? "button" : undefined} aria-label={interactive ? `${item.name}: ${number.format(item.value)}` : undefined}
          onPointerEnter={interactive ? () => setActive(item.id) : undefined}
          onPointerDown={interactive ? event => { if (event.pointerType === "touch") setActive(item.id); } : undefined}
          onClick={interactive && item.hasChildren ? () => go(item.id) : undefined}
          style={{ transform: treatment, cursor: interactive && item.hasChildren ? "pointer" : undefined, pointerEvents: interactive ? undefined : "none" }}
          data-active={selected || undefined} />)}
        {focus.parentId && <g role="button" aria-label="Back one level" style={{ cursor: "pointer" }} onClick={() => go(focus.parentId)}
          onPointerEnter={() => setActive(focus.id)}>
          <circle r={Math.max(0, rings.centerR - 2 * scale)} fill={color(focus.categoryIndex)} stroke="var(--card)" strokeWidth={scale} />
          {active === focus.id && <path d="M-5 1 0-4 5 1M0-4V5" stroke="var(--card)" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />}
        </g>}
        {marks.map(({ item, x, y, midRadius, rotation, treatment, showLabel, dimmed }) => showLabel && <g key={item.id} pointerEvents="none" style={{ transform: treatment }}>
          <text data-sunburst-label={item.arcIndex} textAnchor="middle" dominantBaseline="central"
            transform={`translate(${x * midRadius} ${y * midRadius}) rotate(${rotation})`}
            fontSize={11 * scale} strokeWidth={2.5 * scale} data-dimmed={dimmed || undefined}
            className={sunburstStyles.label}>{item.name}</text>
        </g>)}
      </g>
    </svg>
    {showLegend && <ul className={sunburstStyles.legend} aria-label="Visible branches">
      {labels.map(item => <li key={item.id}><Button type="button" aria-pressed={focus.id === item.id} data-active={active === item.id || !!active?.startsWith(`${item.id} / `) || focus.id === item.id || focus.id.startsWith(`${item.id} / `)}
        onPointerEnter={() => setActive(item.id)} onPointerLeave={() => setActive(null)} onFocus={() => setActive(item.id)} onBlur={() => setActive(null)}
        onClick={() => { if (item.hasChildren) go(item.id); else setActive(item.id); }}>
        <span className={sunburstStyles.swatch} style={{ background: color(item.categoryIndex, item.color) }} />
        <span>{item.name}</span><strong>{number.format(item.value)}</strong><span>{Math.round(percent(item.value, total))}%</span>
      </Button></li>)}
    </ul>}
    {!compact && !showLegend && <div className={sunburstStyles.hint} data-sunburst-hint="">
      {activeArc && active !== focus.id ? customHint
        ? <><strong>{activeArc.id.split(" / ").slice(1).join(" › ")}</strong> {compactExpense.format(activeArc.value).replace(/K$/, "k")} · {percent(activeArc.value, total).toFixed(1)}% of spend</>
        : activeArc.id.split(" / ").join(" › ")
        : focus.parentId ? "Click the center to zoom out" : customHint ? "Hover a segment to see its cost" : "Click a segment to zoom in · hover to inspect"}
    </div>}
    {!compact && !data && <footer className={sunburstStyles.footer}>
      <div>{demo.title} {id === "sunburst-default" && <TrendingUp size={16} aria-hidden="true" />}</div>
      <span>{demo.detail}</span>
    </footer>}
    {!compact && <div className={styles.screenReader} role="status" aria-atomic="true">{active === focus.id && focus.parentId
      ? "Back one level" : activeArc ? `${activeArc.id.split(" / ").slice(1).join(" › ")}: level ${activeArc.depth}, value ${number.format(activeArc.value)}` : `Viewing ${focus.name}`}</div>}
  </div>;
}

export { Treemap, Tree } from "./treemap-tree";
export { Network } from "./network";
