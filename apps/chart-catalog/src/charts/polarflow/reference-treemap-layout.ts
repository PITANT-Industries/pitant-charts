import { hierarchy, treemap, treemapBinary, treemapSquarify } from "d3-hierarchy";
import type { HierarchyRectangularNode } from "d3-hierarchy";
import type { SunburstNode } from "./upstream/sunburst-data";
import { sumValues } from "./upstream/sunburst-layout";

type Bounds = { x: number; y: number; width: number; height: number };

function rect<T>(node: HierarchyRectangularNode<T>, top: number): Bounds {
  return { x: node.x0, y: node.y0 + top, width: node.x1 - node.x0, height: node.y1 - node.y0 };
}

export type TreemapTile = {
  node: SunburstNode;
  path: string[];
  indices: number[];
  bounds: Bounds;
  color: number;
  tint: number;
  frame: boolean;
  header: boolean;
};

export function treemapTiles(root: SunburstNode, path: string[], current: SunburstNode, width: number, height: number, portfolio: boolean, identityPath: readonly number[] = []) {
  const gap = portfolio ? 2 : 3;
  const top = path.length ? 30 : 0;
  const hierarchyRoot = hierarchy({ item: current, level: 0 }, ({ item, level }) =>
    level < 2 ? item.children?.map(child => ({ item: child, level: level + 1 })) : undefined);
  hierarchyRoot.sum(({ item, level }) => level === 2 || !item.children?.length ? sumValues(item) : 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const layout = treemap<(typeof hierarchyRoot)["data"]>()
    .tile(portfolio ? treemapBinary : treemapSquarify.ratio(1.3))
    .size([width, Math.max(0, height - top)])
    .paddingInner(gap)
    .paddingOuter(mark => mark.depth === 0 ? 0 : gap)
    .paddingTop(mark => {
      if (!mark.depth) return 0;
      return !portfolio && mark.children && mark.x1 - mark.x0 >= 64 && mark.y1 - mark.y0 >= 48 ? 24 : gap;
    })
    .round(true);
  const plot = layout(hierarchyRoot);
  const frames: TreemapTile[] = [];
  const cells: TreemapTile[] = [];
  for (const record of plot.descendants().slice(1)) {
    const parents = record.ancestors().slice(0, -1).reverse().map(item => item.data.item.name);
    const trail = [...path, ...parents];
    const indices = [...identityPath, ...record.ancestors().slice(0, -1).reverse().map(item => item.parent!.data.item.children!.indexOf(item.data.item))];
    const bounds = rect(record, top);
    if (bounds.width <= 0 || bounds.height <= 0) continue;
    const siblings = record.parent?.children ?? [record];
    const frame = !!record.children?.length;
    const tile = {
      node: record.data.item, path: trail, indices, bounds, color: indices[0] ?? 0, frame,
      tint: frame ? 12 : Math.round(62 - 26 * siblings.indexOf(record) / Math.max(1, siblings.length - 1)),
      header: frame && !portfolio && (record.children?.[0].y0 ?? record.y1) - record.y0 >= 24,
    };
    (frame ? frames : cells).push(tile);
  }
  return [...frames, ...cells];
}

// A neutral hierarchy makes the placeholder independent of the loaded bucket values.
const skeletonGroups = [
  [3.023063, 5.935804, 4.565236],
  [5.20717, 4.289954],
  [1.635391, 4.24042, 1.41207],
  [1.858753, 3.223368],
];
const skeleton: SunburstNode = {
  name: "Storage",
  children: skeletonGroups.map((values, group) => ({
    name: `Group ${group}`,
    children: values.map((value, index) => ({ name: `Bucket ${index}`, value })),
  })),
};

export function skeletonTiles(width: number, height: number) {
  const source = hierarchy(skeleton).sum(node => node.value ?? 0).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  return treemap<SunburstNode>()
    .tile(treemapSquarify.ratio(1.3))
    .size([width, height])
    .paddingInner(3)
    .paddingOuter(node => node.depth ? 3 : 0)
    .round(true)(source).leaves().map((node, index) => [String(index), rect(node, 0)] as const);
}
