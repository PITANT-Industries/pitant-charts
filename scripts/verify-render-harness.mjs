#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HARNESS_DIR = resolve(ROOT, 'apps/render-harness')
const VISUAL_BASELINE_PATH = resolve(HARNESS_DIR, 'visual-baselines.json')
const VIEWPORT = { width: 1280, height: 900, deviceScaleFactor: 1 }
const VISUAL_GRID = { columns: 24, rows: 12 }
const DEFAULT_RENDERERS = ['canvas2d', 'webgpu']
const DEFAULT_VERIFY_PROFILES = ['compact', 'bands']
const DEFAULT_VISUAL_PROFILES = ['compact', 'large']
const DEFAULT_FPS_PROFILES = ['compact']
const MIN_SIGNIFICANT_PIXELS = 90
const FPS_FRAME_COUNT = 120

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl
    this.nextId = 1
    this.pending = new Map()
  }

  connect() {
    return new Promise((resolveConnect, rejectConnect) => {
      this.ws = new WebSocket(this.wsUrl)
      this.ws.addEventListener('open', () => resolveConnect())
      this.ws.addEventListener('error', (event) => rejectConnect(event.error ?? event))
      this.ws.addEventListener('message', (event) => this.handleMessage(event.data))
    })
  }

  send(method, params = {}) {
    const id = this.nextId++
    const payload = JSON.stringify({ id, method, params })
    return new Promise((resolveSend, rejectSend) => {
      this.pending.set(id, { resolve: resolveSend, reject: rejectSend, method })
      this.ws.send(payload)
    })
  }

  handleMessage(data) {
    const message = JSON.parse(data)
    if (!message.id) return

    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)

    if (message.error) {
      pending.reject(new Error(`${pending.method}: ${message.error.message}`))
    } else {
      pending.resolve(message.result)
    }
  }
}

const args = parseArgs(process.argv.slice(2))
const chromePath = args.browser ?? process.env.CHROME_BIN ?? findChromeExecutable()
const visualMode = args.visual === true || args.updateVisualBaseline === true
const fpsMode = args.fps === true
const requestedProfiles =
  args.profiles ??
  (visualMode ? DEFAULT_VISUAL_PROFILES : fpsMode ? DEFAULT_FPS_PROFILES : DEFAULT_VERIFY_PROFILES)
const requestedRenderers = args.renderers ?? DEFAULT_RENDERERS
const visualBaseline =
  args.visual === true && args.updateVisualBaseline !== true ? await loadVisualBaseline() : null

if (!chromePath) {
  throw new Error(
    'No Chrome/Chromium executable found. Set CHROME_BIN or pass --browser=/path/to/chrome.',
  )
}

const harnessPort = await getFreePort()
const debugPort = await getFreePort()
const profileDir = await mkdtemp(resolve(tmpdir(), 'pitant-charts-browser-'))
const children = []

