import { createChartSpring } from "../motion/chart-spring";

const geometry = ["x", "y", "width", "height", "rx"] as const;
type Shape = SVGRectElement | SVGTextElement;
type Position = Partial<Record<typeof geometry[number], number>>;
type ShapeKey = "rect" | "name" | "value";
type FadeState = { value: number; velocity: number };
type ShapeState = { position: Position; velocity: Position; fade?: FadeState; exiting?: boolean };
type Mark = { group: SVGGElement; opacity: FadeState; exiting: boolean; shapes: Map<ShapeKey, ShapeState> };
type Travel = { element: Shape; from: ShapeState; to: Position };
type Fade = { element: SVGElement; from: FadeState; to: number };

const layoutEnd = 1600;
const exitEnd = 720;
const animatedShapes = new WeakMap<Shape, ShapeState>();
const animatedFades = new WeakMap<SVGElement, FadeState>();
// Layout cleanup owns the 1600 ms lifetime, so retain the analytic tail.
const layoutSpring = createChartSpring({ stiffness: 170, damping: 26, restSpeed: Number.MIN_VALUE, restDelta: Number.MIN_VALUE });

function markGroups(svg: SVGSVGElement) {
  return Array.from(svg.querySelectorAll<SVGGElement>("[data-path], [data-mark='treemap-back'], [data-treemap-exit-key]"));
}

function markKey(group: SVGGElement) {
  return group.dataset.path ?? group.dataset.treemapExitKey ?? "";
}

function shapes(group: SVGGElement) {
  return Array.from(group.querySelectorAll<Shape>("rect, text"));
}

function shapeKey(shape: Shape): ShapeKey {
  if (shape.localName === "rect") return "rect";
  return shape.getAttribute("font-size") === "11" ? "value" : "name";
}

function position(shape: Shape): Position {
  const values: Position = {};
  for (const name of geometry) {
    const value = shape.getAttribute(name);
    if (value !== null) values[name] = Number(value);
  }
  return values;
}

export function captureTreemapLayout(svg: SVGSVGElement) {
  return new Map<string, Mark>(markGroups(svg).map(group => [markKey(group), {
    group: group.cloneNode(true) as SVGGElement,
    opacity: animatedFades.get(group) ?? { value: 1, velocity: 0 },
    exiting: group.hasAttribute("data-treemap-exit-key"),
    shapes: new Map(shapes(group).map(shape => [shapeKey(shape), {
      ...(animatedShapes.get(shape) ?? { position: position(shape), velocity: {} }),
      fade: animatedFades.get(shape),
      exiting: shape.hasAttribute("data-treemap-label-exit"),
    }])),
  }]));
}

function spring(elapsed: number) {
  const progress = layoutSpring.sample(elapsed, { from: 0, to: 1, velocity: 0 });
  const carry = layoutSpring.sample(elapsed, { from: 0, to: 0, velocity: 1 });
  return {
    progress: progress.value,
    speed: progress.velocity,
    carry: carry.value,
    carrySpeed: carry.velocity,
  };
}

function fade({ element, from, to }: Fade, sample: ReturnType<typeof spring>) {
  const value = from.value + (to - from.value) * sample.progress + from.velocity * sample.carry;
  const velocity = (to - from.value) * sample.speed + from.velocity * sample.carrySpeed;
  element.style.setProperty(element.localName === "text" ? "opacity" : "--treemap-layout-opacity", String(Math.max(0, value)));
  animatedFades.set(element, { value, velocity });
}

function settleFade({ element }: Fade) {
  animatedFades.delete(element);
  element.style.removeProperty(element.localName === "text" ? "opacity" : "--treemap-layout-opacity");
}

function travel({ element, from, to }: Travel, sample: ReturnType<typeof spring>) {
  const current = { ...to };
  const velocity: Position = {};
  for (const name of geometry) {
    const a = from.position[name];
    const b = to[name];
    const initialSpeed = from.velocity[name] ?? 0;
    if (a !== undefined && b !== undefined && (a !== b || initialSpeed !== 0)) {
      current[name] = a + (b - a) * sample.progress + initialSpeed * sample.carry;
      velocity[name] = (b - a) * sample.speed + initialSpeed * sample.carrySpeed;
      if (element.localName === "rect") element.style.setProperty(name, `${current[name]}px`);
    }
  }
  if (element.localName === "text" && current.x !== undefined && current.y !== undefined && to.x !== undefined && to.y !== undefined) {
    element.style.translate = `${current.x - to.x}px ${current.y - to.y}px`;
  }
  animatedShapes.set(element, { position: current, velocity });
}

