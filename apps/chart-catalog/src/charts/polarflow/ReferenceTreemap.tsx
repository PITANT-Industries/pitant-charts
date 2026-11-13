import { Toggle } from "@ui-sdk/react/toggle";
import { LoaderCircle, TrendingUp } from "lucide-react";
import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useChartTheme } from "../theme";
import { CartesianReadout } from "../cartesian/CartesianFocus";
import { usePlotSize } from "../usePlotSize";
import { skeletonTiles, treemapTiles, type TreemapTile } from "./reference-treemap-layout";
import { dollars, nextChartFocus, number, percent, type Props } from "./shared";
import { referenceTreemapFixtures } from "./reference-treemap-fixtures";
import type { SunburstNode } from "./upstream/sunburst-data";
import { sumValues } from "./upstream/sunburst-layout";
import styles from "./reference-treemap.module.css";

type Focus = { index: number; point?: { x: number; y: number } };

const palette = (index: number) => `var(--chart-${index + 1})`;
const mix = (color: string, amount: number) => `color-mix(in oklab, ${color} ${amount}%, var(--card))`;
const leafValue = (id: string, value: number) => {
  if (id === "treemap-drilldown") return `${number.format(value)} kB`;
  if (id === "treemap-loading") return value >= 1000 ? `${(value / 1000).toFixed(1)} TB` : `${number.format(value)} GB`;
  return value >= 1000 ? `$${value >= 10000 ? Math.round(value / 1000) : (value / 1000).toFixed(1)}k` : dollars.format(value);
};

function hierarchyAt(root: SunburstNode, path: string[]) {
  return path.reduce((node, name) => node.children?.find(child => child.name === name) ?? node, root);
}

function fitLabel(label: string, width: number, size: number, measure: (text: string, size: number, weight: number) => number, weight = 500) {
  if (measure(label, size, weight) <= width) return label;
  let cut = label.length - 1;
  while (cut >= 3 && measure(`${label.slice(0, cut)}…`, size, weight) > width) cut--;
  return cut >= 3 ? `${label.slice(0, cut).trimEnd()}…` : "";
}

function displayShare(value: number, total: number) {
  const share = percent(value, total);
  return `${share > 0 && share < 10 ? share.toFixed(1) : Math.round(share)}%`;
}