try {
  const harness = spawn(
    'bun',
    ['run', 'dev', '--', '--port', String(harnessPort), '--strictPort'],
    {
      cwd: HARNESS_DIR,
      env: { ...process.env, BROWSER: 'none' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  children.push(harness)
  captureOutput(harness, 'harness')

  await waitForHttp(`http://127.0.0.1:${harnessPort}/`, 20_000)

  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-dev-shm-usage',
      '--enable-unsafe-webgpu',
      `--remote-debugging-address=127.0.0.1`,
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profileDir}`,
      `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  )
  children.push(chrome)
  captureOutput(chrome, 'chrome')

  await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 20_000)
  const tab = await connectToFirstPage(debugPort)

  await tab.send('Page.enable')
  await tab.send('Runtime.enable')
  await tab.send('Emulation.setDeviceMetricsOverride', {
    width: VIEWPORT.width,
    height: VIEWPORT.height,
    deviceScaleFactor: VIEWPORT.deviceScaleFactor,
    mobile: false,
  })

  const baseUrl = `http://127.0.0.1:${harnessPort}/`
  const webgpuAvailable = await evaluate(tab, 'Boolean(navigator.gpu)')
  const results = []

  for (const profile of requestedProfiles) {
    for (const renderer of requestedRenderers) {
      if (renderer === 'webgpu' && !webgpuAvailable) {
        results.push({
          renderer,
          profile,
          skipped: true,
          reason: 'navigator.gpu is unavailable in this browser environment',
        })
        continue
      }

      results.push(
        await verifyRenderer(tab, baseUrl, renderer, profile, {
          baseline: visualBaseline,
          fps: fpsMode,
          visual: visualMode,
        }),
      )
    }
  }

  if (args.updateVisualBaseline === true) {
    await writeVisualBaseline(results)
  }

  printResults(results, {
    baselinePath: VISUAL_BASELINE_PATH,
    visualMode,
    fpsMode,
    wroteBaseline: args.updateVisualBaseline === true,
  })

  const failed = results.some((result) => result.failed)
  process.exitCode = failed ? 1 : 0
} finally {
  await stopChildren(children.reverse())
  await removeWithRetry(profileDir)
}

async function verifyRenderer(tab, baseUrl, renderer, profile, options = {}) {
  const url = `${baseUrl}?renderer=${renderer}&profile=${profile}`
  await tab.send('Page.navigate', { url })
  await waitForExpression(
    tab,
    `document.readyState === "complete" &&
      window.__PITANT_RENDER_HARNESS_STATE__?.renderer === ${JSON.stringify(renderer)} &&
      window.__PITANT_RENDER_HARNESS_STATE__?.profile === ${JSON.stringify(profile)} &&
      document.querySelectorAll(".chart-surface").length === 2`,
    20_000,
  )
  await sleep(900)

  const state = await evaluate(tab, 'window.__PITANT_RENDER_HARNESS_STATE__')
  const stateErrors = validateProfileState(state, profile)
  const rects = await evaluate(
    tab,
    `Array.from(document.querySelectorAll(".chart-surface")).map((element) => {
      const rect = element.getBoundingClientRect()
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        className: element.className
      }
    })`,
  )
  const screenshot = await tab.send('Page.captureScreenshot', {
    format: 'png',
    fromSurface: true,
    captureBeyondViewport: false,
  })
  const image = parsePng(Buffer.from(screenshot.data, 'base64'))
  const charts = rects.map((rect, index) => {
    const chartRect = insetChartRect(rect)
    const visual = summarizeVisualRegion(image, chartRect)
    return {
      name: chartNameFromClassName(rect.className, index),
      rect: chartRect,
      significantPixels: visual.significantPixels,
      visual,
    }
  })
  const pixelChecks = charts.map((chart) => chart.significantPixels)
  const visualComparison =
    options.visual && options.baseline
      ? compareVisualResult({ renderer, profile, charts }, options.baseline)
      : null
  const fpsBenchmark = options.fps ? await runFpsBenchmark(tab, renderer, profile) : null
  const failed =
    stateErrors.length > 0 ||
    pixelChecks.some((count) => count < MIN_SIGNIFICANT_PIXELS) ||
    visualComparison?.failed === true ||
    fpsBenchmark?.failed === true

  return {
    renderer,
    profile,
    state,
    stateErrors,
    pixelChecks,
    charts,
    visualComparison,
    fpsBenchmark,
    failed,
  }
}

function validateProfileState(state, profile) {
  const errors = []
  if (!state || typeof state !== 'object') {
    return [`Missing harness state for ${profile}.`]
  }

  if (profile === 'bands' && state.analogBands !== 2) {
    errors.push(
      `Expected bands profile to render 2 analog bands, got ${state.analogBands ?? 'none'}.`,
    )
  }
  if (profile !== 'bands' && state.analogBands !== 0) {
    errors.push(`Expected ${profile} profile to render 0 analog bands, got ${state.analogBands}.`)
  }

  return errors
}

