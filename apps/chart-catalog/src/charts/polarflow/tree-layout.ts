import type { SunburstNode } from "./upstream/sunburst-data";

export type TreeMode = "left" | "top" | "radial";
export type TreeMark = {
  node: SunburstNode;
  path: string[];
  id: string;
  depth: number;
  parent?: TreeMark;
  group: number;
  order: number;
  angle: number;
  x: number;
  y: number;
  folded: number;
};

type Subtree = { marks: TreeMark[]; left: number[]; right: number[] };
const countDescendants = (node: SunburstNode): number => (node.children ?? []).reduce((sum, child) => sum + 1 + countDescendants(child), 0);

function pack(mark: TreeMark, children: Subtree[], preserveBranchSpace: boolean): Subtree {
  if (!children.length) return { marks: [mark], left: [0], right: [0] };
  const offsets: number[] = [];
  const left: number[] = [];
  const right: number[] = [];

  for (const child of children) {
    let offset = child.left.reduce((minimum, edge, depth) => right[depth] === undefined
      ? minimum : Math.max(minimum, right[depth] - edge + (depth === 0 ? 1 : 2)), 0);
    const previous = children[offsets.length - 1];
    if (preserveBranchSpace && previous && (previous.marks[0].folded || child.marks[0].folded)) {
      const depth = 1;
      offset = Math.max(offset, offsets.at(-1)! + (previous.right[depth] ?? 0) - (child.left[depth] ?? 0) + 1);
    }
    offsets.push(offset);
    child.left.forEach((edge, depth) => {
      left[depth] = Math.min(left[depth] ?? Infinity, edge + offset);
      right[depth] = Math.max(right[depth] ?? -Infinity, child.right[depth] + offset);
    });
  }
  const center = (offsets[0] + offsets[offsets.length - 1]) / 2;
  return {
    marks: [mark, ...children.flatMap((child, index) => {
      for (const childMark of child.marks) childMark.order += offsets[index] - center;
      return child.marks;
    })],
    left: [0, ...left.map(edge => edge - center)],
    right: [0, ...right.map(edge => edge - center)],
  };
}

export const treePlaceholderLabels = [27.2, 28.71, 58.15, 35.95, 38.47, 43.98, 48.45, 41.15, 34.44, 59.77, 48.6, 35.94];

export function demoTreeLayout(root: SunburstNode, collapsed: ReadonlySet<string>, mode: TreeMode, width: number, height: number, loading: boolean) {
  let maxDepth = 0;
  let leaf = 0;
  function walk(node: SunburstNode, id: number[], path: string[], group: number, parent?: TreeMark): Subtree {
    const key = id.join("/");
    const folded = collapsed.has(key) ? countDescendants(node) : 0;
    const depth = id.length;
    maxDepth = Math.max(maxDepth, depth);
    const mark: TreeMark = { node, id: key, path, group, parent, depth, folded, order: 0, x: 0, y: 0, angle: 0 };
    const children = folded ? [] : (node.children ?? []).map((child, index) =>
      walk(child, [...id, index], [...path, child.name], depth ? group : index, mark));
    if (mode !== "radial") return pack(mark, children, mode === "top");
    mark.order = children.length ? (children[0].marks[0].order + children[children.length - 1].marks[0].order) / 2 : leaf++;
    return { marks: [mark, ...children.flatMap(child => child.marks)], left: [], right: [] };
  }

  const { marks: nodes } = walk(root, [], [root.name], -1);
  const minimum = Math.min(...nodes.map(mark => mark.order));
  const maximum = Math.max(...nodes.map(mark => mark.order));
  const cx = width / 2;
  const cy = height / 2;
  const short = Math.min(width, height);
  const radius = Math.max(short / 2 - 78.407913208, short * .19);
  const isDocs = root.name === "Docs";
  const horizontalLeft = loading ? 66 : isDocs ? 48.935150146 : 84.803146362;
  const horizontalRight = loading ? 106 : isDocs ? 102.771911621 : 105.135940552;
  const verticalInset = 42.433982849;
  if (mode === "radial") nodes[0].order = leaf / 2 + .3;
  for (const mark of nodes) {
    const across = maximum > minimum ? (mark.order - minimum) / (maximum - minimum) : .5;
    const depth = mark.depth / Math.max(1, maxDepth);
    if (mode === "radial") {
      mark.angle = mark.order / Math.max(1, leaf) * 2 * Math.PI - Math.PI / 2;
      mark.x = cx + Math.cos(mark.angle) * depth * radius;
      mark.y = cy + Math.sin(mark.angle) * depth * radius;
    } else if (mode === "top") {
      mark.x = verticalInset + across * Math.max(1, width - verticalInset * 2);
      mark.y = 30 + depth * Math.max(1, height - 62);
    } else {
      mark.x = horizontalLeft + depth * Math.max(1, width - horizontalLeft - horizontalRight);
      mark.y = 14 + across * Math.max(1, height - 28);
    }
  }
  return { nodes, cx, cy };
}
