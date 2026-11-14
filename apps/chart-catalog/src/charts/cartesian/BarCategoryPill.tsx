import { useEffect, useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import { RolledAxisPill } from "../RolledAxisPill";
import { createChartSpring, type ChartSpringState } from "../motion/chart-spring";
import type { ChartTheme } from "./options";

// The delivered native Bar provider uses this critical spring for its 24px rows.
const spring = createChartSpring({ stiffness: 3600, damping: 120, mass: 1, restDelta: .5, restSpeed: 2 });

export function BarCategoryPill({ categories, index, x, y, visible, theme }: {
  categories: readonly string[]; index: number; x: number; y: number; visible: boolean; theme: ChartTheme;
}) {
  const host = useRef<HTMLDivElement>(null);
  const previous = useRef<string | null>(null);
  const axis = useRef<ChartSpringState & { start: number }>({ from: 0, to: 0, velocity: 0, start: 0 });
  const frame = useRef(0);
  const signature = JSON.stringify(categories);
  const columns = useMemo(() => [[...categories], categories.map(() => "")], [signature]);

  function cancel() {
    cancelAnimationFrame(frame.current);
    frame.current = 0;
  }
  function write(value: number) {
    host.current?.querySelectorAll<HTMLElement>(".chart-axis-pill-stack").forEach(stack => {
      stack.style.transform = `translateY(${value}px)`;
    });
  }
  function settle() {
    cancel();
    axis.current = { from: axis.current.to, to: axis.current.to, velocity: 0, start: 0 };
    write(axis.current.to);
  }
  function tick(now: number) {
    frame.current = 0;
    if (!host.current) return;
    const sample = spring.sample(now - axis.current.start, axis.current);
    write(sample.value);
    if (!sample.done) frame.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => { if (media.matches) settle(); };
    media.addEventListener("change", update);
    update();
    return () => { media.removeEventListener("change", update); cancel(); };
  }, []);
  useLayoutEffect(() => {
    const now = performance.now();
    cancel();
    if (previous.current !== signature) {
      previous.current = signature;
      axis.current = { from: 0, to: 0, velocity: 0, start: now };
    }
    const to = -24 * Math.max(0, Math.min(categories.length - 1, index));
    if (axis.current.to !== to) {
      const sample = spring.sample(now - axis.current.start, axis.current);
      axis.current = { from: sample.value, to, velocity: sample.velocity, start: now };
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) settle();
    else {
      write(spring.sample(now - axis.current.start, axis.current).value);
      frame.current = requestAnimationFrame(tick);
    }
  }, [signature, index]);

  const ratio = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return <div ref={host} className="reference-bar-category-pill" data-bar-category-pill="" aria-hidden="true"
    style={{ visibility: visible ? "visible" : "hidden",
      "--chart-axis-pill-background": `var(--chart-date-pill-background, var(--chart-focus-pill, ${theme.text}))`,
      "--chart-axis-pill-foreground": `var(--chart-date-pill-foreground, var(--chart-focus-pill-text, ${theme.surface}))`,
    } as CSSProperties}>
    <RolledAxisPill columns={columns} index={0} x={Math.round(x * ratio) / ratio} y={y} collapseConstantColumns={false} />
  </div>;
}