async function runFpsBenchmark(tab, renderer, profile) {
  return evaluate(
    tab,
    `new Promise((resolve) => {
      const target = document.querySelector(".chart-surface.analog .pitant-chart-interaction-region");
      if (!target) {
        resolve({
          failed: true,
          reason: "analog interaction region not found",
          fps: 0,
          minFps: 0,
          averageFrameMs: 0,
          maxFrameMs: Number.POSITIVE_INFINITY,
          p95FrameMs: Number.POSITIVE_INFINITY,
          droppedFrameCount: ${FPS_FRAME_COUNT},
          sampleCount: 0,
          targetFps: ${JSON.stringify(fpsTargetFor(renderer, profile))}
        });
        return;
      }

      const rect = target.getBoundingClientRect();
      const clientX = rect.left + rect.width * 0.55;
      const clientY = rect.top + rect.height * 0.58;
      const intervals = [];
      let frameIndex = 0;
      let lastTimestamp = 0;

      function step(timestamp) {
        if (lastTimestamp > 0) intervals.push(timestamp - lastTimestamp);
        lastTimestamp = timestamp;

        const deltaY = frameIndex % 2 === 0 ? 42 : -42;
        target.dispatchEvent(new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          deltaMode: WheelEvent.DOM_DELTA_PIXEL,
          deltaY
        }));

        frameIndex += 1;
        if (frameIndex < ${FPS_FRAME_COUNT}) {
          requestAnimationFrame(step);
          return;
        }

        requestAnimationFrame((finalTimestamp) => {
          intervals.push(finalTimestamp - lastTimestamp);
          const sorted = [...intervals].sort((a, b) => a - b);
          const total = intervals.reduce((sum, value) => sum + value, 0);
          const averageFrameMs = total / Math.max(1, intervals.length);
          const maxFrameMs = Math.max(...intervals);
          const p95FrameMs = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] ?? maxFrameMs;
          const fps = 1000 / averageFrameMs;
          const minFps = 1000 / maxFrameMs;
          const droppedFrameCount = intervals.filter((value) => value > 33.34).length;
          const targetFps = ${JSON.stringify(fpsTargetFor(renderer, profile))};
          resolve({
            failed: fps < targetFps || droppedFrameCount > 2,
            fps: Math.round(fps * 10) / 10,
            minFps: Math.round(minFps * 10) / 10,
            averageFrameMs: Math.round(averageFrameMs * 100) / 100,
            maxFrameMs: Math.round(maxFrameMs * 100) / 100,
            p95FrameMs: Math.round(p95FrameMs * 100) / 100,
            droppedFrameCount,
            sampleCount: intervals.length,
            targetFps
          });
        });
      }

      requestAnimationFrame(step);
    })`,
  )
}

function fpsTargetFor(renderer, profile) {
  if (profile === 'large') return renderer === 'webgpu' ? 45 : 30
  return 55
}

function insetChartRect(rect) {
  const x = rect.x + 96
  const y = rect.y + 82
  return {
    x,
    y,
    width: Math.max(1, rect.width - 132),
    height: Math.max(1, rect.height - 104),
  }
}

function summarizeVisualRegion(image, rect) {
  const normalized = normalizeImageRect(image, rect)
  let significantPixels = 0
  let totalR = 0
  let totalG = 0
  let totalB = 0
  let totalA = 0
  let totalPixels = 0

  for (let y = normalized.y0; y < normalized.y1; y++) {
    for (let x = normalized.x0; x < normalized.x1; x++) {
      const offset = (y * image.width + x) * 4
      const r = image.data[offset]
      const g = image.data[offset + 1]
      const b = image.data[offset + 2]
      const a = image.data[offset + 3]
      totalR += r
      totalG += g
      totalB += b
      totalA += a
      totalPixels += 1

      if (isSignificantPixel(r, g, b, a)) {
        significantPixels += 1
      }
    }
  }

  const fingerprint = sampleVisualFingerprint(image, normalized)
  const fingerprintHash = createHash('sha256')
    .update(Buffer.from(fingerprint))
    .digest('hex')
    .slice(0, 24)

  return {
    significantPixels,
    averageR: Math.round(totalR / totalPixels),
    averageG: Math.round(totalG / totalPixels),
    averageB: Math.round(totalB / totalPixels),
    averageA: Math.round(totalA / totalPixels),
    fingerprintHash,
    fingerprint,
  }
}

