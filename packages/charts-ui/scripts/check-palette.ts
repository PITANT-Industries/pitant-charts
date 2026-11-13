// Machado, Oliveira and Fernandes (2009), full-severity linear RGB matrices.
const vision = {
  standard: [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritanopia: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
}

const css = await Bun.file(new URL('../src/warpdrive.css', import.meta.url)).text()
const themes = [
  {
    name: 'Day',
    card: '#ffffff',
    old: ['#4338ca', '#ac6b26', '#26a69a', '#805ad5', '#cb5379', '#047857', '#dc2626', '#64748b'],
  },
  {
    name: 'Night',
    card: '#121821',
    old: ['#a5b4fc', '#ac6b26', '#26a69a', '#805ad5', '#cb5379', '#10b981', '#f87171', '#8b98a5'],
  },
]
const swatches = [...css.matchAll(/--cl-wd-series-(\d):\s*(#[\da-f]{6});/gi)].map(
  (match) => match[2],
)

function linear(hex: string) {
  return [1, 3, 5].map((offset) => {
    const c = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
}

function multiply(matrix: number[][], rgb: number[]) {
  return matrix.map((row) => row.reduce((sum, coefficient, i) => sum + coefficient * rgb[i], 0))
}

function lab(rgb: number[]) {
  const lms = multiply(
    [
      [0.4122214708, 0.5363325363, 0.0514459929],
      [0.2119034982, 0.6806995451, 0.1073969566],
      [0.0883024619, 0.2817188376, 0.6299787005],
    ],
    rgb,
  ).map(Math.cbrt)
  return multiply(
    [
      [0.2104542553, 0.793617785, -0.0040720468],
      [1.9779984951, -2.428592205, 0.4505937099],
      [0.0259040371, 0.7827717662, -0.808675766],
    ],
    lms,
  )
}

function luminance(hex: string) {
  return multiply([[0.2126, 0.7152, 0.0722]], linear(hex))[0]
}

function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)]
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05)
}

function nearest(colors: string[], transform: number[][]) {
  const points = colors.map((color) =>
    lab(multiply(transform, linear(color)).map((x) => Math.max(0, Math.min(1, x)))),
  )
  return Math.min(
    ...points.flatMap((a, i) =>
      points.slice(i + 1).map((b) => Math.hypot(...a.map((x, j) => x - b[j]))),
    ),
  )
}

let passed = true
for (const [i, { name, card, old }] of themes.entries()) {
  const next = swatches.slice(i * 8, i * 8 + 8)
  if (next.length !== 8) throw Error('Expected eight palette colors per theme')
  const minimum = (colors: string[]) => Math.min(...colors.map((color) => contrast(color, card)))
  console.log(
    name,
    'mark / card contrast, original → proposed:',
    minimum(old).toFixed(2),
    '→',
    minimum(next).toFixed(2),
  )
  console.table(
    Object.entries(vision).map(([view, matrix]) => ({
      view,
      originalFirstFour: nearest(old.slice(0, 4), matrix).toFixed(3),
      proposedFirstFour: nearest(next.slice(0, 4), matrix).toFixed(3),
      proposedAllEight: nearest(next, matrix).toFixed(3),
    })),
  )
  passed &&= minimum(next) >= 3
}
if (!passed) throw Error('At least one default series falls below 3:1 against its card surface')
