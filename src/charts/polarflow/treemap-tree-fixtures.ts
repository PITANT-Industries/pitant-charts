import { numeric } from "./shared";
import type { SunburstNode } from "./upstream/sunburst-data";

const leaves = (items: readonly [string, number][]): SunburstNode[] => items.map(([name, value]) => ({ name, value }));
const branch = (name: string, children: SunburstNode[]): SunburstNode => ({ name, children });
const group = (name: string, children: readonly [string, number][]) => branch(name, leaves(children));

export const treemapFixtures: Record<string, SunburstNode> = {
  "treemap-default": branch("All teams", [
    group("Platform", [["Compute", 48000], ["Database", 21000], ["Cache", 6900], ["Queues", 3100]]),
    group("Machine Learning", [["Training", 40000], ["Inference", 28000], ["Storage", 8200]]),
    group("Data", [["Warehouse", 19000], ["Pipelines", 9700], ["Dashboards", 2800]]),
    group("Web", [["CDN", 12300], ["Edge Functions", 5600], ["Images", 3300]]),
    group("Observability", [["Logs", 7400], ["Metrics", 4900], ["Traces", 2600]]),
  ]),
  "treemap-drilldown": branch("dist", [
    branch("node_modules", [group("@tanstack", [["charts", 64], ["router", 41], ["query", 38]]), group("react-dom", [["client", 118], ["shared", 9]]), group("date-fns", [["locale", 22], ["format", 12], ["parse", 8]]), { name: "zod", value: 54 }]),
    group("src", [["routes", 88], ["components", 83], ["lib", 23]]),
    group("assets", [["fonts", 72], ["images", 41], ["icons", 28]]),
  ]),
  "treemap-portfolio": branch("Portfolio", [
    group("US Equities", [["Total Market ETF", 184000], ["S&P 500 ETF", 126000], ["Tech Growth", 58000], ["Dividend Fund", 41000]]),
    group("Fixed Income", [["Treasury Bonds", 72000], ["Corporate Bonds", 46000], ["TIPS", 21000]]),
    group("International", [["Developed Markets", 88000], ["Emerging Markets", 37000]]),
    group("Alternatives", [["REIT Index", 33000], ["Gold", 19000]]),
    group("Cash", [["Money Market", 25000]]),
  ]),
  "treemap-loading": branch("Object storage", [
    group("Media", [["Uploads", 1820], ["Thumbnails", 620], ["Exports", 310]]),
    group("Backups", [["Nightly", 1300], ["Weekly", 540]]),
    group("Logs", [["App logs", 690], ["Audit", 280], ["Access", 190]]),
    group("ML", [["Models", 480], ["Datasets", 360]]),
  ]),
};

export const treeFixtures: Record<string, SunburstNode> = {
  "tree-default": branch("Engineering", [
    group("Platform", [["API", 9], ["Infrastructure", 12], ["Data Platform", 8]]),
    group("Product", [["Web", 14], ["iOS", 6], ["Android", 6], ["Design Systems", 4]]),
    group("Intelligence", [["Applied ML", 7], ["Search", 5]]),
    group("Trust", [["Security", 6], ["Reliability", 8]]),
  ]),
  "tree-radial": branch("UI kit", [
    group("Forms", [["Button", 182], ["Input", 141], ["Select", 96], ["Checkbox", 74], ["Switch", 58], ["Slider", 31]]),
    group("Overlays", [["Dialog", 128], ["Popover", 87], ["Tooltip", 112], ["Sheet", 49], ["Menu", 76]]),
    group("Navigation", [["Tabs", 93], ["Breadcrumb", 38], ["Pagination", 29], ["Sidebar", 64]]),
    group("Display", [["Card", 156], ["Table", 102], ["Badge", 83], ["Avatar", 67], ["Chart", 54]]),
    group("Feedback", [["Toast", 71], ["Alert", 48], ["Progress", 36], ["Skeleton", 44]]),
  ]),
  "tree-vertical": branch("Home", [
    group("Pricing", [["Teams", 42], ["Enterprise", 18]]),
    branch("Docs", [group("Guides", [["Install", 96], ["Quickstart", 74]]), group("API", [["REST", 51], ["Webhooks", 23]])]),
    group("Blog", [["Changelog", 31], ["Stories", 12]]),
  ]),
  "tree-loading": branch("Docs", [
    group("Guides", [["Getting started", 12], ["Tutorials", 18], ["Recipes", 9]]),
    group("Reference", [["Components", 46], ["Hooks", 21]]),
    group("Releases", [["Changelog", 14], ["Migration", 6], ["Roadmap", 3]]),
  ]),
};

export function readHierarchy(rows: readonly Record<string, unknown>[] | undefined): SunburstNode[] | undefined {
  const read = (item: Record<string, unknown>, index: number): SunburstNode => ({
    name: String(item.name ?? item.label ?? index + 1),
    value: item.value === undefined ? undefined : Math.max(0, numeric(item.value)),
    color: typeof item.color === "string" ? item.color : undefined,
    children: Array.isArray(item.children) ? item.children.filter(row => row && typeof row === "object").map(read) : undefined,
  });
  return rows?.map(read);
}
