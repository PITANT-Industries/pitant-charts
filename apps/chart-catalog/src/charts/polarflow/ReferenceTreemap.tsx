import { Toggle } from "@ui-sdk/react/toggle";
import { LoaderCircle, TrendingUp } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { useChartTheme } from "../theme";
import { usePlotSize } from "../usePlotSize";
import { skeletonTiles, treemapTiles, type TreemapTile } from "./reference-treemap-layout";
import { dollars, nextChartFocus, number, percent, type Props } from "./shared";
import { referenceTreemapFixtures } from "./reference-treemap-fixtures";
import type { SunburstNode } from "./upstream/sunburst-data";
import { sumValues } from "./upstream/sunburst-layout";
import styles from "./reference-treemap.module.css";

type Focus = { index: number; point?: { x: number; y: number } };
type Readout = { title: string; entries: { name: string; value: string; color?: string }[] };

const breadcrumbHeight = 24;
const tooltipOffset = 16;
const loadingFade = 450;
const layoutDuration = 380;
const layoutEasing = "cubic-bezier(.16, 1, .3, 1)";

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
  if (width <= size) return "";
  if (measure(label, size, weight) <= width) return label;
  let cut = label.length - 1;
  while (cut >= 3 && measure(`${label.slice(0, cut)}…`, size, weight) > width) cut--;
  return cut >= 3 ? `${label.slice(0, cut).trimEnd()}…` : "";
}

function displayShare(value: number, total: number) {
  const share = percent(value, total);
  return `${share > 0 && share < 10 ? share.toFixed(1) : Math.round(share)}%`;
}

function rectLayouts(svg: SVGSVGElement) {
  const layouts = new Map<string, SVGRectElement>();
  for (const group of svg.querySelectorAll<SVGGElement>("g[data-path]")) {
    const rect = group.querySelector("rect");
    if (group.dataset.path && rect) layouts.set(group.dataset.path, rect);
  }
  return layouts;
}

function animateLayout(svg: SVGSVGElement, previous: Map<string, DOMRect>) {
  for (const [key, element] of rectLayouts(svg)) {
    const before = previous.get(key);
    element.getAnimations().forEach(animation => animation.cancel());
    const after = element.getBoundingClientRect();
    if (!before || !after.width || !after.height) continue;
    const x = before.x - after.x;
    const y = before.y - after.y;
    const sx = before.width / after.width;
    const sy = before.height / after.height;
    if (!x && !y && sx === 1 && sy === 1) continue;
    const group = element.parentElement;
    const timing = { duration: layoutDuration, easing: layoutEasing };
    element.animate([{ transform: `translate(${x}px, ${y}px) scale(${sx}, ${sy})` }, { transform: "none" }], timing);
    group?.querySelectorAll<SVGTextElement>("text").forEach(text => {
      text.getAnimations().forEach(animation => animation.cancel());
      const fromX = text.getAttribute("text-anchor") === "end" ? x + before.width - after.width : x;
      text.animate([{ transform: `translate(${fromX}px, ${y}px)` }, { transform: "none" }], timing);
    });
  }
}

