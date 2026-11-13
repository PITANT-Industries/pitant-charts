import { useLayoutEffect, useRef } from "react";
import type { Coordinate } from "./geo-fixtures";

// Camera flight math adapted from Bklit UI's MIT-licensed choropleth-camera.
// Centre moves linearly and scale geometrically over a 700 ms quint ease.
export type MapView = { cx: number; cy: number; k: number };
type Angles = { tilt: number; yaw: number };
type Frame = MapView & Angles;
type Flight<T> = { from: T; to: T; start: number };
type YawSpring = { value: number; to: number; velocity: number; last: number };

function ease(time: number) {
  if (time <= 0) return 0;
  if (time >= 1) return 1;
  let low = 0, high = 1, u = time;
  for (let index = 0; index < 30; index++) {
    const inverse = 1 - u;
    const x = 3 * inverse * inverse * u * .83 + 3 * inverse * u * u * .17 + u * u * u;
    if (Math.abs(x - time) < 1e-9) break;
    if (x < time) low = u; else high = u;
    u = (low + high) / 2;
  }
  return 3 * (1 - u) * u * u + u * u * u;
}

export function useChoroplethCameraMotion({ active, width, height, target, tilt, yaw, pointer }: {
  active: boolean; width: number; height: number; target: MapView; tilt: number; yaw: number; pointer: boolean;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const viewport = useRef<SVGGElement>(null);
  const land = useRef<SVGGElement>(null);
  const markers = useRef(new Map<string, { element: SVGGElement; at: Coordinate }>());
  const frame = useRef<Frame>({ ...target, tilt, yaw });
  const viewTarget = useRef(target);
  const viewFlight = useRef<Flight<MapView> | null>(null);
  const tiltFlight = useRef<Flight<number> | null>(null);
  const yawTween = useRef<Flight<number> | null>(null);
  const yawFlight = useRef<YawSpring | null>(null);
  const yawVelocity = useRef(0);
  const request = useRef(0);
  const preference = useRef<MediaQueryList | null>(null);
  const latest = useRef({ active, width, height, target, tilt, yaw, pointer });
  latest.current = { active, width, height, target, tilt, yaw, pointer };

  function write() {
    const config = latest.current;
    if (!config.active) return;
    const value = frame.current;
    const x = config.width / 2 - value.cx * value.k;
    const y = config.height / 2 - value.cy * value.k;
    if (viewport.current) viewport.current.style.transform = `translate(${x}px,${y}px) scale(${value.k})`;
    land.current?.setAttribute("stroke-width", String(4.9 + 1.4 * Math.max(0, Math.min(1, value.k - 1))));
    if (svg.current) svg.current.style.transform = value.tilt || value.yaw
      ? `perspective(1600px) translateY(10%) rotateX(${value.tilt}deg) rotateY(${value.yaw}deg) translateY(-10%)` : "";
    for (const { element, at } of markers.current.values()) {
      element.style.transform = `translate(${at[0] * value.k + x}px,${at[1] * value.k + y}px)`;
    }
  }

  function stop() {
    cancelAnimationFrame(request.current);
    request.current = 0;
    viewFlight.current = null;
    tiltFlight.current = null;
    yawTween.current = null;
    yawFlight.current = null;
    yawVelocity.current = 0;
  }

  function tick(now: number) {
    request.current = 0;
    const view = viewFlight.current;
    if (view) {
      const elapsed = Math.max(0, now - view.start) / 700;
      const t = ease(elapsed);
      frame.current.cx = view.from.cx + (view.to.cx - view.from.cx) * t;
      frame.current.cy = view.from.cy + (view.to.cy - view.from.cy) * t;
      frame.current.k = Math.exp(Math.log(view.from.k) + (Math.log(view.to.k) - Math.log(view.from.k)) * t);
      if (elapsed >= 1) { Object.assign(frame.current, view.to); viewFlight.current = null; }
    }
    const tiltTween = tiltFlight.current;
    if (tiltTween) {
      const elapsed = Math.max(0, now - tiltTween.start) / 700;
      const t = ease(elapsed);
      frame.current.tilt = tiltTween.from + (tiltTween.to - tiltTween.from) * t;
      if (elapsed >= 1) { frame.current.tilt = tiltTween.to; tiltFlight.current = null; }
    }
    const yawTransition = yawTween.current;
    if (yawTransition) {
      const elapsed = Math.max(0, now - yawTransition.start) / 700;
      const t = ease(elapsed);
      frame.current.yaw = yawTransition.from + (yawTransition.to - yawTransition.from) * t;
      if (elapsed >= 1) { frame.current.yaw = yawTransition.to; yawTween.current = null; }
    }
    const spring = yawFlight.current;
    if (spring) {
      // The live camera integrates two semi-implicit steps per frame and caps
      // long frame gaps at 1/30 s. Preserve velocity when the pointer reverses.
      const dt = Math.max(0, Math.min(now - spring.last, 1000 / 30)) / 2000;
      for (let step = 0; step < 2; step++) {
        spring.velocity += (90 * (spring.to - spring.value) - 20 * spring.velocity) * dt;
        spring.value += spring.velocity * dt;
      }
      spring.last = now;
      if (Math.abs(spring.to - spring.value) < .005 && Math.abs(spring.velocity) < .01) {
        spring.value = spring.to;
        spring.velocity = 0;
        yawFlight.current = null;
      }
      frame.current.yaw = spring.value;
      yawVelocity.current = spring.velocity;
    }
    write();
    if (viewFlight.current || tiltFlight.current || yawTween.current || yawFlight.current) request.current = requestAnimationFrame(tick);
  }

  useLayoutEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    preference.current = query;
    const update = () => {
      if (!query.matches) return;
      stop();
      const config = latest.current;
      frame.current = { ...config.target, tilt: config.tilt, yaw: config.pointer ? 0 : config.yaw };
      write();
    };
    query.addEventListener("change", update);
    return () => { query.removeEventListener("change", update); preference.current = null; stop(); };
  }, []);

  useLayoutEffect(() => {
    stop();
    const config = latest.current;
    // Projection changes reset the zoom immediately; angle changes can still
    // fly from the current orientation in the effect below.
    frame.current = { ...config.target, tilt: frame.current.tilt, yaw: frame.current.yaw };
    viewTarget.current = config.target;
    write();
  }, [width, height]);

  useLayoutEffect(() => {
    if (!active) { stop(); return; }
    const now = performance.now();
    const from = frame.current;
    if (preference.current?.matches) {
      stop();
      frame.current = { ...target, tilt, yaw: pointer ? 0 : yaw };
    } else {
      if (viewTarget.current.cx !== target.cx || viewTarget.current.cy !== target.cy || viewTarget.current.k !== target.k) {
        viewFlight.current = { from: { cx: from.cx, cy: from.cy, k: from.k }, to: target, start: now };
      }
      const returningTilt = tiltFlight.current?.to === tilt;
      if (pointer && (from.tilt === tilt || returningTilt)) {
        // Pointer yaw is independent of the tilt returning from a focused
        // view. Keep that flight's original deadline when the pointer moves.
        if (!returningTilt) tiltFlight.current = null;
        yawTween.current = null;
        yawFlight.current = { value: from.yaw, to: yaw, velocity: yawVelocity.current, last: now };
      } else {
        yawFlight.current = null;
        yawVelocity.current = 0;
        tiltFlight.current = { from: from.tilt, to: tilt, start: now };
        yawTween.current = { from: from.yaw, to: yaw, start: now };
      }
      if (!request.current) request.current = requestAnimationFrame(tick);
    }
    viewTarget.current = target;
    write();
  }, [active, target.cx, target.cy, target.k, tilt, yaw, pointer]);

  // Refs can change on an ordinary React render while an imperative flight runs.
  useLayoutEffect(write);

  return { svg, viewport, land, markerRef: (name: string, at: Coordinate) => (element: SVGGElement | null) => {
    if (element) markers.current.set(name, { element, at }); else markers.current.delete(name);
  } };
}
