import { treemapFixtures } from "./treemap-tree-fixtures";
import type { SunburstNode } from "./upstream/sunburst-data";

type Leaf = readonly [name: string, value: number];
const leaf = ([name, value]: Leaf): SunburstNode => ({ name, value });
const group = (name: string, ...children: SunburstNode[]): SunburstNode => ({ name, children });
const bucket = (name: string, ...items: Leaf[]) => group(name, ...items.map(leaf));

const basePortfolio = treemapFixtures["treemap-portfolio"];
const [us, bonds, international, realAssets, cash] = basePortfolio.children ?? [];

export const referenceTreemapFixtures: Record<string, SunburstNode> = {
  "treemap-default": group("All teams",
    bucket("Platform", ["Compute", 48200], ["Database", 21400], ["Cache", 6900], ["Queues", 3100]),
    bucket("Machine Learning", ["Training", 39800], ["Inference", 27600], ["Storage", 8200]),
    bucket("Data", ["Warehouse", 18900], ["Pipelines", 9700], ["Dashboards", 2800]),
    bucket("Web", ["CDN", 12400], ["Edge Functions", 5600], ["Images", 3300]),
    bucket("Observability", ["Logs", 7400], ["Metrics", 4900], ["Traces", 2600])),
  "treemap-drilldown": group("dist",
    group("node_modules",
      bucket("react-dom", ["client", 118], ["scheduler", 9]),
      bucket("@tanstack", ["charts", 64], ["router", 41], ["query", 38]),
      leaf(["zod", 54]),
      bucket("date-fns", ["locale", 22], ["format", 12], ["parse", 8])),
    group("src",
      bucket("routes", ["dashboard", 46], ["billing", 24], ["settings", 18]),
      bucket("components", ["ui", 52], ["charts", 31]),
      bucket("lib", ["api", 16], ["utils", 7])),
    bucket("assets", ["fonts", 72], ["images", 41], ["icons", 28])),
  "treemap-portfolio": group("Portfolio", us, international, bonds, { ...realAssets, name: "Real Assets" }, cash),
  "treemap-loading": group("All buckets",
    bucket("Media", ["Uploads", 1840], ["Thumbnails", 620], ["Exports", 310]),
    bucket("Backups", ["Nightly", 1270], ["Weekly", 540]),
    bucket("Logs", ["App logs", 690], ["Audit", 280], ["Access", 190]),
    bucket("ML", ["Models", 480], ["Datasets", 360])),
};
