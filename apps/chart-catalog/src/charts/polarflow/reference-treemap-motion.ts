const geometry = ["x", "y", "width", "height", "rx"] as const;
type Shape = SVGRectElement | SVGTextElement;
type Position = Partial<Record<typeof geometry[number], number>>;
type ShapeKey = "rect" | "name" | "value";
type ShapeState = { position: Position; velocity: Position };
type Mark = { group: SVGGElement; opacity: number; shapes: Map<ShapeKey, ShapeState> };
type Travel = { element: Shape; from: ShapeState; to: Position };
type Fade = { element: SVGGElement; from: number; to: number };

const layoutEnd = 1600;
const exitEnd = 720;
const exitCurve = [0, .084, .25, .422, .572, .692, .782, .849, .896, .929, .952, .968, .979, .986, .991, 1];
const animatedShapes = new WeakMap<Shape, ShapeState>();

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
    opacity: Number(getComputedStyle(group).opacity),
    shapes: new Map(shapes(group).map(shape => [shapeKey(shape), animatedShapes.get(shape) ?? { position: position(shape), velocity: {} }])),
  }]));
}

function spring(elapsed: number) {
  // A unit mass, stiffness 170, and damping 26 give roots of -13 ± i.
  const seconds = elapsed / 1000;
  const decay = Math.exp(-13 * seconds);
  const sine = Math.sin(seconds);
  const cosine = Math.cos(seconds);
  return {
    progress: 1 - decay * (cosine + 13 * sine),
    speed: decay * 170 * sine,
    carry: decay * sine,
    carrySpeed: decay * (cosine - 13 * sine),
  };
}

function fade({ element, from, to }: Fade, progress: number) {
  if (progress === 1 && to === 1) element.style.removeProperty("--treemap-layout-opacity");
  else element.style.setProperty("--treemap-layout-opacity", String(Math.max(0, from + (to - from) * progress)));
}

function focusFade(elapsed: number) {
  const sample = Math.min(exitCurve.length - 1, elapsed / 8);
  const low = Math.floor(sample);
  const high = Math.ceil(sample);
  return exitCurve[low] + (exitCurve[high] - exitCurve[low]) * (sample - low);
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
  const ghosts: SVGGElement[] = [];
  const retained = new Set<string>();
  const media = matchMedia("(prefers-reduced-motion: reduce)");
  const groups = markGroups(svg);
  // Nested zooms retain the breadcrumb and replace outside branches immediately.
  const fadeEdges = !previous.has("") || !groups.some(group => markKey(group) === "");

  for (const group of groups) {
    const key = markKey(group);
    const old = previous.get(key);
    retained.add(key);
    if (old) {
      for (const element of shapes(group)) {
        const from = old.shapes.get(shapeKey(element));
        if (from) moving.push({ element, from, to: position(element) });
      }
    }
    if (!old && fadeEdges && !group.hasAttribute("data-dimmed")) entering.push({ element: group, from: 0, to: 1 });
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

  let start: number | undefined;
  let frame = 0;
  function finish() {
    cancelAnimationFrame(frame);
    moving.forEach(settleTravel);
    entering.forEach(item => fade(item, 1));
    ghosts.forEach(ghost => ghost.remove());
  }
  function draw(now: number) {
    start ??= now;
    const elapsed = now - start;
    if (elapsed >= layoutEnd || media.matches) {
      finish();
      return;
    }
    const sample = spring(elapsed);
    moving.forEach(item => travel(item, sample));
    entering.forEach(item => fade(item, sample.progress));
    if (elapsed < exitEnd) leaving.forEach(item => fade(item, focusFade(elapsed)));
    else if (ghosts.length) {
      ghosts.forEach(ghost => ghost.remove());
      ghosts.length = 0;
      leaving.length = 0;
    }
    frame = requestAnimationFrame(draw);
  }
  moving.forEach(item => travel(item, spring(0)));
  entering.forEach(item => fade(item, 0));
  leaving.forEach(item => fade(item, 0));
  frame = requestAnimationFrame(draw);
  return finish;
}
