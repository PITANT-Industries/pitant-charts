import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { ChartExample } from "../../types";
import { Choices } from "../../ui/Choices";
import { candleRows, type CartesianData } from "./data";
import { down, up, type ChartTheme } from "./options";

const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const windows = [{ label: "3 months", value: "92" }, { label: "30 days", value: "30" }, { label: "14 days", value: "14" }];

export function Candles({ example, data, theme, compact }: { example: ChartExample; data: CartesianData; theme: ChartTheme; compact: boolean }) {
  const { id, title } = example;
  const uid = useId();
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 560, height: 300 });
  const [period, setPeriod] = useState(windows[0].value);
  const [active, setActive] = useState<number | null>(null);
  const minimal = id === "candlestick-minimal";
  const patterned = id === "candlestick-pattern";
  const gradient = id === "candlestick-crosshair";
  const customColors = id === "candlestick-colors";
  const ranged = id === "candlestick-range";
  const categories = ranged ? data.categories.slice(-Number(period)) : data.categories;
  const values = candleRows(data).slice(-categories.length || data.categories.length);
  const { width, height } = size;
  const top = 14, bottom = Math.max(top + 20, height - 31);
  const left = minimal ? 14 : 35, right = Math.max(left + 24, width - 15);
  const plotWidth = right - left;
  const step = plotWidth / Math.max(1, values.length);
  const x = (index: number) => left + (index + 0.5) * step;
  const lowest = Math.min(...values.map(row => row[2]));
  const highest = Math.max(...values.map(row => row[3]));
  const padding = Number.isFinite(highest - lowest) ? Math.max(0.8, (highest - lowest) * 0.08) : 1;
  const minimum = Number.isFinite(lowest) ? lowest - padding : 0;
  const maximum = Number.isFinite(highest) ? highest + padding : 1;
  const y = (price: number) => bottom - (price - minimum) / (maximum - minimum) * (bottom - top);
  const positive = customColors ? theme.colors[1] : up;
  const negative = customColors ? theme.colors[4] : down;
  const widthOfBody = customColors ? Math.min(18, step * 0.84) : Math.min(14, step * 0.62);
  const selected = active === null ? undefined : values[active];
  const cursor = active === null || !selected ? null : { x: x(active), y: y(selected[1]), color: selected[1] >= selected[0] ? positive : negative };
  const labelCount = Math.min(values.length, Math.max(2, Math.floor(plotWidth / 82)));
  const labelIndices = new Set(Array.from({ length: labelCount }, (_, index) => Math.round(index * (values.length - 1) / Math.max(1, labelCount - 1))));
  const firstClose = values[0]?.[1];
  const lastClose = values.at(-1)?.[1];
  const change = firstClose && lastClose !== undefined ? (lastClose - firstClose) / firstClose * 100 : 0;
  const rising = values.filter(row => row[1] >= row[0]).length;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.max(1, Math.round(entry.contentRect.width));
      const height = Math.max(1, Math.round(entry.contentRect.height));
      setSize(previous => previous.width === width && previous.height === height ? previous : { width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function move(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const position = event.clientX - rect.left;
    const vertical = event.clientY - rect.top;
    setActive(position < left || position > right || vertical < top || vertical > bottom || !values.length
      ? null : Math.min(values.length - 1, Math.floor((position - left) / step)));
  }

  function key(event: KeyboardEvent<SVGSVGElement>) {
    if (!values.length) return;
    if (event.key === "Escape" && active !== null) {
      event.preventDefault();
      setActive(null);
      return;
    }
    const previous = Math.max(0, (active ?? 0) - 1);
    const next = Math.min(values.length - 1, (active ?? -1) + 1);
    const index = { ArrowLeft: previous, ArrowUp: previous, ArrowRight: next, ArrowDown: next, Home: 0, End: values.length - 1 }[event.key];
    if (index === undefined) return;
    event.preventDefault();
    setActive(index);
  }

  return <div className="cartesian-example">
    {ranged && !compact && <Choices label="Visible range" className="cartesian-controls" options={windows} value={period} onChange={window => { setActive(null); setPeriod(window); }} />}
    <div ref={host} className={`cartesian-plot cartesian-candles${minimal && !compact ? " cartesian-candles--minimal" : ""}`}>
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} role="img" aria-roledescription="chart" aria-label={title}
        tabIndex={compact ? undefined : 0} onPointerMove={move} onPointerDown={move} onPointerLeave={() => setActive(null)} onBlur={() => setActive(null)} onKeyDown={key}>
        <defs>{[positive, negative].map((color, index) => <g key={index}>
          <linearGradient id={`${uid}-candle-gradient-${index}`} x1="0" y1="0" x2="0" y2="1"><stop stopColor={color} /><stop offset="1" stopColor={color} stopOpacity=".3" /></linearGradient>
          <pattern id={`${uid}-candle-pattern-${index}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><path d="M1 0V4" fill="none" stroke={color} strokeWidth="1" /></pattern>
        </g>)}</defs>
        {!minimal && Array.from({ length: 5 }, (_, index) => {
          const price = minimum + (maximum - minimum) * index / 4;
          return <g key={index} data-candle-grid><path d={`M${left} ${y(price)}H${right}`} fill="none" stroke={theme.grid} strokeDasharray="4 5" />
            <text x={left - 7} y={y(price) + 3} textAnchor="end" fill={theme.muted} fontSize="10">{Math.round(price)}</text></g>;
        })}
        {categories.map((label, index) => labelIndices.has(index) && <text key={index} x={x(index)} y={bottom + 19} fill={theme.muted} textAnchor="middle" fontSize="10">{label}</text>)}
        {cursor && !minimal && <path data-candle-crosshair d={`M${cursor.x} ${top}V${bottom}${gradient ? `M${left} ${cursor.y}H${right}` : ""}`} fill="none" stroke={gradient ? cursor.color : theme.muted} strokeDasharray="4 4" />}
        {values.map(([open, close, low, high], index) => {
          const direction = close >= open ? 0 : 1;
          const color = direction ? negative : positive;
          const fill = patterned ? `url(#${uid}-candle-pattern-${direction})` : gradient ? `url(#${uid}-candle-gradient-${direction})` : color;
          return <g key={index} data-candle={direction ? "down" : "up"} data-active={active === index} opacity={active === null || active === index ? 1 : 0.28}>
            <path d={`M${x(index)} ${y(high)}V${y(low)}`} fill="none" stroke={color} strokeWidth="1.5" />
            <rect x={x(index) - widthOfBody / 2} y={y(Math.max(open, close))} width={widthOfBody} height={Math.max(1, Math.abs(y(open) - y(close)))}
              fill={fill} stroke={patterned ? color : undefined} strokeWidth={patterned ? 1 : undefined} rx="1" />
          </g>;
        })}
      </svg>
      {selected && !patterned && cursor && <div className="cl-tooltip cartesian-candle-tooltip" role="status" style={{ left: Math.max(2, Math.min(width - 110, cursor.x + 10)), top: top + 4 }}>
        <div className="cl-tooltip-heading">{categories[active ?? 0]}</div>
        {(minimal ? [["Close", selected[1]]] : [["Open", selected[0]], ["High", selected[3]], ["Low", selected[2]], ["Close", selected[1]]]).map(([label, value]) => <div className="cl-tooltip-row" key={label}><span>{label}</span><strong>{dollars.format(Number(value))}</strong></div>)}
      </div>}
    </div>
    {patterned && !compact && values.length > 0 && <div className="cartesian-status">
      <strong>{change >= 0 ? "Up" : "Down"} {percent.format(Math.abs(change))}% since {categories[0]}</strong><br />{rising} rising and {values.length - rising} falling days, striped bodies on solid wicks
    </div>}
  </div>;
}
