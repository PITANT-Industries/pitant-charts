import { Toggle } from "@ui-sdk/react/toggle";
import { useState, type KeyboardEvent } from "react";
import { nextChartFocus, percent } from "./shared";
import styles from "./styles.module.css";

export function useChartLoading(id: string, compact: boolean | undefined) {
  const hasDemo = id.endsWith("-loading");
  const [loading, setLoading] = useState(hasDemo);
  const control = hasDemo && !compact ? <div className={styles.controls}>
    <Toggle className={styles.control} pressed={loading} onPressedChange={setLoading}>Loading</Toggle>
  </div> : null;
  return { loading, hasDemo, control };
}

export function selectMark(event: KeyboardEvent<SVGSVGElement>, active: number | null, count: number, update: (next: number | null) => void) {
  if (event.key === "Escape" && active !== null) {
    event.preventDefault();
    event.stopPropagation();
    update(null);
    return;
  }
  const index = nextChartFocus(event.key, active, count);
  if (index === undefined) return;
  event.preventDefault();
  update(index);
}

export function hierarchyShare(value: number, total: number) {
  const percentage = percent(value, total);
  return `${percentage < 10 && percentage > 0 ? percentage.toPrecision(2) : Math.round(percentage)}%`;
}
