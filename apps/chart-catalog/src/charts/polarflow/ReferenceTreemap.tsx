import { Toggle } from "@ui-sdk/react/toggle";
import { LoaderCircle, TrendingUp } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import { useChartTheme } from "../theme";
import { usePlotSize } from "../usePlotSize";
import { skeletonTiles, treemapTiles, type TreemapTile } from "./reference-treemap-layout";
import { captureTreemapLayout, glideTreemapLayout } from "./reference-treemap-motion";
import { dollars, nextChartFocus, number, percent, type Props } from "./shared";
import { referenceTreemapData } from "./reference-caller-data";
import { referenceTreemapFixtures } from "./reference-treemap-fixtures";
import type { SunburstNode } from "./upstream/sunburst-data";
import { sumValues } from "./upstream/sunburst-layout";
import styles from "./reference-treemap.module.css";

type Point = { x: number; y: number };
type Focus = { index: number; point?: never } | { index?: never; point: Point };
type Readout = { title: string; entries: { name: string; value: string; color?: string }[] };

const breadcrumbHeight = 24;
const tooltipOffset = 16;
const loadingFade = 450;

const palette = (index: number) => `var(--chart-${index + 1})`;
const mix = (color: string, amount: number) => `color-mix(in oklab, ${color} ${amount}%, var(--card))`;
const leafValue = (id: string, value: number) => {
  if (id === "treemap-drilldown") return `${number.format(value)} kB`;
  if (id === "treemap-loading") return value >= 1000 ? `${(value / 1000).toFixed(1)} TB` : `${number.format(value)} GB`;
  return value >= 1000 ? `$${value >= 10000 ? Math.round(value / 1000) : (value / 1000).toFixed(1)}k` : dollars.format(value);
};

function hierarchyAt(root: SunburstNode, path: readonly number[]) {
  return path.reduce((node, index) => node.children?.[index] ?? node, root);
}

