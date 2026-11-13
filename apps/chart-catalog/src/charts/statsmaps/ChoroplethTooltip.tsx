import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { CartesianReadout } from "../cartesian/CartesianFocus";
import { createChartSpring, type ChartSpringState } from "../motion/chart-spring";
import { resolveChartTooltipPlacement } from "../tooltip/placement";
import type { Coordinate } from "./geo-fixtures";

const tooltipSpring = createChartSpring({ stiffness: 3600, damping: 120, restSpeed: 2, restDelta: .05 });
type Position = { x: number; y: number; vx: number; vy: number };
type Follow = { start: number; x: ChartSpringState; y: ChartSpringState };

export function ChoroplethTooltip({ host, scene, width, height, label, entries, point, identity }: {
  host: RefObject<HTMLDivElement | null>;
  scene: RefObject<SVGSVGElement | null>;
  width: number;
  height: number;
  label?: string;
  entries: { name: string; value: number | string; color: string }[];
  point?: Coordinate;
  identity: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const positioned = useRef<HTMLDivElement | null>(null);
  const latest = useRef(point);
  const base = useRef({ x: 0, y: 0 });
  const painted = useRef<Position | null>(null);
  const follow = useRef<Follow | null>(null);
  const request = useRef(0);
  const preference = useRef<MediaQueryList | null>(null);
  latest.current = point;

  function stop() {
    cancelAnimationFrame(request.current);
    request.current = 0;
    follow.current = null;
    panel.current?.style.removeProperty("translate");
    painted.current = { ...base.current, vx: 0, vy: 0 };
  }

  function tick(now: number) {
    request.current = 0;
    const element = panel.current, motion = follow.current;
    if (!element || !motion) return;
    const x = tooltipSpring.sample(now - motion.start, motion.x);
    const y = tooltipSpring.sample(now - motion.start, motion.y);
    painted.current = { x: base.current.x + x.value, y: base.current.y + y.value, vx: x.velocity, vy: y.velocity };
    if (x.done && y.done) {
      follow.current = null;
      element.style.removeProperty("translate");
    } else {
      element.style.translate = `${x.value}px ${y.value}px`;
      request.current = requestAnimationFrame(tick);
    }
  }

  function place(jump = false) {
    const element = panel.current, root = host.current, anchor = latest.current;
    if (!element || !root || !anchor) return;
    const now = performance.now();
    const bounds = root.getBoundingClientRect();
    let x = anchor[0], y = anchor[1];
    const svg = scene.current;
    if (svg) {
      const style = getComputedStyle(svg);
      if (style.transform !== "none") {
        const origin = style.transformOrigin.split(" ").map(Number.parseFloat);
        const ox = origin[0] ?? width / 2, oy = origin[1] ?? height / 2;
        const projected = new DOMPoint(x - ox, y - oy).matrixTransform(new DOMMatrix(style.transform));
        // SVG getScreenCTM flattens perspective; retain the homogeneous divide.
        if (projected.w && Number.isFinite(projected.w)) {
          x = projected.x / projected.w + ox;
          y = projected.y / projected.w + oy;
        }
      }
    }
    const position = resolveChartTooltipPlacement({ x, y },
      { width: element.offsetWidth, height: element.offsetHeight },
      { left: 0, top: 0, right: bounds.width, bottom: bounds.height }, ["right", "left"], 16);
    let from = painted.current;
    const previous = follow.current;
    if (previous) {
      const x = tooltipSpring.sample(now - previous.start, previous.x);
      const y = tooltipSpring.sample(now - previous.start, previous.y);
      from = { x: base.current.x + x.value, y: base.current.y + y.value, vx: x.velocity, vy: y.velocity };
    }
    const moved = base.current.x !== position.left || base.current.y !== position.top;
    base.current = { x: position.left, y: position.top };
    element.dataset.placement = position.placement;
    element.style.left = `${position.left}px`;
    element.style.top = `${position.top}px`;
    if (jump || !from || preference.current?.matches) {
      stop();
    } else if (moved) {
      follow.current = { start: now,
        x: { from: from.x - position.left, to: 0, velocity: from.vx },
        y: { from: from.y - position.top, to: 0, velocity: from.vy } };
      element.style.translate = `${from.x - position.left}px ${from.y - position.top}px`;
      if (!request.current) request.current = requestAnimationFrame(tick);
    }
  }

  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    preference.current = query;
    const update = () => { if (query.matches) stop(); };
    query.addEventListener("change", update);
    return () => { query.removeEventListener("change", update); preference.current = null; stop(); };
  }, []);

  useLayoutEffect(() => {
    const element = panel.current;
    const entering = positioned.current !== element;
    if (entering) {
      stop();
      positioned.current = element;
      painted.current = null;
    }
    if (!element) return;
    place(entering);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => place());
    observer.observe(element);
    return () => observer.disconnect();
  }, [identity, label, entries, point?.[0], point?.[1], width, height]);

  return label && point ? <div className="choropleth-tooltip" key={identity} ref={panel}>
    <CartesianReadout label={label} entries={entries} />
  </div> : null;
}