function TreemapReadout({ readout, point, width, height, portfolio }: {
  readout: Readout;
  point: { x: number; y: number };
  width: number;
  height: number;
  portfolio: boolean;
}) {
  const element = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const tooltip = element.current;
    if (!tooltip) return;
    function measure() {
      if (!tooltip) return;
      const box = tooltip.getBoundingClientRect();
      setSize(previous => previous.width === box.width && previous.height === box.height ? previous : { width: box.width, height: box.height });
    }
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(tooltip);
    return () => observer.disconnect();
  }, [readout]);
  const alignLeft = point.x + size.width + tooltipOffset > width;
  const left = alignLeft ? point.x - size.width - tooltipOffset : point.x + tooltipOffset;
  const top = Math.max(tooltipOffset, Math.min(point.y - size.height / 2, height - size.height - tooltipOffset));

  return <div ref={element} className={styles.tooltip} data-treemap-tooltip="" data-portfolio={portfolio || undefined}
    style={{ left, top }} role="status">
    {portfolio ? <>
      <span>{readout.title}</span>
      <strong>{readout.entries[0].value}</strong>
      <span>{readout.entries[1].value}</span>
    </> : <>
      <div className={styles.tipTitle}>{readout.title}</div>
      <dl>
        {readout.entries.map(({ name, value, color }) => <div key={name} className={styles.tipRow} data-swatch={!!color || undefined}>
          <dt>{color && <i style={{ backgroundColor: color }} aria-hidden="true" />}{name}</dt><dd>{value}</dd>
        </div>)}
      </dl>
    </>}
  </div>;
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
  const [entering, setEntering] = useState(true);
  const [loadingDelay, setLoadingDelay] = useState(0);
  const exit = useRef<SVGSVGElement | null>(null);
  const previousRects = useRef<Map<string, DOMRect> | null>(null);
  const current = hierarchyAt(root, path);
  const { plot, width, height } = usePlotSize<SVGSVGElement>(576, isPortfolio ? 288 : 360);
  const entranceScale = 420 / (width + height);
  const marks = useMemo(() => loading ? [] : treemapTiles(root, path, current, width, height, isPortfolio),
    [current, height, isPortfolio, loading, path, root, width]);
  const backIndex = path.length ? 0 : -1;
  const offset = backIndex + 1;
  const backActive = focus?.index === backIndex;
  const active = focus && focus.index >= offset ? marks[focus.index - offset] : undefined;
  const crumb = fitLabel(`‹  ${[root.name, ...path].join(" / ")}`, width - 16, 12, measure) || "‹";
  const crumbWidth = Math.min(width, 16 + measure(crumb, 12, 500));
  const value = active ? sumValues(active.node) : 0;
  const readout = useMemo<Readout | null>(() => {
    if (backActive) return {
      title: "Back",
      entries: [{ name: "Zoom out to", value: hierarchyAt(root, path.slice(0, -1)).name }],
    };
    if (!active) return null;
    if (isPortfolio) return {
      title: `${active.path[0]} · ${active.node.name}`,
      entries: [{ name: "Value", value: dollars.format(value) }, { name: "Share", value: `${percent(value, total).toFixed(1)}% of the portfolio` }],
    };
    return {
      title: active.path.join(" / "),
      entries: [
        { name: hasDrilldown ? "Size" : hasLoading ? "Stored" : "Spend", value: leafValue(id, value), color: palette(active.color) },
        { name: `Share of ${current.name}`, value: displayShare(value, sumValues(current)) },
      ],
    };
  }, [active, backActive, current, hasDrilldown, hasLoading, id, isPortfolio, path, root, total, value]);

  useLayoutEffect(() => {
    if (!plot.current || !previousRects.current) return;
    animateLayout(plot.current, previousRects.current);
    previousRects.current = null;
  }, [path, plot]);

  useLayoutEffect(() => () => exit.current?.remove(), []);

  function canAnimate() {
    return !compact && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !!plot.current?.animate;
  }

  function go(next: string[], glide = true) {
    const svg = plot.current;
    if (svg && glide && canAnimate()) {
      previousRects.current = new Map(Array.from(rectLayouts(svg), ([key, rect]) => [key, rect.getBoundingClientRect()]));
    }
    setEntering(!glide);
    setPath(next);
    setFocus(null);
  }

  function toggleLoading(next: boolean) {
    exit.current?.remove();
    exit.current = null;
    const svg = plot.current;
    const delay = next && svg && canAnimate() ? loadingFade : 0;
    if (svg && delay) {
      const overlay = svg.cloneNode(true) as SVGSVGElement;
      for (const attribute of ["aria-busy", "aria-description", "aria-label", "aria-roledescription", "role", "tabindex"]) {
        overlay.removeAttribute(attribute);
      }
      overlay.setAttribute("aria-hidden", "true");
      overlay.setAttribute("class", styles.loadingExit);
      overlay.querySelectorAll("[data-mark]").forEach(element => {
        element.removeAttribute("data-mark");
        element.removeAttribute("data-path");
      });
      svg.after(overlay);
      exit.current = overlay;
      const animation = overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: delay, easing: "cubic-bezier(.85, 0, .15, 1)", fill: "forwards",
      });
      animation.onfinish = () => {
        overlay.remove();
        if (exit.current === overlay) exit.current = null;
      };
    }
    setLoadingDelay(delay);
    setLoading(next);
    go([], false);
  }

  function goBack() {
    go(path.slice(0, -1));
  }

  function drillTarget(tile: TreemapTile) {
    if (isPortfolio) return null;
    const target = tile.node.children?.length ? tile.path : tile.path.slice(0, -1);
    return target.length > path.length ? target : null;
  }

  function isRelated(tile: TreemapTile) {
    if (!active) return !backActive;
    return tile.path.every((name, index) => active.path[index] === name) ||
      (active.frame && active.path.every((name, index) => tile.path[index] === name));
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
      } else if (active) {
        const target = drillTarget(active);
        if (!target) return;
        event.preventDefault();
        go(target);
      }
    } else {
      const index = nextChartFocus(key, focus?.index ?? null, marks.length + offset);
      if (index !== undefined) {
        event.preventDefault();
        setFocus({ index });
      }
    }
  }

  function pointerPoint(event: PointerEvent<SVGElement>) {
    const rect = plot.current?.getBoundingClientRect();
    return rect ? { x: Math.trunc(event.clientX) - rect.left, y: Math.trunc(event.clientY) - rect.top } : undefined;
  }

  function showPointer(event: PointerEvent<SVGGElement>, index: number) {
    if (compact) return;
    setFocus({ index, point: pointerPoint(event) });
  }

  function handlePlotPointer(event: PointerEvent<SVGSVGElement>) {
    if (compact || loading) return;
    const point = pointerPoint(event);
    if (path.length && point && point.y <= breadcrumbHeight) setFocus({ index: backIndex, point });
    else if (!(event.target as Element).closest("[data-path]") && focus?.point) setFocus(null);
  }

  const footer = isPortfolio ? ["71% in equities, 19% in bonds", "$750,000 across 12 holdings"] : hasDrilldown
    ? [[root.name, ...path].join(" / "), "701 kB in all: click a folder to open it, the breadcrumb to go back"]
    : hasLoading ? [loading ? "Fetching storage…" : "6.6 TB stored across ten buckets", "Turn loading off to pop the cells in from the skeleton"]
    : ["Compute is 22% of the bill", "$222.8k across five teams this month"];
  const tipPoint = focus?.point ?? (active
    ? { x: active.bounds.x + active.bounds.width / 2, y: active.bounds.y + active.bounds.height / 2 }
    : { x: 8, y: 15 });

  return <div className={styles.frame} data-compact={compact || undefined} data-portfolio={isPortfolio || undefined}>
    {hasLoading && !compact && <div className={styles.controls}>
      <Toggle className={styles.toggle} pressed={loading} onPressedChange={toggleLoading}>
        <LoaderCircle size={14} aria-hidden="true" />Loading
      </Toggle>
    </div>}
    <div className={styles.stage}>
      <svg ref={plot} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={example.title} aria-roledescription="chart" aria-busy={loading}
        aria-description={loading ? "Loading" : `Viewing ${current.name}. Use arrow keys to inspect rectangles${isPortfolio ? "." : ", Enter or Space to zoom, and Escape to go back."}`}
        tabIndex={compact || loading ? undefined : 0} onKeyDown={handleKeys}
        onPointerMove={handlePlotPointer}
        onBlur={() => setFocus(null)} onPointerLeave={() => { if (document.activeElement !== plot.current || focus?.point) setFocus(null); }}>
        {loading && <g className={styles.skeleton} style={{ animationDelay: `${loadingDelay}ms` }}>
          {skeletonTiles(width, height).map(([key, bounds]) => {
            const x = (bounds.x + bounds.width / 2) / width;
            const y = (bounds.y + bounds.height / 2) / height;
            const phase = (x * .8 + y * .2) * 900;
            return <rect key={key} data-mark="treemap-bone" {...bounds} rx={Math.min(6, bounds.width / 2, bounds.height / 2)} className={styles.bone}
              style={{ animationDelay: `${loadingDelay + phase}ms` }} fill="var(--foreground)" fillOpacity=".2" opacity=".7" />;
          })}
        </g>}
        {!!path.length && <g data-mark="treemap-back" className={styles.branch} role="button" aria-label="Back one level"
          data-active={backActive || undefined} data-dimmed={!!active || undefined} onClick={goBack}>
          <path d={`M0 0H${width}V${breadcrumbHeight}H0Z`} fill="transparent" />
          <rect x="0" y="0" width={crumbWidth} height={breadcrumbHeight} rx="6" fill="color-mix(in oklab, var(--muted-foreground) 8%, transparent)" />
          <text x="8" y="13" dominantBaseline="middle" fill="var(--muted-foreground)" fontSize="12" fontWeight="500" xmlSpace="preserve">
            {crumb}
          </text>
        </g>}
        {marks.map((mark, index) => {
          const { node, bounds, tint, frame, color, path, header } = mark;
          const { x, y, width, height } = bounds;
          if (!width || !height) return null;
          const target = drillTarget(mark);
          const markKey = path.join("/");
          const markColor = palette(color);
          const fill = mix(markColor, tint);
          const textFill = frame ? "var(--popover-foreground)" : `lch(from ${fill} calc((49.44 - l) * infinity) 0 0)`;
          const value = leafValue(id, sumValues(node));
          const labelWidth = frame ? width - 24 - measure(value, 11, 500) : width - 16;
          const showName = !compact && (frame ? header : width >= 36 && height >= 26);
          const name = showName ? fitLabel(node.name, labelWidth, 12, measure, frame ? 600 : 500) : "";
          const showValue = !!name && (frame || height >= 42 && measure(value, 11, 500) <= labelWidth);
          const radius = Math.min(isPortfolio ? 3 : 6, width / 2, height / 2) + (frame ? 2 : 0);
          return <g key={markKey} data-mark={frame ? "treemap-frame" : "treemap-tile"} data-path={markKey}
            className={target && !compact ? styles.branch : undefined} data-active={active === mark || undefined} data-dimmed={!isRelated(mark) || undefined}
            data-entering={entering && !compact || undefined} style={{ "--treemap-entrance-delay": `${(x + y) * entranceScale}ms` } as CSSProperties}
            role={target && !compact ? "button" : undefined} aria-label={`${path.join(" / ")}: ${value}`}
            onPointerMove={event => showPointer(event, index + offset)}
            onPointerDown={event => { if (event.pointerType === "touch") showPointer(event, index + offset); }}
            onClick={target && !compact ? () => go(target) : undefined}>
            <rect {...bounds} rx={radius}
              fill={fill} stroke={mix(markColor, frame ? 38 : 78)} strokeWidth={1} />
            {name && <text x={x + 8} y={y + (frame ? 13 : 15)} fill={textFill}
              dominantBaseline="middle" fontSize="12" fontWeight={frame ? 600 : 500} pointerEvents="none">{name}</text>}
            {showValue && <text x={frame ? x + width - 8 : x + 8} y={y + (frame ? 13 : 31)}
              fill={frame ? "color-mix(in oklab, var(--muted-foreground) 80%, var(--foreground))" : textFill} dominantBaseline="middle"
              textAnchor={frame ? "end" : undefined} fontSize="11" fontWeight="500" pointerEvents="none">{value}</text>}
          </g>;
        })}
      </svg>
      {readout && !compact && <TreemapReadout readout={readout} point={tipPoint} width={width} height={height} portfolio={isPortfolio} />}
    </div>
    {!compact && <footer className={styles.footer}><strong>{footer[0]}{(id === "treemap-default" || isPortfolio) && <TrendingUp size={16} aria-hidden="true" />}</strong><span>{footer[1]}</span></footer>}
  </div>;
}
