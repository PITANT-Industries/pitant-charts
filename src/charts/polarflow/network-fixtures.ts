export type NetworkNode = { name: string; group: number; value?: number; x: number; y: number; radius: number };
export type NetworkEdge = { source: number; target: number; width: number };
interface NetworkFixture { groups: readonly string[]; nodes: readonly NetworkNode[]; links: readonly NetworkEdge[]; }

const defaultNodes = [
  { name: "Web app", group: 0, value: 4200, x: 0.5987, y: 0.8751, radius: 9.89 },
  { name: "Mobile API", group: 0, value: 2900, x: 0.4308, y: 0.9067, radius: 8.90 },
  { name: "Admin", group: 0, value: 300, x: 0.3172, y: 0.6139, radius: 5.57 },
  { name: "Gateway", group: 1, value: 7400, x: 0.4565, y: 0.7353, radius: 11.82 },
  { name: "Auth", group: 1, value: 5100, x: 0.2349, y: 0.6658, radius: 10.49 },
  { name: "Users", group: 1, value: 2600, x: 0.4343, y: 0.5656, radius: 8.64 },
  { name: "Orders", group: 1, value: 1400, x: 0.5038, y: 0.4461, radius: 7.40 },
  { name: "Billing", group: 1, value: 600, x: 0.4163, y: 0.2698, radius: 6.23 },
  { name: "Catalog", group: 1, value: 3300, x: 0.7096, y: 0.6280, radius: 9.22 },
  { name: "Search", group: 1, value: 2100, x: 0.2128, y: 0.8297, radius: 8.17 },
  { name: "Notifications", group: 1, value: 800, x: 0.7958, y: 0.1713, radius: 6.57 },
  { name: "Postgres", group: 2, value: 6100, x: 0.6147, y: 0.4399, radius: 11.10 },
  { name: "Redis", group: 2, value: 7900, x: 0.0578, y: 0.6766, radius: 12.08 },
  { name: "Kafka", group: 2, value: 2200, x: 0.7736, y: 0.3785, radius: 8.26 },
  { name: "Elasticsearch", group: 2, value: 2000, x: 0.0609, y: 0.8901, radius: 8.07 },
  { name: "Warehouse", group: 2, value: 500, x: 0.9422, y: 0.3509, radius: 6.03 },
  { name: "CDN", group: 3, value: 9800, x: 0.7368, y: 0.9694, radius: 13.00 },
  { name: "Payments", group: 3, value: 300, x: 0.2428, y: 0.1980, radius: 5.57 },
  { name: "Object storage", group: 3, value: 1200, x: 0.8903, y: 0.6683, radius: 7.15 },
  { name: "Email", group: 3, value: 400, x: 0.6779, y: 0.0306, radius: 5.82 },
];

const defaultLinks = edgeList([
  [0,16,3], [0,3,3.25], [1,3,2.75], [2,3,1.5], [3,4,3.25], [3,5,2.5],
  [3,6,2.25], [3,8,3], [3,9,2.5], [4,5,2], [4,12,3.25], [5,11,2.25],
  [6,11,2.5], [6,7,2], [6,13,2.25], [7,17,1.75], [7,11,1.75], [8,11,2.75],
  [8,18,2], [8,13,1.5], [9,14,3], [9,12,1.75], [13,10,2], [13,15,2.5],
  [10,19,1.75],
]);