export function ReferenceTreemap({ example, compact = false }: Props) {
  const id = example.id;
  const theme = useChartTheme();
  const [textContext] = useState(() => typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d"));
  function measure(text: string, size: number, weight: number) {
    if (!textContext) return text.length * size * .57;
    textContext.font = `${weight} ${size}px ${theme.fontFamily}`;
    return textContext.measureText(text).width;
  }
  const isPortfolio = id === "treemap-portfolio";
  const hasLoading = id === "treemap-loading";
  const hasDrilldown = id === "treemap-drilldown";
  const root = referenceTreemapFixtures[id] ?? referenceTreemapFixtures["treemap-default"];
  const total = sumValues(root);
  const [loading, setLoading] = useState(hasLoading);
  const [path, setPath] = useState<string[]>([]);
  const [focus, setFocus] = useState<Focus | null>(null);
  const current = hierarchyAt(root, path);
  const { plot, width, height } = usePlotSize<SVGSVGElement>(576, isPortfolio ? 288 : 360);
  const marks = useMemo(() => loading ? [] : treemapTiles(root, path, current, width, height, isPortfolio),
    [current, height, isPortfolio, loading, path, root, width]);
  const backIndex = path.length ? 0 : -1;
  const offset = backIndex + 1;
  const active = focus && focus.index >= offset ? marks[focus.index - offset] : undefined;
  const crumb = fitLabel(`‹  ${[root.name, ...path].join(" / ")}`, width - 16, 12, measure) || "‹";
  const crumbWidth = Math.min(width, 16 + measure(crumb, 12, 500));
  const activeColor = active ? palette(active.color) : "var(--foreground)";
  const value = active ? sumValues(active.node) : 0;
  const readout = active ? {
    title: active.path.join(isPortfolio ? " · " : " / "),
    entries: [
      { name: hasDrilldown ? "Size" : hasLoading ? "Stored" : "Spend", value: leafValue(id, value), color: activeColor },
      { name: `Share of ${current.name}`, value: displayShare(value, sumValues(current)), color: activeColor },
    ],
  } : null;

  function go(next: string[]) {
    setPath(next);
    setFocus(null);
  }

  function goBack() {
    go(path.slice(0, -1));
  }

  function isBranch(tile: TreemapTile) {
    return !isPortfolio && !!tile.node.children?.length;
  }

  function handleKeys(event: KeyboardEvent<SVGSVGElement>) {
    if (loading || compact) return;
    const key = event.key;
    if (key === "Escape" && (focus || path.length)) {
      event.preventDefault();
      event.stopPropagation();
      if (path.length) goBack();
      else setFocus(null);
    } else if (key === "Enter" || key === " ") {
      if (path.length && focus?.index === backIndex) {
        event.preventDefault();
        goBack();
      } else if (active && isBranch(active)) {
        event.preventDefault();
        go(active.path);
      }
    } else {
      const index = nextChartFocus(key, focus?.index ?? null, marks.length + offset);
      if (index !== undefined) {
        event.preventDefault();
        setFocus({ index });
      }
    }
  }

  function showPointer(event: PointerEvent<SVGGElement>, index: number) {
    if (compact) return;
    const rect = plot.current?.getBoundingClientRect();
    if (rect) setFocus({ index, point: { x: event.clientX - rect.left, y: event.clientY - rect.top } });
  }

  const footer = isPortfolio ? ["71% in equities, 19% in bonds", "$750,000 across 12 holdings"] : hasDrilldown
    ? [[root.name, ...path].join(" / "), "701 kB in all: click a folder to open it, the breadcrumb to go back"]
    : hasLoading ? [loading ? "Fetching storage…" : "6.6 TB stored across ten buckets", "Turn loading off to pop the cells in from the skeleton"]
    : ["Compute is 22% of the bill", "$222.8k across five teams this month"];
  const tipX = focus?.point?.x ?? (active ? active.bounds.x + active.bounds.width / 2 : 0);
  const tipY = focus?.point?.y ?? (active ? active.bounds.y + active.bounds.height / 2 : 0);

  return <div className={styles.frame} data-compact={compact || undefined} data-portfolio={isPortfolio || undefined}>
    {hasLoading && !compact && <div className={styles.controls}>
      <Toggle className={styles.toggle} pressed={loading} onPressedChange={value => { setLoading(value); go([]); }}>
        <LoaderCircle size={14} aria-hidden="true" />Loading
      </Toggle>
    </div>}
    <div className={styles.stage}>
      <svg ref={plot} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={example.title} aria-roledescription="chart" aria-busy={loading}
        aria-description={loading ? "Loading" : `Viewing ${current.name}. Use arrow keys to inspect rectangles${isPortfolio ? "." : ", Enter or Space to open a group, and Escape to go back."}`}
        tabIndex={compact || loading ? undefined : 0} onKeyDown={handleKeys}
        onBlur={() => setFocus(null)} onPointerLeave={() => { if (document.activeElement !== plot.current || focus?.point) setFocus(null); }}>
        {loading && skeletonTiles(width, height).map(([key, bounds], index) => <rect key={key} data-mark="treemap-bone" {...bounds} rx="6" className={styles.bone}
          style={{ animationDelay: `${index * 40}ms` }} fill="var(--foreground)" fillOpacity=".2" opacity=".7" />)}
        {!!path.length && <g data-mark="treemap-back" className={styles.branch} role="button" aria-label="Back one level"
          onPointerEnter={() => setFocus({ index: backIndex })} onClick={goBack}>
          <rect x="0" y="0" width={crumbWidth} height="24" rx="6" fill={focus?.index === backIndex ? "var(--accent)" : "var(--muted)"} />
          <text x="8" y="13" dominantBaseline="middle" fill="var(--foreground)" fontSize="12" fontWeight="500" xmlSpace="preserve">
            {crumb}
          </text>
        </g>}
        {marks.map((mark, index) => {
          const { node, bounds, tint, frame, color, path, header } = mark;
          const { x, y, width, height } = bounds;
          if (!width || !height) return null;
          const branch = isBranch(mark);
          const markKey = path.join("/");
          const markColor = palette(color);
          const fill = mix(markColor, tint);
          const textFill = frame ? "var(--foreground)" : `lch(from ${fill} calc((49.44 - l) * infinity) 0 0)`;
          const value = leafValue(id, sumValues(node));
          const labelWidth = frame ? width - 24 - measure(value, 11, 500) : width - 16;
          const showName = !compact && (frame ? header : width >= 36 && height >= 26);
          const name = showName ? fitLabel(node.name, labelWidth, 12, measure, frame ? 600 : 500) : "";
          const showValue = !!name && (frame || height >= 42 && measure(value, 11, 500) <= labelWidth);
          const radius = Math.min(isPortfolio ? 3 : 6, width / 2, height / 2) + (frame ? 2 : 0);
          return <g key={markKey} data-mark={frame ? "treemap-frame" : "treemap-tile"} data-path={markKey}
            className={branch && !compact ? styles.branch : undefined} data-active={active === mark || undefined}
            role={branch && !compact ? "button" : undefined} aria-label={`${path.join(" / ")}: ${value}`}
            onPointerMove={event => showPointer(event, index + offset)}
            onPointerDown={event => { if (event.pointerType === "touch") showPointer(event, index + offset); }}
            onClick={branch && !compact ? () => go(path) : undefined}>
            <rect {...bounds} rx={radius}
              fill={fill} stroke={mix(markColor, frame ? 38 : 78)} strokeWidth={active === mark ? 1.5 : 1} />
            {name && <text x={x + 8} y={y + (frame ? 13 : 15)} fill={textFill}
              dominantBaseline="middle" fontSize="12" fontWeight={frame ? 600 : 500} pointerEvents="none">{name}</text>}
            {showValue && <text x={frame ? x + width - 8 : x + 8} y={y + (frame ? 13 : 31)}
              fill={frame ? "var(--muted-foreground)" : textFill} dominantBaseline="middle"
              textAnchor={frame ? "end" : undefined} fontSize="11" fontWeight="500" pointerEvents="none">{value}</text>}
          </g>;
        })}
      </svg>
      {readout && !compact && <div className={styles.tooltip} data-treemap-tooltip="" data-side={tipX > width / 2 ? "left" : "right"}
        style={{ top: Math.min(Math.max(4, tipY + 12), Math.max(4, height - 83)), ...(tipX > width / 2 ? { right: width - tipX + 10 } : { left: tipX + 10 }) }}>
        {isPortfolio ? <div className={styles.portfolioTip} role="status">
          <strong>{readout.title}</strong><b>{dollars.format(value)}</b><span>{percent(value, total).toFixed(1)}% of the portfolio</span>
        </div> : <CartesianReadout label={readout.title} entries={readout.entries} />}
      </div>}
    </div>
    {!compact && <footer className={styles.footer}><strong>{footer[0]}{id === "treemap-default" && <TrendingUp size={16} aria-hidden="true" />}</strong><span>{footer[1]}</span></footer>}
  </div>;
}
