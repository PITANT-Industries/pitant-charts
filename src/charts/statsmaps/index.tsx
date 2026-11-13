import { Beeswarm, Ecdf, Histogram, QuantilePlot, Ridgeline } from "./distributions";
import { Heatmap } from "./heatmap";
import { GeoMap, VectorField } from "./maps";
import { Density, Hexbin, Scatter } from "./points";
import { NoData, type DemoProps } from "./primitives";
import { Uncertainty } from "./uncertainty";
import "./styles.css";

const renderers = {
  scatter: Scatter,
  heatmap: Heatmap,
  uncertainty: Uncertainty,
  histogram: Histogram,
  ridgeline: Ridgeline,
  ecdf: Ecdf,
  beeswarm: Beeswarm,
  violin: QuantilePlot,
  "box-plot": QuantilePlot,
  hexbin: Hexbin,
  density: Density,
  choropleth: GeoMap,
  "bubble-map": GeoMap,
  "route-map": GeoMap,
  globe: GeoMap,
  "vector-field": VectorField,
};

export default function StatisticalAndSpatialChart(props: DemoProps) {
  const Renderer = renderers[props.example.family as keyof typeof renderers] ?? NoData;
  return <Renderer key={props.example.id} {...props} />;
}