function sampleVisualFingerprint(image, rect) {
  const values = []
  const width = rect.x1 - rect.x0
  const height = rect.y1 - rect.y0

  for (let row = 0; row < VISUAL_GRID.rows; row++) {
    const y0 = rect.y0 + Math.floor((row * height) / VISUAL_GRID.rows)
    const y1 = rect.y0 + Math.floor(((row + 1) * height) / VISUAL_GRID.rows)

    for (let column = 0; column < VISUAL_GRID.columns; column++) {
      const x0 = rect.x0 + Math.floor((column * width) / VISUAL_GRID.columns)
      const x1 = rect.x0 + Math.floor(((column + 1) * width) / VISUAL_GRID.columns)
      let totalR = 0
      let totalG = 0
      let totalB = 0
      let count = 0

      for (let y = y0; y < Math.max(y0 + 1, y1); y++) {
        for (let x = x0; x < Math.max(x0 + 1, x1); x++) {
          const offset = (y * image.width + x) * 4
          totalR += image.data[offset]
          totalG += image.data[offset + 1]
          totalB += image.data[offset + 2]
          count += 1
        }
      }

      values.push(
        Math.round(totalR / count),
        Math.round(totalG / count),
        Math.round(totalB / count),
      )
    }
  }

  return values
}

function normalizeImageRect(image, rect) {
  const x0 = clamp(Math.floor(rect.x), 0, image.width - 1)
  const y0 = clamp(Math.floor(rect.y), 0, image.height - 1)
  const x1 = clamp(Math.ceil(rect.x + rect.width), x0 + 1, image.width)
  const y1 = clamp(Math.ceil(rect.y + rect.height), y0 + 1, image.height)
  return { x0, y0, x1, y1 }
}

function isSignificantPixel(r, g, b, a) {
  if (a < 20) return false

  const chroma = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b))
  return chroma > 14 || r < 235 || g < 235 || b < 235
}

async function loadVisualBaseline() {
  if (!existsSync(VISUAL_BASELINE_PATH)) {
    throw new Error(
      `Visual baseline is missing at ${VISUAL_BASELINE_PATH}. Run "bun run harness:visual:update" to create it.`,
    )
  }

  const baseline = JSON.parse(await readFile(VISUAL_BASELINE_PATH, 'utf8'))
  if (baseline.version !== 1) {
    throw new Error(`Unsupported visual baseline version: ${baseline.version}`)
  }
  if (baseline.grid?.columns !== VISUAL_GRID.columns || baseline.grid?.rows !== VISUAL_GRID.rows) {
    throw new Error('Visual baseline grid does not match verifier grid.')
  }
  return baseline
}

