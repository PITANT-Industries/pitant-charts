import NumberFlow, { type Format } from "@number-flow/react";
import type { ReactNode } from "react";
import styles from "./donut.module.css";

const numberFormat: Format = { maximumFractionDigits: 1 };
const currencyFormat: Format = { style: "currency", currency: "USD", maximumFractionDigits: 0 };

export function CircularCenter({ center, size, value, label, currency, animated, fontSize, labelSize = 12, color, share, useCustom, children }: {
  center: number;
  size: number;
  value: number;
  label: string;
  currency?: boolean;
  animated?: boolean;
  fontSize: number;
  labelSize?: number;
  color?: string;
  share?: string;
  useCustom?: boolean;
  children?: ReactNode;
}) {
  const format = currency ? currencyFormat : numberFormat;
  return <foreignObject x={center - size / 2} y={center - size / 2} width={size} height={size} pointerEvents="none" aria-hidden={useCustom ? undefined : true}>
    <div className={styles.circularCenter} data-circular-center="">
      {useCustom ? children : <>
        <span className={styles.circularValue} data-circular-value="" style={{ fontSize, color }}>
          {animated ? <NumberFlow value={value} locales="en-US" format={format} respectMotionPreference />
            : value.toLocaleString("en-US", format)}
        </span>
        <span className={styles.circularLabel} style={{ fontSize: labelSize }}>{label}</span>
        {share && <span className={styles.circularLabel} style={{ fontSize: 10 }}>{share}</span>}
      </>}
    </div>
  </foreignObject>;
}
