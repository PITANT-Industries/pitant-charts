import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { Toggle, ToggleGroup } from "@ui-sdk/react/toggle";
import { useChartTheme } from "../theme";
import { usePlotSize } from "../usePlotSize";
import { CartesianReadout } from "../cartesian/CartesianFocus";
import { nextChartFocus, number, numeric, percent, tone, type Props } from "./shared";
import { sankeyFixtures } from "./sankey-fixtures";
import { layoutSankey, flowNodeWidth as nodeWidth, type FlowNode as Node, type Ribbon } from "./sankey-layout";
import styles from "./styles.module.css";
import flow from "./flow.module.css";

type FocusItem = { type: "node"; node: Node } | { type: "ribbon"; ribbon: Ribbon };

const nodeValue = (node: Node) => Math.max(node.input, node.output);
const trafficOrder = ["Organic Search", "Paid Search", "Paid Social", "Email", "Referral", "Direct", "Blog", "Pricing", "Product", "Docs", "Homepage", "Converted", "Engaged", "Bounced"];
const verticalStart = ["Organic Search", "Paid Search", "Homepage", "Pricing"];
const verticalPaintOrder = [...verticalStart, "Converted", "Bounced"];
const deviceOrder = ["Desktop", "Mobile", "Tablet", "Homepage", "Pricing", "Docs", "Signed up", "Left"];

function FlowStripe({ id, color, width = 6 }: { id: string; color: string; width?: number }) {
  return <pattern id={id} patternUnits="userSpaceOnUse" width={width} height={width} patternTransform="rotate(43)">
    <rect width={width} height={width} fill={color} fillOpacity=".2" />
    <path d={`M0 0V${width}`} stroke={color} strokeWidth={width * .65} />
  </pattern>;
}