async function writeVisualBaseline(results) {
  const failed = results.filter((result) => !result.skipped && result.failed)
  if (failed.length > 0) {
    throw new Error('Refusing to write visual baseline because a render case failed.')
  }

  const baseline = {
    version: 1,
    updatedAt: new Date().toISOString(),
    viewport: VIEWPORT,
    grid: VISUAL_GRID,
    cases: {},
  }

  for (const result of results) {
    if (result.skipped) continue

    baseline.cases[visualCaseKey(result.renderer, result.profile)] = {
      renderer: result.renderer,
      profile: result.profile,
      pointCount: result.state?.pointCount ?? null,
      charts: Object.fromEntries(
        result.charts.map((chart) => [
          chart.name,
          {
            significantPixels: chart.visual.significantPixels,
            averageR: chart.visual.averageR,
            averageG: chart.visual.averageG,
            averageB: chart.visual.averageB,
            averageA: chart.visual.averageA,
            fingerprintHash: chart.visual.fingerprintHash,
            fingerprint: encodeFingerprint(chart.visual.fingerprint),
          },
        ]),
      ),
    }
  }

  await writeFile(VISUAL_BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`, 'utf8')
}

function compareVisualResult(result, baseline) {
  const expected = baseline.cases?.[visualCaseKey(result.renderer, result.profile)]
  if (!expected) {
    return {
      failed: true,
      details: [
        `Missing baseline for ${result.renderer}/${result.profile}. Run "bun run harness:visual:update".`,
      ],
    }
  }

  const thresholds = visualThresholdFor(result.renderer)
  const details = []
  let failed = false

  for (const chart of result.charts) {
    const expectedChart = expected.charts?.[chart.name]
    if (!expectedChart) {
      failed = true
      details.push(`Missing baseline chart "${chart.name}".`)
      continue
    }

    const pixelDelta = Math.abs(chart.visual.significantPixels - expectedChart.significantPixels)
    const allowedPixelDelta = Math.max(
      thresholds.pixelAbsolute,
      expectedChart.significantPixels * thresholds.pixelRelative,
    )
    const fingerprintDelta = meanAbsDelta(
      chart.visual.fingerprint,
      decodeFingerprint(expectedChart.fingerprint),
    )
    const averageDelta = meanAbsDelta(
      [chart.visual.averageR, chart.visual.averageG, chart.visual.averageB],
      [expectedChart.averageR, expectedChart.averageG, expectedChart.averageB],
    )
    const chartFailed =
      pixelDelta > allowedPixelDelta ||
      fingerprintDelta > thresholds.fingerprintMeanAbsDelta ||
      averageDelta > thresholds.averageMeanAbsDelta

    if (chartFailed) failed = true
    details.push(
      `${chart.name}: pixels Δ ${pixelDelta.toFixed(0)}/${allowedPixelDelta.toFixed(0)}, fingerprint Δ ${fingerprintDelta.toFixed(2)}/${thresholds.fingerprintMeanAbsDelta}, average Δ ${averageDelta.toFixed(2)}/${thresholds.averageMeanAbsDelta}`,
    )
  }

  return { failed, details }
}

function visualThresholdFor(renderer) {
  if (renderer === 'webgpu') {
    return {
      averageMeanAbsDelta: 24,
      fingerprintMeanAbsDelta: 44,
      pixelAbsolute: 1_500,
      pixelRelative: 0.45,
    }
  }

  return {
    averageMeanAbsDelta: 10,
    fingerprintMeanAbsDelta: 18,
    pixelAbsolute: 650,
    pixelRelative: 0.16,
  }
}

function meanAbsDelta(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) {
    return Number.POSITIVE_INFINITY
  }

  let total = 0
  for (let index = 0; index < actual.length; index++) {
    total += Math.abs(actual[index] - expected[index])
  }
  return total / actual.length
}

function visualCaseKey(renderer, profile) {
  return `${renderer}:${profile}`
}

function encodeFingerprint(fingerprint) {
  return Buffer.from(fingerprint).toString('base64')
}

function decodeFingerprint(fingerprint) {
  if (Array.isArray(fingerprint)) return fingerprint
  return [...Buffer.from(fingerprint, 'base64')]
}

function chartNameFromClassName(className, index) {
  const tokens = String(className).split(/\s+/)
  if (tokens.includes('analog')) return 'analog'
  if (tokens.includes('digital')) return 'digital'
  return `chart-${index + 1}`
}

function parsePng(buffer) {
  const signature = '89504e470d0a1a0a'
  if (buffer.subarray(0, 8).toString('hex') !== signature) {
    throw new Error('Screenshot is not a PNG')
  }

  let offset = 8
  let width = 0
  let height = 0
  let bitDepth = 0
  let colorType = 0
  const idat = []

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    offset += 12 + length

    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      bitDepth = data[8]
      colorType = data[9]
    } else if (type === 'IDAT') {
      idat.push(data)
    } else if (type === 'IEND') {
      break
    }
  }

  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`)
  }

  const bpp = colorType === 6 ? 4 : 3
  const inflated = inflateSync(Buffer.concat(idat))
  const stride = width * bpp
  const rgba = new Uint8Array(width * height * 4)
  let readOffset = 0
  let previous = new Uint8Array(stride)

  for (let y = 0; y < height; y++) {
    const filter = inflated[readOffset++]
    const current = new Uint8Array(stride)

    for (let x = 0; x < stride; x++) {
      const raw = inflated[readOffset++]
      const left = x >= bpp ? current[x - bpp] : 0
      const up = previous[x] ?? 0
      const upLeft = x >= bpp ? (previous[x - bpp] ?? 0) : 0
      current[x] = unfilter(raw, filter, left, up, upLeft)
    }

    for (let x = 0; x < width; x++) {
      const src = x * bpp
      const dst = (y * width + x) * 4
      rgba[dst] = current[src]
      rgba[dst + 1] = current[src + 1]
      rgba[dst + 2] = current[src + 2]
      rgba[dst + 3] = colorType === 6 ? current[src + 3] : 255
    }

    previous = current
  }

  return { width, height, data: rgba }
}

