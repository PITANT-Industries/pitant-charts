import { useId, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Choices } from "../../ui/Choices";
import type { ChartExample, ChartSeries } from "../../types";
import type { CartesianData } from "./data";
import { colorFor, down, tint, up, valueFormat, type ChartTheme } from "./options";

const ranges = [7, 30, 90].map(day => ({ value: String(day), label: `${day} days` }));

interface SparkProps {
  item: ChartSeries;
  color: string;
  kind: "line" | "area" | "bar" | "step";
  crosshair?: "dashed" | "solid" | "gradient";
  motion?: "normal" | "stiff" | "none";
  solid?: boolean;
  staticEnd?: boolean;
  signed?: boolean;
  active: number | null;
  categories: string[];
  onActive: (index: number | null) => void;
}

function Spark({ item, color, kind, crosshair, motion = "normal", solid, staticEnd, signed, active, categories, onActive }: SparkProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const width = 216, height = 76, pad = 5;
  const values = item.values;
  const numbers = values.filter((value): value is number => value !== null);
  const min = numbers.length ? Math.min(...numbers, ...(signed ? [0] : [])) : 0;
  const max = numbers.length ? Math.max(...numbers, ...(signed ? [0] : [])) : 1;
  const baseline = signed ? 0 : min;
  const range = max - min || 1;
  const xAt = (index: number) => pad + index / Math.max(values.length - 1, 1) * (width - pad * 2);
  const yAt = (value: number) => height - pad - (value - min) / range * (height - pad * 2);
  const point = active === null ? undefined : values[active];
  const line = values.map((value, index) => {
    if (value === null) return "";
    const x = xAt(index), y = yAt(value);
    return index === 0 || values[index - 1] === null ? `M${x},${y}` : kind === "step" ? `H${x}V${y}` : `L${x},${y}`;
  }).join(" ");
  const area = values.reduce<{ paths: string[]; start: number | null; previous: number | null }>((state, value, index) => {
    if (value === null) return { ...state, start: null, previous: null };
    const x = xAt(index), y = yAt(value);
    const starts = state.start === null;
    if (starts) {
      state.start = index;
      state.paths.push(`M${x},${yAt(baseline)}L${x},${y}`);
    } else {
      state.paths[state.paths.length - 1] += kind === "step" ? `H${x}V${y}` : `L${x},${y}`;
    }
    if (index === values.length - 1 || values[index + 1] === null) state.paths[state.paths.length - 1] += `L${x},${yAt(baseline)}Z`;
    state.previous = value;
    return state;
  }, { paths: [], start: null, previous: null }).paths.join(" ");
  const current = values.at(-1);
  const dotIndex = staticEnd ? values.length - 1 : active;
  const dotValue = dotIndex === null ? null : values[dotIndex];
  const setPointer = (event: PointerEvent<SVGSVGElement>) => {
    if (staticEnd || !values.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const fraction = (event.clientX - rect.left) / Math.max(1, rect.width);
    onActive(Math.min(values.length - 1, Math.max(0, Math.round(fraction * (values.length - 1)))));
  };
  const setKeyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    if (staticEnd || !values.length || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? values.length - 1 : (active ?? 0) + (event.key === "ArrowRight" ? 1 : -1);
    onActive(Math.min(values.length - 1, Math.max(0, next)));
  };
  const barWidth = Math.max(1.5, (width - 2 * pad) / Math.max(1, values.length) * 0.65);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" tabIndex={staticEnd ? undefined : 0}
      aria-label={`${item.name}, ${typeof point === "number" ? `${categories[active ?? 0]} ${valueFormat.format(point)}` : `latest ${current ?? "unavailable"}`}`}
      className={`cartesian-spark cartesian-spark--${motion}`}
      onPointerMove={setPointer} onPointerLeave={() => onActive(null)} onKeyDown={setKeyboard} onBlur={() => onActive(null)}>
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor={color} stopOpacity={0.42} /><stop offset="100%" stopColor={color} stopOpacity={0.025} />
        </linearGradient>
        <linearGradient id={`${id}-crosshair`} x1="0" x2="0" y1="0" y2="1">
          <stop stopColor={color} stopOpacity={0} /><stop offset="50%" stopColor={color} stopOpacity={0.9} /><stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {kind === "bar" ? values.map((value, index) => value === null ? null : (
        <rect key={index} x={xAt(index) - barWidth / 2} y={Math.min(yAt(value), yAt(baseline))}
          width={barWidth} height={Math.max(2, Math.abs(yAt(value) - yAt(baseline)))} rx={Math.min(3, barWidth / 3)}
          fill={signed ? value >= 0 ? up : down : color} opacity={active === null || active === index ? 1 : 0.26} />
      )) : <>
        {(kind === "area" || kind === "step") && <path d={area} fill={solid ? tint(color, 0.27) : `url(#${id}-fill)`} />}
        <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
          vectorEffect="non-scaling-stroke" opacity={active !== null && kind === "line" ? 0.32 : 1} />
        {active !== null && kind === "line" && values.map((value, index) => {
          if (value === null || index < Math.max(0, active - 1) || index > active || values[index + 1] == null) return null;
          return <path key={index} d={`M${xAt(index)},${yAt(value)}L${xAt(index + 1)},${yAt(values[index + 1]!)}`}
            fill="none" stroke={color} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />;
        })}
      </>}
      {active !== null && kind !== "bar" && crosshair && (
        <line x1={xAt(active)} x2={xAt(active)} y1={0} y2={height} stroke={crosshair === "gradient" ? `url(#${id}-crosshair)` : tint(color, 0.55)}
          strokeDasharray={crosshair === "dashed" ? "4 3" : undefined} vectorEffect="non-scaling-stroke" />
      )}
      {kind !== "bar" && dotIndex !== null && typeof dotValue === "number" && (
        <circle cx={xAt(dotIndex)} cy={yAt(dotValue)} r={3.6} fill={color} stroke="var(--background)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}

export function SparklineExamples({ example, data, theme, compact }: { example: ChartExample; data: CartesianData; theme: ChartTheme; compact: boolean }) {
  const [indices, setIndices] = useState<Record<number, number | null>>({});
  const [range, setRange] = useState(30);
  const { id } = example;
  const table = id === "sparkline-table";
  const tiles = ["sparkline-default", "sparkline-stat-card", "sparkline-synced"].includes(id);
  const shared = id === "sparkline-synced";
  const matrix = id === "sparkline-grid";
  const rangeControl = id === "sparkline-range";
  const source = compact && matrix ? data.series.slice(0, 12) : data.series;
  const kinds = ["line", "area", "bar"] as const;
  return (
    <div className="cartesian-spark-layout">
      {rangeControl && !compact && <div className="cartesian-controls" aria-label="Time range">
        <Choices label="Time range" className="cartesian-choice-group" options={ranges} value={String(range)} onChange={day => { setRange(Number(day)); setIndices({}); }} />
      </div>}
      <div className={`cartesian-sparks ${matrix ? "cartesian-sparks--matrix" : table ? "cartesian-sparks--table" : ""} ${source.length === 1 ? "cartesian-sparks--single" : ""}`}>
        {source.map((item, index) => {
          const visible = rangeControl ? { ...item, values: item.values.slice(-range) } : item;
          const selected = indices[shared ? 0 : index] ?? null;
          const current = selected === null ? visible.values.at(-1) : visible.values[selected];
          const previous = selected === null ? visible.values.at(-2) : visible.values[selected - 1];
          const delta = typeof previous === "number" && typeof current === "number" && previous !== 0 ? ((current - previous) / Math.abs(previous) * 100) : null;
          const kind = matrix ? kinds[index % 3] : id.includes("-bar") || id === "sparkline-hover-feel" && index === 1 ? "bar"
            : id === "sparkline-step" ? "step" : id.includes("-area") || id === "sparkline-stat-card" ? "area" : "line";
          const crosshairs = ["dashed", "solid", "gradient"] as const;
          const motion = ["normal", "stiff", "none"] as const;
          const color = table ? typeof delta === "number" && delta < 0 ? down : up : colorFor(item, index, theme);
          return (
            <div className="cartesian-spark-item" key={index}>
              {(tiles || table || matrix || source.length > 1 || id === "sparkline-end-dot") && <div className="cartesian-spark-caption">
                <span>{id === "sparkline-crosshairs" ? ["Dashed", "Solid", "Gradient"][index] : id === "sparkline-hover-feel" ? ["Spring", "Stiff spring", "Immediate"][index] : item.name}</span>
                {(tiles || table || id === "sparkline-end-dot") && <strong>{typeof current === "number" ? valueFormat.format(current) : "–"}</strong>}
                {tiles && !compact && delta !== null && <small style={{ color: delta >= 0 ? up : down }}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}%</small>}
              </div>}
              <Spark item={visible} color={color} kind={kind} solid={id === "sparkline-area-solid"} signed={id === "sparkline-bar-negative"}
                staticEnd={id === "sparkline-end-dot"} crosshair={id === "sparkline-crosshairs" ? crosshairs[index % 3] : "dashed"}
                motion={id === "sparkline-hover-feel" ? motion[index % 3] : "normal"} active={selected}
                categories={rangeControl ? data.categories.slice(-range) : data.categories}
                onActive={value => setIndices(current => ({ ...current, [shared ? 0 : index]: value }))} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
