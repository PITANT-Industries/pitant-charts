import type { SunburstNode } from "./upstream/sunburst-data";

function leaf(name: string, value: number, color?: string): SunburstNode {
  return { name, value, color };
}

function branch(name: string, ...children: SunburstNode[]): SunburstNode {
  return { name, children };
}

const defaultRevenue = branch("Revenue",
  branch("Product",
    branch("Enterprise", branch("North America", leaf("Direct", 73000), leaf("Channel", 40000)), leaf("EMEA", 57000), leaf("APAC", 36000)),
    branch("Pro", leaf("Teams", 84000), leaf("Solo", 51000)),
    leaf("Starter", 96000)),
  branch("Services",
    branch("Consulting", leaf("Strategy", 66000), leaf("Implementation", 51000)),
    branch("Support", leaf("Premium", 54000), leaf("Standard", 47000)),
    leaf("Training", 68000)),
  branch("Partners",
    branch("Resellers", leaf("Global", 74000), leaf("Regional", 52000)),
    leaf("Affiliates", 41000), leaf("Referrals", 33000)),
  branch("Other", leaf("Licensing", 140000), leaf("Events", 117000)));

const cloudSpend = branch("Cloud spend",
  branch("Platform", branch("Compute", leaf("Kubernetes", 43000), leaf("VMs", 25000)),
    branch("Database", leaf("Postgres", 24000), leaf("Redis", 9000)), leaf("Networking", 8000)),
  branch("Product", leaf("Compute", 36000), leaf("Storage", 25000)),
  branch("Data", leaf("Warehouse", 31000), leaf("Pipelines", 15000)),
  branch("Security", leaf("Monitoring", 12000), leaf("Scanning", 8000)));

const sessions = branch("Traffic",
  branch("Search", leaf("Organic", 4500), leaf("Paid", 2500)),
  { ...branch("Social", leaf("LinkedIn", 1400, "var(--chart-1)"), leaf("X", 900, "var(--chart-3)"),
    leaf("YouTube", 700, "var(--chart-5)")), color: "var(--chart-2)" },
  branch("Direct", leaf("Direct", 2400)),
  branch("Email", leaf("Newsletter", 1300), leaf("Lifecycle", 800)),
  branch("Referral", leaf("Partners", 1100), leaf("Reviews", 400)));

const fiscalRevenue = branch("Revenue",
  branch("Subscriptions", leaf("Enterprise", 490000), leaf("Pro", 320000), leaf("Starter", 180000)),
  branch("Expansion", leaf("Seats", 72000), leaf("Add-ons", 48000)),
  branch("Services", leaf("Onboarding", 125000), leaf("Consulting", 65000)),
  branch("Partners", leaf("Resellers", 54000), leaf("Referrals", 26000)));

const headcount = branch("Headcount",
  branch("Engineering", leaf("Product", 58), leaf("Platform", 42), leaf("Infrastructure", 24)),
  branch("Sales", leaf("Account Execs", 25), leaf("SDRs", 18), leaf("Solutions", 12)),
  branch("Marketing", leaf("Growth", 12), leaf("Brand", 8), leaf("Content", 5)),
  branch("Support", leaf("Tier 1", 14), leaf("Tier 2", 8)),
  branch("G&A", leaf("Finance", 8), leaf("People", 6), leaf("Legal", 4)));

const expenses = branch("Operating expenses",
  branch("Payroll", leaf("Engineering", 412000), leaf("Sales", 186000), leaf("Support", 74000), leaf("G&A", 96000)),
  branch("Infrastructure", leaf("Cloud", 118000), leaf("Software", 42000), leaf("Hardware", 18000)),
  branch("Marketing", leaf("Paid ads", 88000), leaf("Events", 34000), leaf("Content", 22000)),
  branch("Facilities", leaf("Rent", 64000), leaf("Utilities", 10000)));

export const sunburstFixtures: Record<string, SunburstNode> = {
  "sunburst-default": defaultRevenue,
  "sunburst-breadcrumb": cloudSpend,
  "sunburst-segment-colors": sessions,
  "sunburst-patterns": fiscalRevenue,
  "sunburst-legend": headcount,
  "sunburst-custom-hint": expenses,
};
