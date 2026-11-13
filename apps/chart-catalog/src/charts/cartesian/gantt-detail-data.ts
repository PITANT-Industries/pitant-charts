export type ScheduleRow = {
  name: string;
  start: number;
  end: number;
  progress: number;
  dependencies: number[];
  taskCount?: number;
  team?: string;
  owner?: string;
};

type Schedule = {
  origin: number;
  minimum: number;
  maximum: number;
  minimumWidth: number;
  labelWidth: number;
  rowHeight: number;
  rowTop: number;
  radius: number;
  ticks: number[];
  today?: number;
  footer: [string, string];
  rows: ScheduleRow[];
};

function task(name: string, start: number, end: number, progress: number, dependencies: number[] = []): ScheduleRow {
  return { name, start, end, progress, dependencies };
}

function phase(name: string, start: number, end: number, progress: number, taskCount: number): ScheduleRow {
  return { ...task(name, start, end, progress), taskCount };
}

const weekTicks = (count: number) => Array.from({ length: count }, (_, index) => index * 7);
// Schedule dates are local midnights in Berlin. Keep the hour change in the timeline scale.
const hour = 1 / 24;
const berlinMarch = (day: number) => day >= 29 ? day - hour : day;
const berlinAutumn = (day: number) => day >= 116 ? day + hour : day;
const checkout = (name: string, start: number, end: number, progress: number, dependencies: number[] = []) =>
  task(name, berlinMarch(start), berlinMarch(end), progress, dependencies);
const initiative = (name: string, start: number, end: number, progress: number, team: string, owner: string, dependencies: number[] = []) =>
  ({ ...task(name, berlinAutumn(start), berlinAutumn(end), progress, dependencies), team, owner });

export const schedules = {
  "gantt-default": {
    origin: Date.UTC(2026, 2, 1), minimum: -.39916666666667, maximum: 72.3575, minimumWidth: 560,
    labelWidth: 160, rowHeight: 36, rowTop: 36, radius: 6,
    ticks: weekTicks(11).map(berlinMarch), today: berlinMarch(44),
    footer: ["On track for a May 11 launch", "Bars fill with each task's progress; arrows show what waits on what"],
    rows: [
      phase("Discovery", 1, 19, 100, 2),
      checkout("User research", 1, 12, 100),
      checkout("Scope and pricing", 15, 19, 100, [1]),
      phase("Design", 22, berlinMarch(40), 90, 2),
      checkout("Checkout flows", 22, 33, 100, [2]),
      checkout("Visual design", 29, 40, 80, [4]),
      phase("Build", 24, berlinMarch(71), 32, 4),
      checkout("Payments API", 24, 47, 55, [2]),
      checkout("Web checkout", 38, 60, 20, [5]),
      checkout("QA and load tests", 61, 68, 0, [7, 8]),
      checkout("Launch", 71, 71, 0, [9]),
    ],
  },
  "gantt-roadmap": {
    origin: Date.UTC(2026, 6, 2), minimum: .97916666666667, maximum: 158.0625, minimumWidth: 720,
    labelWidth: 174, rowHeight: 34, rowTop: 36, radius: 4,
    ticks: [30, 61, 91, 122, 152].map(berlinAutumn), today: 63,
    footer: ["Nine initiatives across three teams", "Scroll sideways on small screens to see the whole half"],
    rows: [
      initiative("SAML single sign-on", 4, 43, 90, "Platform", "Priya Nair"),
      initiative("Audit log export", 46, 85, 35, "Platform", "Priya Nair", [0]),
      initiative("EU data residency", 67, 141, 10, "Platform", "Marco Bianchi"),
      initiative("Guided onboarding", 11, 57, 75, "Growth", "Sofia Alvarez"),
      initiative("Reverse trials", 61, 99, 20, "Growth", "Sofia Alvarez", [3]),
      initiative("Usage-based pricing", 102, 155, 0, "Growth", "Daniel Okafor", [4]),
      initiative("Offline mode", 18, 71, 60, "Mobile", "Hana Sato"),
      initiative("Home screen widgets", 81, 127, 5, "Mobile", "Hana Sato", [6, 0]),
      initiative("App Store feature", 137, 137, 0, "Mobile", "Hana Sato", [7]),
    ],
  },
  "gantt-milestones": {
    origin: Date.UTC(2026, 8, 6), minimum: 0, maximum: 44, minimumWidth: 0,
    labelWidth: 160, rowHeight: 40, rowTop: 12, radius: 3,
    ticks: weekTicks(7),
    footer: ["General availability on October 19", "Six weeks from feature freeze to launch"],
    rows: [
      task("Feature freeze", 1, 12, 100),
      task("Public beta", 15, 15, 100, [0]),
      task("Bug bash", 16, 26, 100, [1]),
      task("Release candidate", 29, 33, 100, [2]),
      task("Docs and changelog", 31, 40, 100, [3]),
      task("General availability", 43, 43, 100, [3, 4]),
    ],
  },
  "gantt-loading": {
    origin: Date.UTC(2026, 4, 31), minimum: -.44, maximum: 74.44, minimumWidth: 560,
    labelWidth: 180, rowHeight: 36, rowTop: 36, radius: 6,
    ticks: weekTicks(11), today: 45,
    footer: ["Launch on track for August 12", "Turn loading off to play the rows in"],
    rows: [
      phase("Discovery", 1, 24, 100, 2),
      task("Content audit", 1, 12, 100),
      task("Sitemap and wireframes", 15, 24, 100, [1]),
      phase("Build", 22, 73, 45, 4),
      task("Design system", 22, 40, 80, [2]),
      task("Marketing pages", 38, 61, 40, [4]),
      task("CMS migration", 43, 68, 25, [2]),
      task("Launch", 73, 73, 0, [5, 6]),
    ],
  },
} satisfies Record<string, Schedule>;

export type ScheduleVariant = keyof typeof schedules;

export const scheduleSkeleton = [
  { x: .09519, width: .31777, label: 67.77 },
  { x: .09519, width: .31777, label: 106.5 },
  { x: .23441, width: .16635, label: 88.81 },
  { x: .36317, width: .47613, label: 85.32 },
  { x: .36317, width: .29823, label: 111.05 },
  { x: .51275, width: .19302, label: 106.89 },
  { x: .53496, width: .29672, label: 60.81 },
  { x: 0, width: 0, label: 85.62 },
];

type Point = [number, number];

export function dependencyPath(from: Point, to: Point, rowHeight: number) {
  const [x, y] = from;
  const [endX, endY] = to;
  const elbow = x + 8;
  const approach = endX - 7;
  const middle = endY - rowHeight / 2;
  const vertices: Point[] = approach >= elbow
    ? [from, [elbow, y], [elbow, endY], to]
    : [from, [elbow, y], [elbow, middle], [approach, middle], [approach, endY], to];
  const toward = (start: Point, end: Point, distance: number) => {
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    return length ? [start[0] + (end[0] - start[0]) * distance / length, start[1] + (end[1] - start[1]) * distance / length] : start;
  };
  const corners = vertices.slice(1, -1).map((point, index) => {
    const before = vertices[index], after = vertices[index + 2];
    const radius = Math.min(4, Math.hypot(before[0] - point[0], before[1] - point[1]) / 2,
      Math.hypot(after[0] - point[0], after[1] - point[1]) / 2);
    return `L${toward(point, before, radius)}Q${point} ${toward(point, after, radius)}`;
  });
  return `M${from}${corners.join("")}L${to}M${endX - 4.5},${endY - 4.5}L${to}L${endX - 4.5},${endY + 4.5}`;
}
