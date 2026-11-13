export type FlowLink = { source: string; target: string; value: number };
type Fixture = { unit: string; links: FlowLink[]; palette?: Record<string, number> };

function links(rows: [string, string, number][]): FlowLink[] {
  return rows.map(([source, target, value]) => ({ source, target, value }));
}

const site = links([
  ["Paid Search", "Pricing", 3100],
  ["Paid Search", "Blog", 800],
  ["Paid Search", "Product", 2200],
  ["Organic Search", "Pricing", 1500],
  ["Organic Search", "Blog", 4200],
  ["Organic Search", "Docs", 2800],
  ["Email", "Pricing", 2100],
  ["Email", "Blog", 900],
  ["Email", "Product", 1400],
  ["Referral", "Pricing", 700],
  ["Referral", "Blog", 1800],
  ["Referral", "Docs", 1200],
  ["Paid Social", "Blog", 2800],
  ["Paid Social", "Product", 600],
  ["Paid Social", "Homepage", 1900],
  ["Direct", "Pricing", 1800],
  ["Direct", "Product", 1100],
  ["Direct", "Homepage", 3500],
  ["Pricing", "Converted", 4500],
  ["Pricing", "Engaged", 3200],
  ["Pricing", "Bounced", 1500],
  ["Blog", "Converted", 2100],
  ["Blog", "Engaged", 4800],
  ["Blog", "Bounced", 3600],
  ["Product", "Converted", 2800],
  ["Product", "Engaged", 1900],
  ["Product", "Bounced", 600],
  ["Docs", "Converted", 800],
  ["Docs", "Engaged", 2400],
  ["Docs", "Bounced", 800],
  ["Homepage", "Converted", 1200],
  ["Homepage", "Engaged", 1800],
  ["Homepage", "Bounced", 2400],
]);

const search = links([
  ["Organic Search", "Homepage", 4200],
  ["Organic Search", "Pricing", 1500],
  ["Paid Search", "Homepage", 800],
  ["Paid Search", "Pricing", 3100],
  ["Homepage", "Bounced", 3900],
  ["Homepage", "Converted", 1100],
  ["Pricing", "Bounced", 2000],
  ["Pricing", "Converted", 2600],
]);

const checkout = links([
  ["Email", "Product page", 1800],
  ["Email", "Checkout", 1200],
  ["Direct", "Product page", 2600],
  ["Direct", "Checkout", 900],
  ["Social", "Product page", 2100],
  ["Social", "Checkout", 300],
  ["Product page", "Paid", 1900],
  ["Product page", "Abandoned", 4600],
  ["Checkout", "Paid", 1700],
  ["Checkout", "Abandoned", 700],
]);

const devices = links([
  ["Desktop", "Homepage", 3800],
  ["Desktop", "Pricing", 2400],
  ["Desktop", "Docs", 2900],
  ["Mobile", "Homepage", 5200],
  ["Mobile", "Pricing", 1600],
  ["Mobile", "Docs", 700],
  ["Tablet", "Homepage", 900],
  ["Tablet", "Pricing", 400],
  ["Tablet", "Docs", 200],
  ["Homepage", "Left", 8000],
  ["Homepage", "Signed up", 1900],
  ["Pricing", "Left", 2300],
  ["Pricing", "Signed up", 2100],
  ["Docs", "Left", 2700],
  ["Docs", "Signed up", 1100],
]);

const orders = links([
  ["Web", "Americas", 5200],
  ["Web", "EMEA", 3100],
  ["Web", "APAC", 1900],
  ["Mobile app", "Americas", 2400],
  ["Mobile app", "EMEA", 1700],
  ["Mobile app", "APAC", 2600],
  ["Retail", "Americas", 1500],
  ["Retail", "EMEA", 900],
  ["Wholesale", "EMEA", 1300],
  ["Wholesale", "APAC", 700],
  ["Americas", "Hardware", 4600],
  ["Americas", "Software", 3300],
  ["Americas", "Services", 1200],
  ["EMEA", "Hardware", 3200],
  ["EMEA", "Software", 2400],
  ["EMEA", "Services", 1400],
  ["APAC", "Hardware", 2500],
  ["APAC", "Software", 1900],
  ["APAC", "Services", 800],
]);

const tickets = links([
  ["Email", "Billing", 820],
  ["Email", "Technical", 460],
  ["Email", "Account", 310],
  ["Chat", "Billing", 540],
  ["Chat", "Technical", 380],
  ["Chat", "Account", 160],
  ["Phone", "Billing", 290],
  ["Phone", "Account", 240],
  ["Community", "Technical", 210],
  ["Community", "Account", 120],
  ["Billing", "Resolved", 1380],
  ["Billing", "Escalated", 210],
  ["Billing", "Closed unresolved", 60],
  ["Technical", "Resolved", 760],
  ["Technical", "Escalated", 240],
  ["Technical", "Closed unresolved", 50],
  ["Account", "Resolved", 610],
  ["Account", "Escalated", 140],
  ["Account", "Closed unresolved", 80],
]);

const trials = links([
  ["Organic", "Starter trial", 1800],
  ["Organic", "Pro trial", 900],
  ["Paid", "Starter trial", 1300],
  ["Paid", "Pro trial", 1100],
  ["Referral", "Starter trial", 600],
  ["Referral", "Pro trial", 700],
  ["Partners", "Starter trial", 300],
  ["Partners", "Pro trial", 500],
  ["Starter trial", "Upgraded", 1100],
  ["Starter trial", "Extended", 1200],
  ["Starter trial", "Churned", 1700],
  ["Pro trial", "Upgraded", 1300],
  ["Pro trial", "Extended", 800],
  ["Pro trial", "Churned", 1100],
]);

const campaigns = links([
  ["Google Ads", "Pricing", 2400], ["Google Ads", "Demo", 1300], ["Google Ads", "Blog", 800],
  ["LinkedIn Ads", "Pricing", 900], ["LinkedIn Ads", "Demo", 1700], ["LinkedIn Ads", "Blog", 600],
  ["Meta Ads", "Pricing", 700], ["Meta Ads", "Demo", 300], ["Meta Ads", "Blog", 2200],
  ["Pricing", "Converted", 1500], ["Pricing", "Bounced", 2500],
  ["Demo", "Converted", 1600], ["Demo", "Bounced", 1700],
  ["Blog", "Converted", 300], ["Blog", "Bounced", 3300],
]);

export const sankeyFixtures: Record<string, Fixture> = {
  "sankey-default": { unit: "sessions", links: site, palette: { "Paid Search": 1, "Organic Search": 0, Email: 3, Referral: 4, "Paid Social": 2, Direct: 0, Pricing: 2, Blog: 1, Product: 3, Docs: 4, Homepage: 0, Converted: 1, Engaged: 2, Bounced: 3 } },
  "sankey-vertical-labels": { unit: "sessions", links: search },
  "sankey-category-colors": { unit: "sessions", links: checkout },
  "sankey-solid-links": { unit: "sessions", links: devices },
  "sankey-single-color": { unit: "orders", links: orders },
  "sankey-no-labels": { unit: "tickets", links: tickets },
  "sankey-pattern-lines": { unit: "trials", links: trials },
  "sankey-legend": { unit: "sessions", links: campaigns },
  "sankey-patterns": { unit: "sessions", links: site },
};
