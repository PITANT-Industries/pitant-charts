type PatternType = "hatch" | "line" | "dot" | "check" | "plus" | "down" | "speckle" | "wave" | "cross";

export const piePatterns: Record<string, readonly (PatternType | null)[] | undefined> = {
  "pie-pattern": [null, "hatch"],
  "pie-pattern-presets": ["hatch", "line", "dot", "check"],
  "pie-pattern-tile": ["plus", "down", "speckle"],
  "pie-patterns": ["hatch", "dot", "wave", "cross"],
};

export function PiePattern({ id, color, type, tinted }: { id: string; color: string; type: PatternType; tinted?: boolean }) {
  const width = type === "plus" ? 12 : type === "check" ? 8 : 6;
  return <pattern id={id} data-pattern-kind={type} width={width} height={width} patternUnits="userSpaceOnUse">
    {tinted && <rect width={width} height={width} fill={color} opacity=".14" />}
    {type === "hatch" && <path d="M-1 1L1 -1 M0 6L6 0 M5 7L7 5" stroke={color} strokeWidth="1.4" />}
    {type === "line" && <path d="M0 3H6" stroke={color} strokeWidth="1.25" />}
    {type === "dot" && <circle cx="3" cy="3" r="1.3" fill={color} />}
    {type === "check" && <path d="M0 0H4V4H0Z M4 4H8V8H4Z" fill={color} />}
    {type === "plus" && <path d="M6 3V9 M3 6H9" stroke={color} />}
    {type === "down" && <path d="M-1 -1L7 7 M-1 5L1 7 M5 -1L7 1" stroke={color} strokeWidth="1.25" />}
    {type === "speckle" && <path d="M5 5h1v1h-1z M3 1h1v1h-1z M1 3h1v1h-1z" fill={color} />}
    {type === "wave" && <path d="M0 3Q1.5 0 3 3T6 3" fill="none" stroke={color} />}
    {type === "cross" && <path d="M3 0V6 M0 3H6" stroke={color} />}
  </pattern>;
}
