type Paint = "budget" | "hatch" | "line" | "dot" | "check" | "plus" | "down" | "speckle" | "channel-hatch" | "channel-dot" | "wave" | "cross";

export const piePaints: Readonly<Record<string, readonly (Paint | null)[] | undefined>> = {
  "pie-pattern": [null, "budget"],
  "pie-pattern-presets": ["hatch", "line", "dot", "check"],
  "pie-pattern-tile": ["plus", "down", "speckle"],
  "pie-patterns": ["channel-hatch", "channel-dot", "wave", "cross"],
};

const sizes: Partial<Record<Paint, number>> = { budget: 8, check: 8, plus: 12, "channel-dot": 8 };
const strokes: Partial<Record<Paint, { d: string; width: number; square?: boolean }>> = {
  budget: { d: "M0 8L8 0M-2 2L2 -2M6 10L10 6", width: 2, square: true },
  hatch: { d: "M-2 1L1 -2M-1 6L6 -1M4 7L7 4", width: 1 },
  line: { d: "M0 5.5H6M0 -.5H6", width: 1 },
  down: { d: "M-1 -1L7 7M-2 4L2 8M4 -2L8 2", width: 1.25 },
  "channel-hatch": { d: "M0 6L6 0M-1.5 1.5L1.5 -1.5M4.5 7.5L7.5 4.5", width: 1.5, square: true },
  wave: { d: "M0 3c.75 -1.5 2.25 -1.5 3 0s2.25 1.5 3 0M-3 3c.75 1.5 2.25 1.5 3 0M6 3c.75 -1.5 2.25 -1.5 3 0", width: 1.25, square: true },
  cross: { d: "M0 3H6M3 0V6", width: 1, square: true },
};
const fills: Partial<Record<Paint, string>> = {
  check: "M0 0h4v4h-4zM4 4h4v4h-4z",
  plus: "M5.5 3h1v6h-1zM3 5.5h6v1h-6z",
  speckle: "M5 5h1v1h-1zM3 1h1v1h-1zM1 3h1v1h-1z",
};

export function PiePaint({ id, color, paint, tinted }: { id: string; color: string; paint: Paint; tinted?: boolean }) {
  const size = sizes[paint] ?? 6;
  const line = strokes[paint];
  const fill = fills[paint];
  return <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse" data-pie-paint={paint}>
    {tinted && <rect width={size} height={size} fill={color} opacity=".14" />}
    {line && <path d={line.d} fill="none" stroke={color} strokeWidth={line.width} strokeLinecap={line.square ? "square" : undefined} />}
    {fill && <path d={fill} fill={color} />}
    {paint === "dot" && <circle cx="2.5" cy="2.5" r="1.5" fill={color} />}
    {paint === "channel-dot" && [[4, 4], [0, 0], [0, 8], [8, 0], [8, 8]].map(([x, y]) =>
      <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill={color} />)}
  </pattern>;
}