function unfilter(raw, filter, left, up, upLeft) {
  switch (filter) {
    case 0:
      return raw
    case 1:
      return (raw + left) & 0xff
    case 2:
      return (raw + up) & 0xff
    case 3:
      return (raw + Math.floor((left + up) / 2)) & 0xff
    case 4:
      return (raw + paeth(left, up, upLeft)) & 0xff
    default:
      throw new Error(`Unsupported PNG filter ${filter}`)
  }
}

function paeth(left, up, upLeft) {
  const estimate = left + up - upLeft
  const leftDelta = Math.abs(estimate - left)
  const upDelta = Math.abs(estimate - up)
  const upLeftDelta = Math.abs(estimate - upLeft)
  if (leftDelta <= upDelta && leftDelta <= upLeftDelta) return left
  if (upDelta <= upLeftDelta) return up
  return upLeft
}

async function connectToFirstPage(debugPort) {
  const pages = await fetchJson(`http://127.0.0.1:${debugPort}/json/list`)
  const page = pages.find((entry) => entry.type === 'page')
  if (!page?.webSocketDebuggerUrl) {
    throw new Error('Chrome did not expose a debuggable page target')
  }

  const client = new CdpClient(page.webSocketDebuggerUrl)
  await client.connect()
  return client
}

async function evaluate(tab, expression) {
  const response = await tab.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  })
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.text ?? 'Runtime.evaluate failed')
  }
  return response.result.value
}

async function waitForExpression(tab, expression, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await evaluate(tab, expression)) return
    await sleep(100)
  }
  throw new Error(`Timed out waiting for browser expression: ${expression}`)
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
    } catch {
      // Server is still starting.
    }
    await sleep(100)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
  return response.json()
}

async function getFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolvePort(port))
    })
    server.on('error', rejectPort)
  })
}

function findChromeExecutable() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function parseArgs(rawArgs) {
  const parsed = {}
  for (const arg of rawArgs) {
    if (arg.startsWith('--browser=')) {
      parsed.browser = arg.slice('--browser='.length)
    } else if (arg === '--fps') {
      parsed.fps = true
    } else if (arg === '--visual') {
      parsed.visual = true
    } else if (arg === '--update-visual-baseline') {
      parsed.updateVisualBaseline = true
    } else if (arg.startsWith('--profiles=')) {
      parsed.profiles = parseListArg(arg.slice('--profiles='.length), [
        ...DEFAULT_VERIFY_PROFILES,
        ...DEFAULT_VISUAL_PROFILES,
      ])
    } else if (arg.startsWith('--renderers=')) {
      parsed.renderers = parseListArg(arg.slice('--renderers='.length), DEFAULT_RENDERERS)
    }
  }
  return parsed
}

