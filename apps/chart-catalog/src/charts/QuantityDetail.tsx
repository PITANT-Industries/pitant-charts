import { Button } from "@ui-sdk/react/button";
import { Toggle } from "@ui-sdk/react/toggle";
import { LoaderCircle, TrendingUp } from "lucide-react";
import { useState } from "react";
import { CartesianReadout } from "./cartesian/CartesianFocus";
import type { KeyboardEvent, ReactNode } from "react";
import styles from "./QuantityDetail.module.css";

export { styles as quantityStyles };
export const qtyNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
export const qtyColor = (index: number) => `var(--chart-${index + 1})`;
export const qtyMix = (color: string, ratio: number) => `color-mix(in oklab, ${color} ${ratio}%, var(--card))`;
export const qtyContrast = (color: string) => `lch(from ${color} calc((49.44 - l) * infinity) 0 0)`;
export const qtyRound = (value: number) => Math.round(value * 100) / 100;
export const qtyPercent = (value: number, total: number) => {
  const percent = total > 0 ? value / total * 100 : 0;
  return `${percent > 0 && percent < 10 ? percent.toFixed(1) : Math.round(percent)}%`;
};

export function useQuantitySelection() {
  const [active, setActive] = useState<number | null>(null);
  const [emphasis, setEmphasis] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  function keyboard(event: KeyboardEvent<SVGSVGElement>, count: number, vertical = false) {
    if (count < 1) return;
    if (event.key === "Escape" && (active !== null || pinned !== null)) {
      event.preventDefault();
      event.stopPropagation();
      setActive(null);
      setPinned(null);
      return;
    }
    const next = event.key === "Home" ? 0 : event.key === "End" ? count - 1
      : event.key === "ArrowLeft" || vertical && event.key === "ArrowUp" ? active === null ? count - 1 : (active + count - 1) % count
        : event.key === "ArrowRight" || vertical && event.key === "ArrowDown" ? active === null ? 0 : (active + 1) % count : undefined;
    if (next !== undefined) {
      event.preventDefault();
      setActive(next);
    }
  }
  return { active, setActive, emphasis: emphasis ?? pinned, setEmphasis, pinned, setPinned, keyboard };
}

export function QuantityLoading({ pressed, onChange }: { pressed: boolean; onChange: (value: boolean) => void }) {
  return <div className={styles.controls}><Toggle className={styles.toggle} pressed={pressed} onPressedChange={onChange}>
    <LoaderCircle size={16} aria-hidden="true" />Loading
  </Toggle></div>;
}

export function QuantityCaption({ headline, children, trend }: { headline: string; children: ReactNode; trend?: boolean }) {
  return <footer className={styles.footer}><strong>{headline}{trend && <TrendingUp size={16} aria-hidden="true" />}</strong><span>{children}</span></footer>;
}

export function QuantityLegend({ title, items, focus, emphasized, pinned, onFocus, onSelect }: {
  title: string; items: { name: string; value: number; color: string }[];
  focus: number | null; emphasized: number | null; pinned: number | null;
  onFocus: (index: number | null) => void; onSelect: (index: number) => void;
}) {
  return <div className={styles.legend} data-legend={title}><strong>{title}</strong>
    {items.map((item, index) => <Button type="button" key={item.name} aria-pressed={pinned === index}
      data-active={focus === index || emphasized === index} onClick={() => onSelect(index)}
      onPointerEnter={() => onFocus(index)} onPointerLeave={() => onFocus(null)} onFocus={() => onFocus(index)} onBlur={() => onFocus(null)}>
      <i aria-hidden="true" style={{ background: item.color }} /><span>{item.name}</span><b>{qtyNumber.format(item.value)}</b>
    </Button>)}
  </div>;
}

export function QuantityTip({ label, rows, x, y, width, height }: {
  label: string; rows: { name: string; value: string | number; color: string }[]; x: number; y: number; width: number; height: number;
}) {
  const shiftLeft = x > width * .55;
  const position = shiftLeft ? { right: Math.max(6, width - x + 10) } : { left: Math.max(6, x + 10) };
  return <div className={styles.tip} style={{ ...position, top: Math.max(4, Math.min(y, height - (rows.length * 20 + 42))) }}>
    <CartesianReadout label={label} entries={rows} />
  </div>;
}

export function QuantityGrid({ horizontal, at, from, to }: { horizontal?: boolean; at: number; from: number; to: number }) {
  return <line x1={horizontal ? from : at} y1={horizontal ? at : from} x2={horizontal ? to : at} y2={horizontal ? at : to}
    stroke="var(--chart-grid, var(--border))" strokeDasharray="4 4" />;
}
