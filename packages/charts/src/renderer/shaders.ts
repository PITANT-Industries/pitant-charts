/**
 * WGSL line shader — instanced anti-aliased polyline rendering.
 *
 * Each line segment is expanded into a screen-space quad in the vertex shader.
 * The fragment shader computes analytical anti-aliasing via coverage calculation.
 *
 * Vertex layout per segment: 6 vertices forming 2 triangles (a quad).
 * Each vertex receives: segment endpoints (a, b) + side indicator.
 */
export const LINE_SHADER = /* wgsl */ `

struct FrameUniforms {
  viewport: vec2f,    // viewport width, height in pixels
  time: f32,
  _pad: f32,
}

struct LineUniforms {
  color: vec4f,
  transform: mat4x4f,
  width: f32,
  cap: f32,           // 0 = butt, 1 = round
  join: f32,           // 0 = miter, 1 = round
  _pad: f32,
}

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(1) @binding(0) var<uniform> line: LineUniforms;
@group(1) @binding(1) var<storage, read> points: array<vec2f>;

struct VertexOut {
  @builtin(position) pos: vec4f,
  @location(0) dist: f32,        // signed distance from line center
  @location(1) lineWidth: f32,   // half-width for AA
  @location(2) @interpolate(flat) segLen: f32,  // segment length for cap AA
  @location(3) along: f32,       // position along segment (0..segLen)
}

@vertex
fn vs_main(
  @builtin(vertex_index) vertexIndex: u32,
  @builtin(instance_index) instanceIndex: u32,
) -> VertexOut {
  // Each instance is a line segment: points[i] → points[i+1]
  let numPoints = arrayLength(&points);
  let i = instanceIndex;
  let j = min(i + 1u, numPoints - 1u);

  let a = points[i];
  let b = points[j];

  // Transform to clip space
  let clipA = line.transform * vec4f(a, 0.0, 1.0);
  let clipB = line.transform * vec4f(b, 0.0, 1.0);

  // To NDC
  let ndcA = clipA.xy / clipA.w;
  let ndcB = clipB.xy / clipB.w;

  // To screen pixels
  let screenA = (ndcA * 0.5 + 0.5) * frame.viewport;
  let screenB = (ndcB * 0.5 + 0.5) * frame.viewport;

  let dir = screenB - screenA;
  let segLen = length(dir);

  // Perpendicular normal
  var normal: vec2f;
  if segLen > 0.001 {
    let d = dir / segLen;
    normal = vec2f(-d.y, d.x);
  } else {
    normal = vec2f(0.0, 1.0);
  }

  let halfWidth = line.width * 0.5 + 1.0; // +1px for AA padding

  // 6 vertices per quad (2 triangles): 0,1,2 and 3,4,5
  // Vertices: (start_left, start_right, end_left, end_left, start_right, end_right)
  let vi = vertexIndex % 6u;

  // Determine which end of the segment and which side
  var isEnd: f32;
  var side: f32;

  switch vi {
    case 0u: { isEnd = 0.0; side = -1.0; }  // start left
    case 1u: { isEnd = 0.0; side =  1.0; }  // start right
    case 2u: { isEnd = 1.0; side = -1.0; }  // end left
    case 3u: { isEnd = 1.0; side = -1.0; }  // end left
    case 4u: { isEnd = 0.0; side =  1.0; }  // start right
    case 5u: { isEnd = 1.0; side =  1.0; }  // end right
    default: { isEnd = 0.0; side = 0.0; }
  }

  let baseScreen = mix(screenA, screenB, isEnd);
  let offset = normal * side * halfWidth;
  let screenPos = baseScreen + offset;

  // Back to NDC
  let ndc = (screenPos / frame.viewport) * 2.0 - 1.0;

  var out: VertexOut;
  out.pos = vec4f(ndc, 0.0, 1.0);
  out.dist = side * halfWidth;
  out.lineWidth = halfWidth;
  out.segLen = segLen;
  out.along = isEnd * segLen;
  return out;
}

@fragment
fn fs_main(in: VertexOut) -> @location(0) vec4f {
  let halfW = line.width * 0.5;
  let d = abs(in.dist) - halfW;

  // Analytical AA: smoothstep over 1 pixel at the edge
  let alpha = 1.0 - smoothstep(-0.5, 0.5, d);

  // Round cap AA (attenuate near segment ends)
  var capAlpha = 1.0;
  if line.cap > 0.5 {
    // Round caps
    let capDist0 = length(vec2f(in.along, in.dist)) - halfW;
    let capDist1 = length(vec2f(in.along - in.segLen, in.dist)) - halfW;
    let capD = min(
      select(0.0, capDist0, in.along < halfW),
      select(0.0, capDist1, in.along > in.segLen - halfW)
    );
    capAlpha = 1.0 - smoothstep(-0.5, 0.5, capD);
  }

  let finalAlpha = min(alpha, capAlpha) * line.color.a;
  if finalAlpha < 0.004 {
    discard;
  }
  return vec4f(line.color.rgb * finalAlpha, finalAlpha);
}
`

/**
 * WGSL fill shader — triangle-strip area fill between two polylines.
 */
export const FILL_SHADER = /* wgsl */ `

struct FrameUniforms {
  viewport: vec2f,
  time: f32,
  _pad: f32,
}

struct FillUniforms {
  color: vec4f,
  transform: mat4x4f,
}

@group(0) @binding(0) var<uniform> frame: FrameUniforms;
@group(1) @binding(0) var<uniform> fill: FillUniforms;
@group(1) @binding(1) var<storage, read> upper: array<vec2f>;
@group(1) @binding(2) var<storage, read> lower: array<vec2f>;

@vertex
fn vs_main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4f {
  // Triangle strip: alternating upper[i] and lower[i]
  let numUpper = arrayLength(&upper);
  let pairIndex = vertexIndex / 2u;
  let isLower = vertexIndex % 2u;

  let idx = min(pairIndex, numUpper - 1u);

  var pt: vec2f;
  if isLower == 0u {
    pt = upper[idx];
  } else {
    pt = lower[idx];
  }

  return fill.transform * vec4f(pt, 0.0, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4f {
  return vec4f(fill.color.rgb * fill.color.a, fill.color.a);
}
`
