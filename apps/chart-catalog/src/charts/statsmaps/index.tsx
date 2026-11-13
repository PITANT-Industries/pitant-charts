import { Beeswarm, Ecdf, Histogram, QuantilePlot, Ridgeline } from "./distributions";
import { Heatmap } from "./heatmap";
import { GeoMap, VectorField } from "./maps";
import { GeographyDetail } from "./GeographyDetail";
import { Density, Hexbin, Scatter } from "./points";
import { NoData, type DemoProps } from "./primitives";
import { Uncertainty } from "./uncertainty";
import { isUncertaintyDetail, UncertaintyDetail } from "./UncertaintyDetail";
import { isSpatialDensityVariant, SpatialDensityDetail } from "./SpatialDensityDetail";
import { DistributionDetail, isDistributionDetail } from "./DistributionDetail";
import { ReferenceDistributions } from "./ReferenceDistributions";
import { ChoroplethDetail } from "./ChoroplethDetail";
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
  if (!props.data && props.example.family === "choropleth") return <ChoroplethDetail key={props.example.id} {...props} />;
  if (!props.data && ["bubble-map", "route-map", "globe", "vector-field"].includes(props.example.family)) return <GeographyDetail key={props.example.id} {...props} />;
  if (!props.data && isSpatialDensityVariant(props.example.id)) return <SpatialDensityDetail key={props.example.id} {...props} />;
  if (!props.data && isDistributionDetail(props.example.id)) return <DistributionDetail key={props.example.id} {...props} />;
  if (!props.data && props.example.family === "uncertainty" && isUncertaintyDetail(props.example.id)) return <UncertaintyDetail key={props.example.id} {...props} />;
  if (!props.data && ["beeswarm", "violin", "box-plot"].includes(props.example.family)) return <ReferenceDistributions key={props.example.id} {...props} />;
  const Renderer = renderers[props.example.family as keyof typeof renderers] ?? NoData;
  return <Renderer key={props.example.id} {...props} />;
}