function parseListArg(value, allowed) {
  const allowedSet = new Set(allowed)
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  for (const item of items) {
    if (!allowedSet.has(item)) {
      throw new Error(`Unsupported list value "${item}". Allowed values: ${allowed.join(', ')}`)
    }
  }

  return items
}

function captureOutput(child, name) {
  let stderr = ''
  child.stderr?.on('data', (chunk) => {
    stderr += String(chunk)
    if (stderr.length > 10_000) stderr = stderr.slice(-10_000)
  })
  child.once('exit', (code, signal) => {
    if (code && code !== 0 && code !== 143 && signal !== 'SIGTERM') {
      console.error(`${name} exited with code ${code}\n${stderr}`)
    }
  })
}

async function stopChildren(childrenToStop) {
  await Promise.all(
    childrenToStop.map(
      (child) =>
        new Promise((resolveStop) => {
          if (child.exitCode !== null || child.signalCode !== null) {
            resolveStop()
            return
          }

          const forceTimer = setTimeout(() => {
            killChildTree(child, 'SIGKILL')
            resolveStop()
          }, 2_000)

          child.once('exit', () => {
            clearTimeout(forceTimer)
            resolveStop()
          })
          killChildTree(child, 'SIGTERM')
        }),
    ),
  )
}

function killChildTree(child, signal) {
  if (process.platform === 'win32' && child.pid) {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    killer.once('error', () => {
      child.kill()
    })
    return
  }

  child.kill(signal)
}

async function removeWithRetry(path) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await rm(path, { force: true, recursive: true })
      return
    } catch (error) {
      if (attempt === 4) throw error
      await sleep(150)
    }
  }
}

function printResults(results, options = {}) {
  console.log(
    `\n@pitant/render-harness browser ${options.fpsMode ? 'performance verification' : 'verification'}`,
  )
  console.log('────────────────────────────────────────────────────────────────────────')

  for (const result of results) {
    if (result.skipped) {
      console.log(`  ▸ ${result.renderer}/${result.profile}: SKIP - ${result.reason}`)
      continue
    }

    const status = result.failed ? 'FAIL' : 'PASS'
    const pixels = result.pixelChecks.map((count) => `${count} px`).join(', ')
    const sampleCount = result.state?.pointCount?.toLocaleString?.() ?? 'unknown'
    console.log(
      `  ▸ ${result.renderer}/${result.profile}: ${status} - significant pixels [${pixels}], ${sampleCount} samples`,
    )
    if (result.visualComparison) {
      for (const detail of result.visualComparison.details) {
        console.log(`      ${detail}`)
      }
    }
    for (const stateError of result.stateErrors ?? []) {
      console.log(`      state: ${stateError}`)
    }
    if (result.fpsBenchmark) {
      if (result.fpsBenchmark.reason) {
        console.log(`      fps: FAIL - ${result.fpsBenchmark.reason}`)
      } else {
        const fpsStatus = result.fpsBenchmark.failed ? 'FAIL' : 'PASS'
        console.log(
          `      fps: ${fpsStatus} - ${result.fpsBenchmark.fps} fps avg, ${result.fpsBenchmark.minFps} fps min, p95 ${result.fpsBenchmark.p95FrameMs} ms, dropped ${result.fpsBenchmark.droppedFrameCount}/${result.fpsBenchmark.sampleCount}, target ${result.fpsBenchmark.targetFps} fps`,
        )
      }
    }
  }

  if (options.wroteBaseline) {
    console.log(`\n  visual baseline updated: ${options.baselinePath}`)
  } else if (options.visualMode) {
    console.log(`\n  visual baseline checked: ${options.baselinePath}`)
  }
  console.log('')
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}