const legendNodes = [
  { name: "Ava", group: 0, x: 0.2878, y: 0.1542, radius: 9.47 },
  { name: "Noah", group: 0, x: 0.0399, y: 0.2728, radius: 8.87 },
  { name: "Mia", group: 0, x: 0.0743, y: 0.1122, radius: 9.47 },
  { name: "Liam", group: 0, x: 0.1687, y: 0.0264, radius: 8.16 },
  { name: "Zoe", group: 0, x: 0.1624, y: 0.2789, radius: 8.87 },
  { name: "Ethan", group: 1, x: 0.4856, y: 0.3685, radius: 10.00 },
  { name: "Isla", group: 1, x: 0.2258, y: 0.4101, radius: 8.87 },
  { name: "Leo", group: 1, x: 0.3143, y: 0.3026, radius: 9.47 },
  { name: "Ruby", group: 1, x: 0.2507, y: 0.5677, radius: 9.47 },
  { name: "Owen", group: 1, x: 0.2335, y: 0.7927, radius: 8.87 },
  { name: "Lena", group: 1, x: 0.4300, y: 0.6484, radius: 8.87 },
  { name: "Kai", group: 2, x: 0.5257, y: 0.7309, radius: 10.00 },
  { name: "Nora", group: 2, x: 0.3935, y: 0.9318, radius: 8.87 },
  { name: "Theo", group: 2, x: 0.5908, y: 0.8976, radius: 10.00 },
  { name: "Ivy", group: 2, x: 0.7864, y: 0.9736, radius: 8.87 },
  { name: "Finn", group: 2, x: 0.7518, y: 0.7894, radius: 8.87 },
  { name: "Maya", group: 3, x: 0.7641, y: 0.5149, radius: 10.00 },
  { name: "Eli", group: 3, x: 0.9270, y: 0.7646, radius: 8.87 },
  { name: "Rosa", group: 3, x: 0.9601, y: 0.6093, radius: 9.47 },
  { name: "Jude", group: 3, x: 0.7988, y: 0.6840, radius: 8.87 },
];

const legendLinks = edgeList([
  [0,1,2.35], [1,2,2.8], [2,3,3.25], [3,4,2.35], [4,0,2.8], [0,2,1.9],
  [5,6,2.35], [6,7,2.8], [7,8,3.25], [8,9,2.35], [9,10,2.8], [10,5,3.25],
  [5,7,1.9], [11,12,2.35], [12,13,2.8], [13,14,3.25], [14,15,2.35], [15,11,2.8],
  [11,13,1.9], [16,17,2.35], [17,18,2.8], [18,19,3.25], [19,16,2.35], [16,18,1.9],
  [0,5,2.8], [1,6,2.35], [2,7,1.9], [8,11,2.8], [9,12,2.35], [10,13,1.9],
  [11,16,2.35], [14,17,2.8], [15,18,1.9], [5,16,1.9], [4,8,2.35], [13,19,1.9],
]);

const loadingNodes = [
  { name: "Design", group: 0, value: 18, x: 0.3116, y: 0.6625, radius: 10.55 },
  { name: "Tokens", group: 0, value: 26, x: 0.4067, y: 0.9694, radius: 11.87 },
  { name: "Icons", group: 0, value: 12, x: 0.0530, y: 0.5935, radius: 9.35 },
  { name: "Frontend", group: 1, value: 30, x: 0.5367, y: 0.7169, radius: 12.45 },
  { name: "Components", group: 1, value: 34, x: 0.2243, y: 0.7888, radius: 13.00 },
  { name: "Docs", group: 1, value: 10, x: 0.2656, y: 0.3833, radius: 8.88 },
  { name: "Search", group: 1, value: 8, x: 0.4859, y: 0.1348, radius: 8.37 },
  { name: "API", group: 2, value: 28, x: 0.7368, y: 0.3777, radius: 12.17 },
  { name: "Auth", group: 2, value: 14, x: 0.9470, y: 0.2645, radius: 9.78 },
  { name: "Billing", group: 2, value: 9, x: 0.6061, y: 0.0306, radius: 8.63 },
  { name: "Database", group: 2, value: 22, x: 0.7870, y: 0.0412, radius: 11.24 },
];

const loadingLinks = edgeList([
  [0,1,2.5], [0,2,2], [0,3,2.25], [3,1,2.75], [3,4,3.25], [3,7,2.5],
  [4,1,3], [4,2,2.25], [4,5,2], [7,8,2.5], [7,9,1.75], [7,10,3],
  [8,10,2], [9,10,1.75], [5,6,1.75], [6,10,1.5],
]);

function edgeList(rows: [number, number, number][]): NetworkEdge[] {
  return rows.map(([source, target, width]) => ({ source, target, width }));
}

export const networkFixtures: Record<string, NetworkFixture> = {
  "network-default": { groups: ["Clients", "Services", "Data", "Vendors"], nodes: defaultNodes, links: defaultLinks },
  "network-legend": { groups: ["Design", "Web", "Platform", "Data"], nodes: legendNodes, links: legendLinks },
  "network-loading": { groups: ["Design", "Frontend", "Backend"], nodes: loadingNodes, links: loadingLinks },
};
