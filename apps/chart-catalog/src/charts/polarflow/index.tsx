import { ReferenceMarimekko, ReferenceWaffle } from "./ReferenceQuantity";
import { Pie, Radar, Ring } from "./circular";
import { Gauge } from "./gauge";
import { Network, Sunburst, Tree, Treemap } from "./hierarchy";
import { Funnel, Marimekko, Waffle } from "./quantity";
import { Radial } from "./radial";
import { Sankey } from "./sankey";
import { ReferenceTreemap } from "./ReferenceTreemap";
import { TooltipPreview } from "./tooltip-preview";
import type { Props } from "./shared";

const charts = {
  pie: Pie, ring: Ring, radial: Radial, gauge: Gauge, waffle: Waffle, marimekko: Marimekko,
  funnel: Funnel, sankey: Sankey, sunburst: Sunburst, treemap: Treemap, tree: Tree, network: Network,
  radar: Radar, tooltip: TooltipPreview,
};

export default function PolarFlowChart(props: Props) {
  if (props.example.family === "treemap") return <ReferenceTreemap key={props.example.id} {...props} />;
  if (props.example.family === "waffle") return <ReferenceWaffle {...props} key={props.example.id} />;
  if (props.example.family === "marimekko") return <ReferenceMarimekko {...props} key={props.example.id} />;
  const Component = charts[props.example.family as keyof typeof charts];
  return Component ? <Component {...props} key={props.example.id} /> : <div role="status">Chart family unavailable</div>;
}