export function Sankey({ example, compact, data }: Props) {
  const theme = useChartTheme();
  const uid = useId();
  const scrollPane = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const id = example.id;
  const withoutLabels = id === "sankey-no-labels";
  const { plot, width, height } = usePlotSize<SVGSVGElement>(728, withoutLabels ? 364 : 409.5);
  const verticalLabels = id === "sankey-vertical-labels";
  const byCategory = id === "sankey-category-colors";
  const isSingle = id === "sankey-single-color";
  const solid = id === "sankey-solid-links" || isSingle;
  const legendMode = !compact && id === "sankey-legend";
  const fixture = sankeyFixtures[id] ?? sankeyFixtures["sankey-default"];
  const links = useMemo(() => data?.rows?.flatMap((row) => {
    const value = numeric(row.value);
    return typeof row.source === "string" && typeof row.target === "string" && row.source !== row.target && value > 0 ?
      [{ source: row.source, target: row.target, value }] : [];
  }) ?? fixture.links, [data?.rows, fixture]);
  const margin = compact ? (withoutLabels ? 6 : 32) : withoutLabels ? 8 : verticalLabels ? 80 : 120;
  // The narrow fixed-width reference swaps the order of its two outcome nodes.
  const narrowVertical = verticalLabels && width <= 576 && !data?.rows;
  const order = useMemo(() => {
    if (data?.rows) return undefined;
    if (id === "sankey-default" || id === "sankey-patterns") return trafficOrder;
    if (id === "sankey-solid-links") return deviceOrder;
    if (verticalLabels) return [...verticalStart, ...(narrowVertical ? ["Converted", "Bounced"] : ["Bounced", "Converted"])];
    return undefined;
  }, [data?.rows, id, verticalLabels, narrowVertical]);
  const edge = compact ? 10 : withoutLabels ? 8 : 40;
  const gap = compact ? 9 : withoutLabels ? 16 : 24;
  const { nodes, ribbons, maxDepth } = useMemo(() => layoutSankey(links, width, height, margin, edge, gap, order, narrowVertical), [links, width, height, margin, edge, gap, order, narrowVertical]);
  const focusNodes = useMemo(() => {
    const byName = new Map(nodes.map(node => [node.name, node]));
    return [...new Set(links.flatMap(link => [link.source, link.target]))]
      .map(name => byName.get(name)!).sort((a, b) => a.depth - b.depth);
  }, [links, nodes]);
  const legend = nodes.filter(node => node.depth === 0);
  const total = legend.reduce((sum, node) => sum + node.output, 0);
  const unit = data?.rows ? "units" : fixture.unit;
  const unitLabel = unit[0].toUpperCase() + unit.slice(1);
  const marks = useMemo<FocusItem[]>(() => [
    ...focusNodes.map(node => ({ type: "node" as const, node })),
    ...ribbons.map(ribbon => ({ type: "ribbon" as const, ribbon })),
  ], [focusNodes, ribbons]);
  const active = marks[hover ?? focus ?? focusNodes.findIndex(node => node.name === pinned)];
  const activeNode = active?.type === "node" ? active.node : undefined;
  const activeRibbon = active?.type === "ribbon" ? active.ribbon : undefined;
  const drawNodes = verticalLabels && !data?.rows
    ? [...nodes].sort((a, b) => verticalPaintOrder.indexOf(a.name) - verticalPaintOrder.indexOf(b.name))
    : nodes;
  const color = (node: Node) => tone(theme, byCategory ? node.depth : drawNodes.indexOf(node) % 5);
  const header = activeNode?.name ?? (activeRibbon ? `${activeRibbon.source.name} → ${activeRibbon.target.name}` : "");
  const reading = activeNode ? `${number.format(nodeValue(activeNode))}${byCategory ? ` · ${percent(nodeValue(activeNode), total).toFixed(0)}%` : ""}`
    : activeRibbon ? `${number.format(activeRibbon.value)}${byCategory ? ` ${unit} · ${percent(activeRibbon.value, activeRibbon.source.output).toFixed(0)}% of ${activeRibbon.source.name}` : ""}` : "";
  const label = activeNode ? unitLabel : byCategory ? "" : "Flow";
  const tipNode = activeNode ?? activeRibbon?.source;
  const tipColor = tipNode ? color(tipNode) : theme.colors[0];
  const px = activeNode ? activeNode.x + nodeWidth / 2 : activeRibbon ? (activeRibbon.x0 + activeRibbon.x1) / 2 : width / 2;
  const py = activeNode ? activeNode.y + activeNode.height / 2 : activeRibbon?.y ?? height / 2;
  const restingOpacity = isSingle ? .3 : byCategory ? .6 : .5;
  useEffect(() => {
    const pane = scrollPane.current;
    const mark = focus === null ? undefined : marks[focus];
    if (compact || !pane || !mark || pane.clientWidth >= width) return;
    const x = mark.type === "node" ? mark.node.x : (mark.ribbon.x0 + mark.ribbon.x1) / 2;
    const pad = Math.min(132, pane.clientWidth / 2);
    if (x - pad < pane.scrollLeft || x + pad > pane.scrollLeft + pane.clientWidth) {
      pane.scrollLeft = Math.max(0, x - pane.clientWidth / 2);
    }
  }, [compact, focus, marks, width]);
  const reachable = new Set<Node>();
  const downstream = new Set<Ribbon>();
  if (legendMode && activeNode?.depth === 0) {
    const pending = [activeNode];
    while (pending.length) {
      const node = pending.pop()!;
      if (reachable.has(node)) continue;
      reachable.add(node);
      for (const ribbon of ribbons) if (ribbon.source === node) {
        downstream.add(ribbon);
        pending.push(ribbon.target);
      }
    }
  }
  const stripeColor = (link: Ribbon) => {
    if (id === "sankey-patterns" && link.target.depth === maxDepth) return color(link.target);
    if (id !== "sankey-pattern-lines") return undefined;
    if (link.target.name === "Upgraded") return "#22a67c";
    if (link.target.name === "Churned") return "#dc5870";
    if (link.target.name === "Extended") return tone(theme, 0);
    return undefined;
  };
  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key === "Escape" && active) {
      event.preventDefault();
      event.stopPropagation();
      setHover(null); setFocus(null); setPinned(null); return;
    }
    if ((event.key === "Enter" || event.key === " ") && legendMode && activeNode?.depth === 0) {
      event.preventDefault(); setPinned(pinned === activeNode.name ? null : activeNode.name); return;
    }
    const next = nextChartFocus(event.key, focus, marks.length);
    if (next !== undefined) {
      event.preventDefault();
      setHover(null);
      setFocus(next);
    }
  }
  return <div className={`${styles.frame} ${flow.sankeyFrame}`}>
    {legendMode && <ToggleGroup className={flow.sankeyLegend} aria-label="Campaigns" value={pinned ? [pinned] : []}
      onValueChange={(value) => setPinned(value[0] ?? null)}>
      {legend.map(node => <Toggle key={node.name} value={node.name}
        data-active={activeNode === node} onPointerEnter={() => setHover(focusNodes.indexOf(node))} onPointerLeave={() => setHover(null)}
        onFocus={() => setFocus(focusNodes.indexOf(node))} onBlur={() => setFocus(null)}>
        <i style={{ backgroundColor: color(node) }} />{node.name}
      </Toggle>)}
    </ToggleGroup>}
    <div ref={scrollPane} className={flow.sankeyScroll} data-sankey-scroll="" data-wide={!compact && !withoutLabels}>
      <div className={flow.sankeyCanvas} data-unlabelled={withoutLabels} data-compact={compact || undefined}>
        <svg ref={plot} className={`${flow.sankeyPlot} ${styles.native}`} viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-label={example.title}
          tabIndex={compact ? undefined : 0} onKeyDown={key} onFocus={() => { if (marks.length) setFocus(0); }} onBlur={() => setFocus(null)} onPointerLeave={() => setHover(null)}>
          <defs>{ribbons.map((link, index) => {
            const stripe = stripeColor(link);
            return <g key={index}>
              {!solid && !stripe && <linearGradient id={`${uid}-link-${index}`} gradientUnits="userSpaceOnUse" x1={link.x0} x2={link.x1}>
                <stop offset="0" stopColor={color(link.source)} /><stop offset="1" stopColor={color(link.target)} />
              </linearGradient>}
              {stripe && <FlowStripe id={`${uid}-stripe-${index}`} color={stripe} width={id === "sankey-pattern-lines" ? 5 : 7} />}
            </g>;
          })}</defs>
          {ribbons.map((link, index) => {
            const highlighted = activeRibbon === link || (activeNode && (activeNode === link.source || activeNode === link.target || downstream.has(link)));
            const stripe = stripeColor(link);
            const paint = stripe ? `url(#${uid}-stripe-${index})` : isSingle ? tone(theme, 2) : solid ? color(link.source) : `url(#${uid}-link-${index})`;
            return <path key={index} d={link.path} fill="none" stroke={paint} strokeWidth={link.thickness} vectorEffect="non-scaling-stroke"
              data-flow-source={link.source.name} data-flow-target={link.target.name} data-flow-kind={stripe ? "hatch" : solid ? "solid" : "gradient"}
              data-active={Boolean(highlighted)} opacity={!active ? restingOpacity : highlighted ? .85 : .25} className={flow.sankeyMark}
              onPointerEnter={() => setHover(focusNodes.length + index)} onPointerLeave={() => setHover(null)} onPointerDown={() => setFocus(focusNodes.length + index)} />;
          })}
          {drawNodes.map(node => {
            const outgoing = node.depth < maxDepth;
            const value = nodeValue(node);
            const offset = verticalLabels ? 2.9 : compact ? 5 : 12;
            const labelX = outgoing ? node.x - offset : node.x + nodeWidth + offset;
            const labelY = node.y + node.height / 2;
            const nameY = verticalLabels ? labelY : labelY + (compact ? 0 : 1.09);
            const valueX = verticalLabels ? labelX + (outgoing ? -16.17 : 16.17) : labelX;
            const valueY = verticalLabels ? labelY : labelY + 16.92;
            const selected = activeNode === node || activeRibbon?.source === node || activeRibbon?.target === node || reachable.has(node);
            const angle = verticalLabels ? (outgoing ? -90 : 90) : 0;
            const index = focusNodes.indexOf(node);
            const anchor = verticalLabels ? "middle" : outgoing ? "end" : "start";
            return <g key={node.name} className={flow.sankeyMark} data-flow-node={node.name} data-active={selected} opacity={!active || selected ? 1 : .55}
              onPointerEnter={() => setHover(index)} onPointerLeave={() => setHover(null)} onPointerDown={() => setFocus(index)}
              onClick={legendMode && node.depth === 0 ? () => setPinned(pinned === node.name ? null : node.name) : undefined}>
              <rect x={node.x} y={node.y} width={nodeWidth} height={node.height} rx="4" fill={color(node)} />
              {!withoutLabels && <g fill={theme.text} textAnchor={anchor} dominantBaseline="middle">
                <text data-flow-label="" transform={`rotate(${angle} ${labelX} ${nameY})`} x={labelX} y={nameY} fontSize={compact ? 8 : 13} fontWeight={600}>{node.name}</text>
                {!compact && <text transform={`rotate(${angle} ${valueX} ${valueY})`} x={valueX} y={valueY} fontSize="11" fill={theme.muted}>{number.format(value)} {unit}</text>}
              </g>}
            </g>;
          })}
        </svg>
        {!compact && active && <div className={flow.sankeyTooltip} style={{
          "--flow-x": `${px}px`,
          "--flow-y": `${Math.max(32, Math.min(height - 32, py))}px`,
        } as CSSProperties} data-flip={px + 240 > width} role="tooltip">{label ? <CartesianReadout label={header} entries={[{ name: label, value: reading, color: tipColor }]} live={false} />
          : <div className="cartesian-focus-readout"><strong>{header}</strong><div>{reading}</div></div>}</div>}
        {!compact && <div className={styles.screenReader} role="status" aria-atomic="true">{active && `${header}, ${label} ${reading}`}</div>}
      </div>
    </div>
  </div>;
}