function pathNames(root: SunburstNode, path: readonly number[]) {
  const names: string[] = [];
  let node = root;
  for (const index of path) {
    const child = node.children?.[index];
    if (!child) break;
    names.push(child.name);
    node = child;
  }
  return names;
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

function inspect(marks: TreemapTile[], hasBreadcrumb: boolean, point: Point, width: number) {
  if (point.x < 0 || point.x > width || point.y < 0) return null;
  if (hasBreadcrumb && point.y <= breadcrumbHeight) return { index: 0 };
  for (let index = marks.length - 1; index >= 0; index--) {
    const { x, y, width, height } = marks[index].bounds;
    if (width > 0 && height > 0 && point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) {
      return { index: index + Number(hasBreadcrumb) };
    }
  }
  return null;
}

function TreemapReadout({ readout, point, width, height, portfolio }: {
  readout: Readout;
  point: Point;
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
  const desiredLeft = alignLeft ? point.x - size.width - tooltipOffset : point.x + tooltipOffset;
  const left = Math.max(0, Math.min(desiredLeft, width - size.width));
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

export function ReferenceTreemap({ example, compact = false, data }: Props) {
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
  const root = useMemo(() => referenceTreemapData(data, referenceTreemapFixtures[id] ?? referenceTreemapFixtures["treemap-default"]), [data, id]);
  const formatValue = (value: number) => data && !hasDrilldown && !hasLoading ? number.format(value) : leafValue(id, value);
  const total = sumValues(root);
  const [loading, setLoading] = useState(hasLoading);
  const [path, setPath] = useState<number[]>([]);
  const [focus, setFocus] = useState<Focus | null>(null);
  const [keyboardFocus, setKeyboardFocus] = useState<number | null>(null);
  const [entering, setEntering] = useState(true);
  const [loadingDelay, setLoadingDelay] = useState(0);
  const exit = useRef<SVGSVGElement | null>(null);
  const pendingLayout = useRef<ReturnType<typeof captureTreemapLayout> | null>(null);
  const finishLayout = useRef<(() => void) | null>(null);
  const current = hierarchyAt(root, path);
  const displayPath = pathNames(root, path);
  const measured = usePlotSize<SVGSVGElement>(576, isPortfolio ? 288 : 360);
  const { plot } = measured;
  // Use the declared aspect ratio instead of a browser's quantized block size.
  const width = measured.width;
  const height = compact ? measured.height : width / (isPortfolio ? 2 : 1.6);
  const entranceScale = 420 / (width + height);
  const marks = useMemo(() => loading || total <= 0 ? [] : treemapTiles(root, pathNames(root, path), current, width, height, isPortfolio, path),
    [current, height, isPortfolio, loading, path, root, total, width]);
  const backIndex = path.length ? 0 : -1;
  const offset = backIndex + 1;
  const currentFocus = focus?.point ? inspect(marks, path.length > 0, focus.point, width) : focus;
  const backActive = currentFocus?.index === backIndex;
  const active = currentFocus && currentFocus.index >= offset ? marks[currentFocus.index - offset] : undefined;
  const crumb = fitLabel(`‹  ${[root.name, ...displayPath].join(" / ")}`, width - 16, 12, measure) || "‹";
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
      entries: [{ name: "Value", value: data ? number.format(value) : dollars.format(value) }, { name: "Share", value: `${percent(value, total).toFixed(1)}% of the portfolio` }],
    };
    return {
      title: active.path.join(" / "),
      entries: [
        { name: hasDrilldown ? "Size" : hasLoading ? "Stored" : "Spend", value: formatValue(value), color: active.node.color ?? palette(data ? active.color % theme.colors.length : active.color) },
        { name: `Share of ${current.name}`, value: displayShare(value, sumValues(current)) },
      ],
    };
  }, [active, backActive, current, data, hasDrilldown, hasLoading, id, isPortfolio, path, root, theme.colors.length, total, value]);

  useLayoutEffect(() => {
    finishLayout.current?.();
    const svg = plot.current;
    const layout = pendingLayout.current;
    finishLayout.current = svg && layout ? glideTreemapLayout(svg, layout) : null;
    pendingLayout.current = null;
  }, [marks, path, plot]);

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    function clearMotion() {
      finishLayout.current?.();
      finishLayout.current = null;
      const overlay = exit.current;
      overlay?.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
      overlay?.remove();
      exit.current = null;
    }
    const onPreference = () => { if (media.matches) clearMotion(); };
    media.addEventListener("change", onPreference);
    return () => {
      media.removeEventListener("change", onPreference);
      clearMotion();
    };
  }, []);

  const previousRoot = useRef(root);
  useLayoutEffect(() => {
    if (previousRoot.current === root) return;
    previousRoot.current = root;
    finishLayout.current?.();
    finishLayout.current = null;
    pendingLayout.current = null;
    exit.current?.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    exit.current?.remove();
    exit.current = null;
    setLoadingDelay(0);
    setPath([]);
    setKeyboardFocus(null);
    setFocus(null);
  }, [root]);

  function canAnimate() {
    return !compact && !window.matchMedia("(prefers-reduced-motion: reduce)").matches && !!plot.current?.animate;
  }

  function go(next: number[], glide = true, point?: Point) {
    const svg = plot.current;
    pendingLayout.current = svg && glide && canAnimate() ? captureTreemapLayout(svg) : null;
    finishLayout.current?.();
    finishLayout.current = null;
    setEntering(!glide);
    setPath(next);
    setKeyboardFocus(null);
    setFocus(point ? { point } : null);
  }

  function toggleLoading(next: boolean) {
    exit.current?.remove();
    exit.current = null;
    const svg = plot.current;
    const delay = next && svg && canAnimate() ? loadingFade : 0;
    if (svg && delay) {
      const overlay = svg.cloneNode(true) as SVGSVGElement;
      for (const attribute of ["aria-busy", "aria-description", "aria-label", "aria-roledescription", "role", "tabindex", "id"]) {
        overlay.removeAttribute(attribute);
      }
      overlay.setAttribute("aria-hidden", "true");
      overlay.setAttribute("class", styles.loadingExit);
      overlay.querySelectorAll("[data-mark], [data-treemap-exit-key]").forEach(element => {
        element.removeAttribute("data-mark");
        element.removeAttribute("data-path");
        element.removeAttribute("data-entering");
        element.removeAttribute("data-active");
        element.removeAttribute("data-dimmed");
        element.removeAttribute("data-treemap-exit-key");
        element.removeAttribute("role");
        element.removeAttribute("aria-label");
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
    const target = tile.node.children?.length ? tile.indices : tile.indices.slice(0, -1);
    return target.length > path.length ? target : null;
  }

  function isRelated(tile: TreemapTile) {
    if (!active) return !backActive;
    return tile.indices.every((value, index) => active.indices[index] === value) ||
      (active.frame && active.indices.every((value, index) => tile.indices[index] === value));
  }

  function handleKeys(event: KeyboardEvent<SVGSVGElement>) {
    if (loading || compact) return;
    const key = event.key;
    if (key === "Escape" && (currentFocus || path.length)) {
      event.preventDefault();
      event.stopPropagation();
      if (path.length) goBack();
      else { setKeyboardFocus(null); setFocus(null); }
    } else if (key === "Enter" || key === " ") {
      if (path.length && currentFocus?.index === backIndex) {
        event.preventDefault();
        goBack();
      } else if (active) {
        const target = drillTarget(active);
        if (!target) return;
        event.preventDefault();
        go(target);
      }
    } else {
      const index = nextChartFocus(key, currentFocus?.index ?? null, marks.length + offset);
      if (index !== undefined) {
        event.preventDefault();
        setKeyboardFocus(index);
        setFocus({ index });
      }
    }
  }

  function pointerPoint(event: MouseEvent<SVGSVGElement>) {
    const rect = plot.current?.getBoundingClientRect();
    return rect ? { x: Math.trunc(event.clientX) - rect.left, y: Math.trunc(event.clientY) - rect.top } : undefined;
  }

  function handlePlotPointer(event: MouseEvent<SVGSVGElement>) {
    if (compact || loading) return;
    const point = pointerPoint(event);
    const next = point && inspect(marks, path.length > 0, point, width);
    if (next || focus?.point) setFocus(next && point ? { point } : keyboardFocus === null ? null : { index: keyboardFocus });
  }

  function handlePlotClick(event: MouseEvent<SVGSVGElement>) {
    if (compact || loading) return;
    const point = pointerPoint(event);
    const clicked = point && inspect(marks, path.length > 0, point, width);
    if (!clicked) return;
    const tile = marks[clicked.index - offset];
    const target = clicked.index === backIndex ? path.slice(0, -1) : tile && drillTarget(tile);
    if (target) go(target, true, point);
  }

  const footer = data ? [loading ? "Fetching data…" : `${formatValue(total)} in total`, hasDrilldown
    ? `${[root.name, ...displayPath].join(" / ")} · click a folder to open it, the breadcrumb to go back`
    : `${root.children?.length ?? 0} groups${isPortfolio ? "" : " · click a group to inspect its contents"}`] : isPortfolio ? ["71% in equities, 19% in bonds", "$750,000 across 12 holdings"] : hasDrilldown
    ? [[root.name, ...displayPath].join(" / "), "701 kB in all: click a folder to open it, the breadcrumb to go back"]
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
    <div className={styles.stage} data-inspecting={!!currentFocus || undefined}>
      <svg ref={plot} viewBox={`0 0 ${Number(width.toFixed(2))} ${Number(height.toFixed(2))}`} role="img" aria-label={example.title} aria-roledescription="chart" aria-busy={loading}
        aria-description={loading ? "Loading" : `Viewing ${current.name}. Use arrow keys to inspect rectangles${isPortfolio ? "." : ", Enter or Space to zoom, and Escape to go back."}`}
        tabIndex={compact || loading ? undefined : 0} onKeyDown={handleKeys}
        onPointerMove={handlePlotPointer} onClick={handlePlotClick}
        onPointerDown={event => { if (event.pointerType === "touch") handlePlotPointer(event); }}
        onBlur={() => { setKeyboardFocus(null); setFocus(null); }}
        onPointerLeave={() => setFocus(document.activeElement === plot.current && keyboardFocus !== null ? { index: keyboardFocus } : null)}>
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
          data-active={backActive || undefined} data-dimmed={!!active || undefined}>
          <path d={`M0 0H${width}V${breadcrumbHeight}H0Z`} fill="transparent" />
          <rect x="0" y="0" width={crumbWidth} height={breadcrumbHeight} rx="6" fill="color-mix(in oklab, var(--muted-foreground) 8%, transparent)" />
          <text x="8" y="13" dominantBaseline="middle" fill="var(--muted-foreground)" fontSize="12" fontWeight="500" xmlSpace="preserve">
            {crumb}
          </text>
        </g>}
        {marks.map(mark => {
          const { node, bounds, tint, frame, color, path, indices, header } = mark;
          const { x, y, width, height } = bounds;
          if (!width || !height) return null;
          const target = drillTarget(mark);
          const markKey = data ? indices.join("/") : path.join("/");
          const markColor = node.color ?? palette(data ? color % theme.colors.length : color);
          const fill = mix(markColor, tint);
          const textFill = frame ? "var(--popover-foreground)" : `lch(from ${fill} calc((49.44 - l) * infinity) 0 0)`;
          const value = formatValue(sumValues(node));
          const labelWidth = frame ? width - 24 - measure(value, 11, 500) : width - 16;
          const showName = !compact && (frame ? header : width >= 36 && height >= 26);
          const name = showName ? fitLabel(node.name, labelWidth, 12, measure, frame ? 600 : 500) : "";
          const showValue = !!name && (frame || height >= 42 && measure(value, 11, 500) <= labelWidth);
          const radius = Math.min(isPortfolio ? 3 : 6, width / 2, height / 2) + (frame ? 2 : 0);
          return <g key={markKey} data-mark={frame ? "treemap-frame" : "treemap-tile"} data-path={markKey} data-label-path={path.join("/")}
            className={target && !compact ? styles.branch : undefined} data-active={active === mark || undefined} data-dimmed={!isRelated(mark) || undefined}
            data-entering={entering && !compact || undefined} style={{ "--treemap-entrance-delay": `${(x + y) * entranceScale}ms` } as CSSProperties}
            role={target && !compact ? "button" : undefined} aria-label={`${path.join(" / ")}: ${value}`}>
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
      {!loading && total <= 0 && !compact && <div role="status">No data available</div>}
      {readout && !compact && <TreemapReadout readout={readout} point={tipPoint} width={width} height={height} portfolio={isPortfolio} />}
    </div>
    {!compact && <footer className={styles.footer}><strong>{footer[0]}{!data && (id === "treemap-default" || isPortfolio) && <TrendingUp size={16} aria-hidden="true" />}</strong><span>{footer[1]}</span></footer>}
  </div>;
}
