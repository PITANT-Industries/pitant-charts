// Adapted from Bklit UI (https://bklit.com/r/gauge-chart.json). See LICENSE.bklit.md.

export interface NotchPoint {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x3: number;
  y3: number;
  x4: number;
  y4: number;
}

export function createNotchPath(
  points: NotchPoint,
  cornerRadiusPx: number,
  verticalDepth: number
): string {
  const { x1, y1, x2, y2, x3, y3, x4, y4 } = points;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const dist = (ax: number, ay: number, bx: number, by: number) =>
    Math.hypot(bx - ax, by - ay);

  const d12 = dist(x1, y1, x2, y2);
  const d23 = dist(x2, y2, x3, y3);
  const d34 = dist(x3, y3, x4, y4);
  const d41 = dist(x4, y4, x1, y1);

  if (cornerRadiusPx <= 0) {
    return `M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} L ${x4} ${y4} Z`;
  }

  const minEdge = Math.min(d12, d23, d34, d41);
  const cr = Math.min(
    cornerRadiusPx,
    verticalDepth * 0.48,
    d12 * 0.49,
    d23 * 0.49,
    d34 * 0.49,
    d41 * 0.49,
    minEdge * 0.49
  );

  const r1 = Math.min(cr / d12, 0.49);
  const r2 = Math.min(cr / d23, 0.49);
  const r3 = Math.min(cr / d34, 0.49);
  const r4 = Math.min(cr / d41, 0.49);

  const p1a = { x: lerp(x1, x4, r4), y: lerp(y1, y4, r4) };
  const p1b = { x: lerp(x1, x2, r1), y: lerp(y1, y2, r1) };
  const p2a = { x: lerp(x2, x1, r1), y: lerp(y2, y1, r1) };
  const p2b = { x: lerp(x2, x3, r2), y: lerp(y2, y3, r2) };
  const p3a = { x: lerp(x3, x2, r2), y: lerp(y3, y2, r2) };
  const p3b = { x: lerp(x3, x4, r3), y: lerp(y3, y4, r3) };
  const p4a = { x: lerp(x4, x3, r3), y: lerp(y4, y3, r3) };
  const p4b = { x: lerp(x4, x1, r4), y: lerp(y4, y1, r4) };

  return `M ${p1a.x} ${p1a.y} Q ${x1} ${y1} ${p1b.x} ${p1b.y} L ${p2a.x} ${p2a.y} Q ${x2} ${y2} ${p2b.x} ${p2b.y} L ${p3a.x} ${p3a.y} Q ${x3} ${y3} ${p3b.x} ${p3b.y} L ${p4a.x} ${p4a.y} Q ${x4} ${y4} ${p4b.x} ${p4b.y} Z`;
}

