import type { ChartData, ChartExample, ChartSeries } from "../../types";

export interface CartesianData {
  categories: string[];
  series: ChartSeries[];
  rows?: ChartData["rows"];
}

export const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const channels = ["Desktop", "Mobile", "Tablet", "Referral", "Organic", "Direct"];
const services = ["API", "Search", "Billing", "Auth", "Queue", "Media"];
const regions = ["North", "West", "Central", "East", "South", "International"];

export function dates(count: number, start = Date.UTC(2026, 0, 5)) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start + index * 86_400_000);
    return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`;
  });
}

export function curve(count: number, seed: number, base: number, amplitude: number, drift = 0) {
  return Array.from({ length: count }, (_, index) => Math.round(
    base + Math.sin(index * 0.54 + seed) * amplitude * 0.51
      + Math.cos(index * 1.43 + seed * 3) * amplitude * 0.34
      + Math.sin(index * 2.63 - seed) * amplitude * 0.15 + drift * index,
  ));
}

export const initialLargeCount = 50_000;

export function minuteLatency(count: number): CartesianData {
  const start = Date.UTC(2026, 6, 1);
  const format = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
  const p50: number[] = [], p95: number[] = [];
  const categories = Array.from({ length: count }, (_, index) => {
    const daily = Math.sin(index / 1440 * Math.PI * 2);
    const noise = ((Math.imul(index + 523, 0x45d9f3b) >>> 14) % 101) / 100;
    const spike = noise > 0.988 && index % 17 === 0 ? 110 + index % 77 : 0;
    p50.push(Math.round(28 + daily * 8 + noise * 4));
    p95.push(Math.round(97 + daily * 23 + noise * 26 + spike));
    return format.format(start + index * 60_000);
  });
  return { categories, series: [{ name: "p50 latency", values: p50 }, { name: "p95 latency", values: p95 }] };
}

function points(count: number, names: string[], base = 58) {
  return names.map((name, index) => ({
    name,
    values: curve(count, index * 2, base - index * 7, 19 - Math.min(index, 4), index === 0 ? 0.67 : 0.38),
  }));
}

export function resolveData(example: ChartExample, data?: ChartData): CartesianData {
  const fixture = makeFixture(example);
  if (!data) return fixture;
  const series = data.series ? [...data.series] : fixture.series;
  const count = Math.max(0, ...series.map(item => item.values.length));
  const categories = data.categories ? [...data.categories] : data.series && !data.rows
    ? Array.from({ length: count }, (_, index) => String(index + 1))
    : fixture.categories;
  return { categories, series, rows: data.rows ?? fixture.rows };
}

function makeFixture(example: ChartExample): CartesianData {
  const { family, id } = example;
  if (family === "line") {
    if (id === "line-large-data") return minuteLatency(initialLargeCount);
    if (["line-brush", "line-linked-brush", "line-date-highlights-brush"].includes(id)) {
      const categories = dates(90, Date.UTC(2026, 6, 1));
      const visitors = curve(90, 3, 2410, 490, 12).map((value, index) => (index + 3) % 7 >= 5 ? Math.round(value * 0.7) : value);
      const series = [{ name: "Visitors", values: visitors }];
      if (id === "line-linked-brush") series.push({ name: "Signups", values: visitors.map((value, index) => Math.round(value * (0.032 + Math.sin(index) * 0.004))) });
      return { categories, series };
    }
    if (id === "line-synced") {
      const count = 45;
      const spike = (position: number) => Math.exp(-0.4 * (position - 31) ** 2);
      return { categories: dates(count, Date.UTC(2026, 8, 1)), series: [
        { name: "Requests per minute", values: curve(count, 1, 1200, 460, 1) },
        { name: "p95 latency", values: curve(count, 0, 175, 34, 0.2).map((value, index) => Math.round(value + spike(index) * 240)) },
        { name: "Error rate", values: curve(count, 2, 22, 11).map((value, index) => value / 100 + spike(index) * 1.5) },
      ] };
    }
    if (id === "line-band-range") return { categories: dates(30, Date.UTC(2026, 5, 1)), series: [{ name: "Temperature (°C)", values: curve(30, 3, 20, 4, 0.11) }] };
    const count = id === "line-zoom" ? 365 : id === "line-time-range" ? 90 : 30;
    const categories = dates(count, id === "line-zoom" ? Date.UTC(2026, 0, 1) : undefined);
    const one = ["line-grid", "line-points", "line-dashed", "line-segment", "line-markers", "line-glow", "line-fixed-scale", "line-trend"];
    let series = points(count, one.includes(id) ? ["Sessions"]
      : ["line-legend", "line-weekends", "line-export"].includes(id) ? channels.slice(0, 3) : channels.slice(0, 2));
    if (id.includes("profit-loss")) series = [{ name: "Net profit", values: curve(count, 3, -8, 36, 0.71) }];
    if (id === "line-dual-axis") series = [
      { name: "Revenue", values: curve(count, 3, 4900, 1400, 81) },
      { name: "Conversion", values: curve(count, 2, 44, 13, 0.21).map(value => value / 10) },
    ];
    if (id === "line-threshold") series = points(count, ["P95 latency", "Median latency"]);
    return { categories, series };
  }
  if (family === "area" || family === "composed") {
    const count = family === "area" ? 30 : 24;
    const categories = id === "area-custom-labels" ? Array.from({ length: 12 }, (_, index) => `Sprint ${index + 1}`)
      : ["area-forecast", "area-trend"].includes(id) ? months.slice(0, 10) : dates(count);
    let series = points(categories.length, id === "area-small-multiples" ? regions : family === "composed" ? ["Revenue", "Orders", "Target"] : ["Revenue", "Costs"]);
    if (["area-fill", "area-gradient-fill", "area-pattern", "area-steps", "area-reference-band", "area-pattern-fade", "area-fade-bottom", "area-selection", "area-trend"].includes(id)) series = series.slice(0, 1);
    if (id === "area-reference-band") series = [{ name: "Signups", values: curve(categories.length, 2, 187, 38, 2) }];
    if (id === "area-dual-axis") series = [{ name: "Sessions", values: curve(count, 1, 870, 160, 17) }, { name: "Conversion", values: curve(count, 4, 42, 12, 0.18).map(value => value / 10) }];
    if (id === "area-steps") series = [{ name: "Pages", values: [4,4,4,7,7,9,9,9,5,5,4,4,4,2,2,6,6,6,8,8,8,7,7,5,5,5,9,9,6,6] }];
    if (id === "composed-profit-loss") series = [{ name: "Net profit", values: curve(count, 2, -5, 32, 0.5) }, series[1]];
    return { categories, series };
  }
  if (family === "live-line") {
    const categories = Array.from({ length: 30 }, (_, index) => `10:${String(index).padStart(2, "0")}`);
    const values = curve(categories.length, 4, 1430, 18, 0.11).map(value => value / 10);
    return { categories, series: [{ name: id === "live-line-right-axis" ? "P95 latency" : "Index", values }] };
  }
  if (family === "sparkline") {
    const count = id === "sparkline-range" ? 90 : id === "sparkline-stat-card" ? 7 : 24;
    const names = id === "sparkline-grid" ? Array.from({ length: 48 }, (_, index) => `${services[index % services.length]} ${Math.floor(index / services.length) + 1}`)
      : ["sparkline-default", "sparkline-synced", "sparkline-table", "sparkline-crosshairs", "sparkline-hover-feel"].includes(id)
        ? ["Revenue", "Sessions", "Orders"] : ["Sessions"];
    const series = names.length > 6 ? names.map((name, index) => ({ name, values: curve(count, index, 50 + index % 13, 21, 0.35) })) : points(count, names);
    if (id === "sparkline-bar-negative") series[0] = { name: "Profit and loss", values: curve(count, 2, -4, 29, 0.5) };
    return { categories: dates(count), series };
  }
  if (family === "bar") {
    const categories = id === "bar-sources" ? ["Organic search", "Social media", "Direct", "Paid search", "Referral", "Email"] : months;
    const count = ["bar-stacked"].includes(id) ? 3 : ["bar-grouped", "bar-squares-legend", "bar-synced"].includes(id) ? 2 : 1;
    const series = points(categories.length, channels.slice(0, count));
    if (id === "bar-profit-loss") series[0] = { name: "Net profit", values: [25, 43, -13, 37, -24, 21, 62, -34, 48, 58, -16, 67] };
    return { categories, series };
  }
  if (family === "candlestick") {
    const count = id === "candlestick-range" ? 90 : 30;
    const categories = dates(count);
    const prices = curve(count, 2, 99, 11, 0.48);
    const rows = prices.map((value, index) => {
      const open = index ? prices[index - 1] : value - 2;
      return { open, close: value, low: Math.min(open, value) - 2 - index % 3, high: Math.max(open, value) + 3 + index % 4, volume: 25 + (index * 7) % 31 };
    });
    return { categories, series: [], rows };
  }
  if (family === "stream") {
    const categories = [...months.slice(0, 6).map(month => `${month} 2025`), ...months.slice(0, 6).map(month => `${month} 2026`)];
    return { categories, series: points(categories.length, ["Ambient", "Jazz", "Rock", "Electronic", "Classical"], 47) };
  }
  if (family === "diverging") {
    return {
      categories: ["Navigation is clear", "Search is helpful", "Editing is intuitive", "Reporting meets my needs"],
      series: [
        { name: "Strongly disagree", values: [12, 8, 12, 9] },
        { name: "Disagree", values: [14, 16, 12, 22] },
        ...(id === "diverging-legend" ? [] : [{ name: "Neutral", values: [18, 12, 28, 10] }]),
        { name: "Agree", values: [37, 40, 35, 37] },
        { name: "Strongly agree", values: [19, 24, 13, 22] },
      ],
    };
  }
  if (family === "lollipop") {
    const categories = id === "lollipop-horizontal" ? ["Search", "Segments", "Saved filters", "Exports", "Automation"]
      : id === "lollipop-change" ? ["Organic", "Paid", "Social", "Direct", "Referral"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    return { categories, series: [{ name: "Value", values: id === "lollipop-change" ? [14, -8, 24, -15, 7]
      : id === "lollipop-horizontal" ? [85, 72, 61, 48, 28] : [24, 35, 42, 31, 55, 46, 37] }] };
  }
  if (family === "dumbbell") {
    return { categories: id === "dumbbell-vertical" ? ["Starter", "Growth", "Team", "Enterprise"] : regions.slice(0, 5),
      series: id === "dumbbell-vertical"
        ? [{ name: "Monthly", values: [28, 47, 73, 110] }, { name: "Annual", values: [19, 38, 58, 90] }]
        : [{ name: "Before", values: [54, 71, 47, 84, 61] }, { name: "After", values: [31, 35, 38, 51, 32] }] };
  }
  if (family === "bump") {
    return { categories: ["2021", "2022", "2023", "2024", "2025", "2026"], series: [
      { name: "TypeScript", values: [28, 33, 38, 48, 63, 67] },
      { name: "Python", values: [41, 43, 46, 50, 54, 58] },
      { name: "Go", values: [17, 27, 35, 49, 55, 62] },
      { name: "JavaScript", values: [53, 47, 40, 38, 37, 32] },
      { name: "Rust", values: [13, 21, 29, 33, 39, 52] },
    ] };
  }
  if (family === "slope") {
    return { categories: id === "slope-response-time" ? ["Before", "After"] : ["2025", "2026"], series: [
      { name: "Germany", values: [78, 88] }, { name: "France", values: [67, 61] },
      { name: "UK", values: [83, 80] }, { name: "Canada", values: [63, 76] }, { name: "Sweden", values: [57, 70] },
    ] };
  }
  if (family === "waterfall") {
    if (id === "waterfall-subtotals") return {
      categories: ["Revenue", "Cost of sales", "Gross profit", "Operating costs", "Operating income", "Taxes", "Net income"],
      series: [{ name: "Change", values: [110, -39, 71, -28, 43, -11, 32] }],
      rows: [{ total: true }, {}, { total: true }, {}, { total: true }, {}, { total: true }],
    };
    if (id === "waterfall-cash-flow") return {
      categories: [...months.slice(0, 6), "Total"], series: [{ name: "Net cash flow", values: [38, 24, -18, 49, -16, 27, 104] }],
      rows: [{}, {}, {}, {}, {}, {}, { total: true }],
    };
    return { categories: ["FY 2025", "New", "Expansion", "Churn", "Contraction", "FY 2026"],
      series: [{ name: "ARR", values: [72, 28, 19, -13, -8, 98] }], rows: [{ total: true }, {}, {}, {}, {}, { total: true }] };
  }
  if (family === "gantt") {
    const categories = id === "gantt-roadmap" ? ["Research", "Design", "Platform", "Integrations", "Launch"]
      : ["Discovery", "UX design", "Implementation", "QA", "Rollout"];
    return { categories, series: [], rows: [
      { start: 0, end: 5, progress: 1, owner: "Product" },
      { start: 4, end: 10, progress: 0.85, owner: "Design", dependsOn: 0 },
      { start: 8, end: 17, progress: 0.48, owner: "Engineering", dependsOn: 1 },
      { start: 15, end: 20, progress: 0.15, owner: "QA", dependsOn: 2 },
      { start: 20, end: 22, progress: 0, owner: "Product", dependsOn: 3 },
    ] };
  }
  return { categories: months, series: points(months.length, ["Value"]) };
}