function settleTravel({ element }: Travel) {
  animatedShapes.delete(element);
  if (element.localName === "text") element.style.removeProperty("translate");
  else for (const name of geometry) element.style.removeProperty(name);
}

export function glideTreemapLayout(svg: SVGSVGElement, previous: ReturnType<typeof captureTreemapLayout>) {
  const moving: Travel[] = [];
  const entering: Fade[] = [];
  const leaving: Fade[] = [];
  const ghosts: SVGElement[] = [];
  const retained = new Set<string>();
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const groups = markGroups(svg);
  // Nested zooms retain the breadcrumb and replace outside branches immediately.
  const fadeEdges = !previous.has("") || previous.get("")?.exiting === true || !groups.some(group => markKey(group) === "");

  for (const group of groups) {
    const key = markKey(group);
    const old = previous.get(key);
    retained.add(key);
    if (old) {
      const current = shapes(group);
      const currentKeys = new Set(current.map(shapeKey));
      for (const element of current) {
        const from = old.shapes.get(shapeKey(element));
        if (from) moving.push({ element, from, to: position(element) });
        if (element.localName === "text" && (!from || from.exiting)) entering.push({ element, from: { value: 0, velocity: 0 }, to: 1 });
      }
      for (const element of shapes(old.group)) {
        const key = shapeKey(element);
        const from = old.shapes.get(key);
        if (!fadeEdges || element.localName !== "text" || currentKeys.has(key) || !from) continue;
        element.style.removeProperty("translate");
        for (const name of ["x", "y"] as const) {
          if (from.position[name] !== undefined) element.setAttribute(name, String(from.position[name]));
        }
        element.setAttribute("data-treemap-label-exit", "");
        element.setAttribute("aria-hidden", "true");
        group.append(element);
        ghosts.push(element);
        leaving.push({ element, from: from.fade ?? { value: 1, velocity: 0 }, to: 0 });
      }
    }
    if (!old || old.exiting) entering.push({ element: group, from: { value: 0, velocity: 0 }, to: 1 });
  }

  for (const [key, { group, opacity, shapes: oldPositions }] of previous) {
    if (!fadeEdges || retained.has(key)) continue;
    delete group.dataset.path;
    delete group.dataset.mark;
    delete group.dataset.entering;
    delete group.dataset.active;
    group.dataset.treemapExitKey = key;
    group.removeAttribute("role");
    group.removeAttribute("aria-label");
    group.setAttribute("aria-hidden", "true");
    group.setAttribute("pointer-events", "none");
    for (const shape of shapes(group)) {
      const current = oldPositions.get(shapeKey(shape))?.position;
      for (const name of geometry) shape.style.removeProperty(name);
      shape.style.removeProperty("translate");
      if (current) for (const name of geometry) {
        if (current[name] !== undefined) shape.setAttribute(name, String(current[name]));
      }
    }
    svg.append(group);
    ghosts.push(group);
    leaving.push({ element: group, from: opacity, to: 0 });
  }

  const start = performance.now();
  let frame = 0;
  function finish() {
    cancelAnimationFrame(frame);
    moving.forEach(settleTravel);
    entering.forEach(settleFade);
    ghosts.forEach(ghost => ghost.remove());
  }
  function draw(now: number) {
    const elapsed = now - start;
    if (elapsed >= layoutEnd || media.matches) {
      finish();
      return;
    }
    const sample = spring(elapsed);
    moving.forEach(item => travel(item, sample));
    entering.forEach(item => fade(item, sample));
    if (elapsed < exitEnd) leaving.forEach(item => fade(item, sample));
    else if (ghosts.length) {
      ghosts.forEach(ghost => ghost.remove());
      ghosts.length = 0;
      leaving.length = 0;
    }
    frame = requestAnimationFrame(draw);
  }
  moving.forEach(item => travel(item, spring(0)));
  entering.forEach(item => fade(item, spring(0)));
  leaving.forEach(item => fade(item, spring(0)));
  frame = requestAnimationFrame(draw);
  return finish;
}
