import type { SunburstNode } from "./upstream/sunburst-data";

function leaf(name: string, value: number, color?: string): SunburstNode {
  return { name, value, color };
}

function branch(name: string, ...children: SunburstNode[]): SunburstNode {
  return { name, children };
}

const defaultRevenue = branch("Revenue",
  branch("Product",
    branch("Enterprise", branch("North America", leaf("Direct", 52000), leaf("Channel", 38000)), leaf("EMEA", 60000), leaf("APAC", 48000)),
    branch("Pro", leaf("Teams", 90000), leaf("Solo", 55000)),
    leaf("Starter", 95000)),
  branch("Services",
    branch("Consulting", leaf("Strategy", 72000), leaf("Implementation", 88000)),
    branch("Support", leaf("Premium", 48000), leaf("Standard", 42000)),
    leaf("Training", 55000)),
  branch("Partners",
    leaf("Referrals", 120000), leaf("Affiliates", 75000),
    branch("Resellers", leaf("Regional", 64000), leaf("Global", 46000))),
  branch("Other", leaf("Licensing", 85000), leaf("Events", 42000)));

const cloudSpend = branch("Cloud spend",
  branch("Platform", branch("Compute", leaf("Kubernetes", 42000), leaf("VMs", 18000)),
    branch("Database", leaf("Postgres", 26000), leaf("Redis", 9000)), leaf("Networking", 14000)),
  branch("Data", branch("Warehouse", leaf("Queries", 31000), leaf("Storage", 12000)), leaf("Pipelines", 19000), leaf("ML training", 24000)),
  branch("Product", leaf("CDN", 11000), leaf("Object storage", 8000), leaf("Search", 10000)),
  branch("Security", leaf("Logging", 9000), leaf("Key management", 3000)));

const sessions = branch("Traffic",
  branch("Search", leaf("Organic", 4200), leaf("Paid", 2600)),
  branch("Social", leaf("LinkedIn", 1400), leaf("X", 900), leaf("YouTube", 700)),
  leaf("Direct", 2100),
  branch("Email", leaf("Newsletter", 1300), leaf("Lifecycle", 800)),
  branch("Referral", leaf("Partners", 900), leaf("Reviews", 600)));

const fiscalRevenue = branch("Revenue",
  branch("Subscriptions", leaf("Enterprise", 420000), leaf("Pro", 260000), leaf("Starter", 140000)),
  branch("Services", leaf("Onboarding", 120000), leaf("Consulting", 90000), leaf("Training", 50000)),
  branch("Expansion", leaf("Add-ons", 110000), leaf("Seats", 70000)),
  branch("Partners", leaf("Resellers", 80000), leaf("Referrals", 40000)));

const headcount = branch("Company",
  branch("Engineering", leaf("Product", 58), leaf("Platform", 42), leaf("Infrastructure", 24)),
  branch("Sales", leaf("Account Execs", 28), leaf("SDRs", 18), leaf("Solutions", 9)),
  branch("Marketing", leaf("Growth", 12), leaf("Brand", 7), leaf("Content", 6)),
  branch("Support", leaf("Tier 1", 14), leaf("Tier 2", 8)),
  branch("G&A", leaf("Finance", 8), leaf("People", 6), leaf("Legal", 4)));

const expenses = branch("Expenses",
  branch("Payroll", leaf("Engineering", 412000), leaf("Sales", 186000), leaf("G&A", 96000), leaf("Support", 74000)),
  branch("Infrastructure", leaf("Cloud", 118000), leaf("Software", 42000), leaf("Hardware", 18000)),
  branch("Marketing", leaf("Paid ads", 88000), leaf("Events", 34000), leaf("Content", 22000)),
  branch("Facilities", leaf("Rent", 64000), leaf("Utilities", 9000)));

export const sunburstFixtures: Record<string, SunburstNode> = {
  "sunburst-default": defaultRevenue,
  "sunburst-breadcrumb": cloudSpend,
  "sunburst-segment-colors": sessions,
  "sunburst-patterns": fiscalRevenue,
  "sunburst-legend": headcount,
  "sunburst-custom-hint": expenses,
};
