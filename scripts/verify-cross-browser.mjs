#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'
import { chromium, firefox, webkit } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const HARNESS_DIR = resolve(ROOT, 'apps/render-harness')
const VIEWPORT = { width: 1280, height: 900 }
const MIN_SIGNIFICANT_PIXELS = 90
const FPS_FRAME_COUNT = 90
const DEFAULT_BROWSERS = ['chromium', 'firefox', 'webkit']
const DEFAULT_RENDERERS = ['canvas2d']
const DEFAULT_PROFILES = ['compact']
const SUPPORTED_PROFILES = ['compact', 'large', 'bands']

const args = parseArgs(process.argv.slice(2))
const browsers = args.browsers ?? DEFAULT_BROWSERS
const renderers = args.renderers ?? DEFAULT_RENDERERS
const profiles = args.profiles ?? DEFAULT_PROFILES
const children = []

let baseUrl = args.baseUrl

try {
  if (!baseUrl) {
    const harnessPort = await getFreePort()
    baseUrl = `http://127.0.0.1:${harnessPort}/`
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
    await waitForHttp(baseUrl, 20_000)
  }

  const results = []
  for (const browserName of browsers) {
    for (const renderer of renderers) {
      for (const profile of profiles) {
        results.push(await verifyCase({ baseUrl, browserName, fps: args.fps, profile, renderer }))
      }
    }
  }

  printResults(results)
  process.exitCode = results.some((result) => result.failed) ? 1 : 0
} finally {
  await stopChildren(children.reverse())
}

async function verifyCase({ baseUrl, browserName, fps, profile, renderer }) {
  let browser
  try {
    browser = await launchBrowser(browserName, renderer)
  } catch (err) {
    return {
      browser: browserName,
      renderer,
      profile,
      failed: true,
      reason: err instanceof Error ? err.message : String(err),
    }
  }

  try {
    const page = await browser.newPage({ viewport: VIEWPORT })
    const pageErrors = []
    const consoleErrors = []
    page.on('pageerror', (err) => pageErrors.push(err.message))
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    const webgpuAvailable = await page.evaluate('Boolean(navigator.gpu)')
    if (renderer === 'webgpu' && !webgpuAvailable) {
      return {
        browser: browserName,
        renderer,
        profile,
        skipped: true,
        reason: 'navigator.gpu is unavailable',
      }
    }

    const url = `${baseUrl}?renderer=${renderer}&profile=${profile}`
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(
      ({ expectedProfile, expectedRenderer }) =>
        document.readyState === 'complete' &&
        window.__PITANT_RENDER_HARNESS_STATE__?.renderer === expectedRenderer &&
        window.__PITANT_RENDER_HARNESS_STATE__?.profile === expectedProfile &&
        document.querySelectorAll('.chart-surface').length === 2,
      { expectedProfile: profile, expectedRenderer: renderer },
      { timeout: 20_000 },
    )
    await page.waitForTimeout(900)

    const state = await page.evaluate('window.__PITANT_RENDER_HARNESS_STATE__')
    const stateErrors = validateProfileState(state, profile)
    const rects = await page.locator('.chart-surface').evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect()
        return {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          className: element.className,
        }
      }),
    )
    const screenshot = await page.screenshot({ type: 'png' })
    const image = parsePng(screenshot)
    const charts = rects.map((rect, index) => {
      const chartRect = insetChartRect(rect)
      const visual = summarizeVisualRegion(image, chartRect)
      return {
        name: chartNameFromClassName(rect.className, index),
        significantPixels: visual.significantPixels,
        fingerprintHash: visual.fingerprintHash,
      }
    })
    const pixelChecks = charts.map((chart) => chart.significantPixels)
    const fpsBenchmark = fps ? await runFpsBenchmark(page, renderer, profile) : null
    const failed =
      pageErrors.length > 0 ||
      stateErrors.length > 0 ||
      pixelChecks.some((count) => count < MIN_SIGNIFICANT_PIXELS) ||
      fpsBenchmark?.failed === true

    return {
      browser: browserName,
      renderer,
      profile,
      state,
      stateErrors,
      charts,
      consoleErrors,
      pageErrors,
      fpsBenchmark,
      failed,
    }
  } catch (err) {
    return {
      browser: browserName,
      renderer,
      profile,
      failed: true,
      reason: err instanceof Error ? err.message : String(err),
    }
  } finally {
    await browser.close()
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

function launchBrowser(browserName, renderer) {
  const common = {
    headless: true,
    args: renderer === 'webgpu' ? ['--enable-unsafe-webgpu'] : [],
  }

  if (browserName === 'chromium') return chromium.launch(common)
  if (browserName === 'edge') return chromium.launch({ ...common, channel: 'msedge' })
  if (browserName === 'firefox') return firefox.launch({ headless: true })
  if (browserName === 'webkit') return webkit.launch({ headless: true })

  throw new Error(`Unsupported browser "${browserName}"`)
}

async function runFpsBenchmark(page, renderer, profile) {
  return page.evaluate(
    ({ frameCount, rendererName, profileName, targetFps }) =>
      new Promise((resolve) => {
        const target = document.querySelector(
          '.chart-surface.analog .pitant-chart-interaction-region',
        )
        if (!target) {
          resolve({
            failed: true,
            reason: 'analog interaction region not found',
            fps: 0,
            targetFps,
          })
          return
        }

        const rect = target.getBoundingClientRect()
        const clientX = rect.left + rect.width * 0.55
        const clientY = rect.top + rect.height * 0.58
        const intervals = []
        let frameIndex = 0
        let lastTimestamp = 0

        function step(timestamp) {
          if (lastTimestamp > 0) intervals.push(timestamp - lastTimestamp)
          lastTimestamp = timestamp

          target.dispatchEvent(
            new WheelEvent('wheel', {
              bubbles: true,
              cancelable: true,
              clientX,
              clientY,
              deltaMode: WheelEvent.DOM_DELTA_PIXEL,
              deltaY: frameIndex % 2 === 0 ? 42 : -42,
            }),
          )

          frameIndex += 1
          if (frameIndex < frameCount) {
            requestAnimationFrame(step)
            return
          }

          requestAnimationFrame((finalTimestamp) => {
            intervals.push(finalTimestamp - lastTimestamp)
            const total = intervals.reduce((sum, value) => sum + value, 0)
            const averageFrameMs = total / Math.max(1, intervals.length)
            const fps = 1000 / averageFrameMs
            const droppedFrameCount = intervals.filter((value) => value > 33.34).length
            resolve({
              failed: fps < targetFps || droppedFrameCount > 2,
              renderer: rendererName,
              profile: profileName,
              fps: Math.round(fps * 10) / 10,
              averageFrameMs: Math.round(averageFrameMs * 100) / 100,
              droppedFrameCount,
              targetFps,
            })
          })
        }

        requestAnimationFrame(step)
      }),
    {
      frameCount: FPS_FRAME_COUNT,
      profileName: profile,
      rendererName: renderer,
      targetFps: fpsTargetFor(renderer, profile),
    },
  )
}

function fpsTargetFor(renderer, profile) {
  if (profile === 'large') return renderer === 'webgpu' ? 45 : 30
  return renderer === 'webgpu' ? 55 : 45
}

function printResults(results) {
  console.log('\nPITANT cross-browser render smoke')
  console.log('────────────────────────────────────────────────────────────────────────')
  for (const result of results) {
    if (result.skipped) {
      console.log(`- SKIP ${result.browser}/${result.renderer}/${result.profile}: ${result.reason}`)
      continue
    }

    const status = result.failed ? 'FAIL' : 'PASS'
    const pixels = result.charts
      ?.map((chart) => `${chart.name}=${chart.significantPixels}`)
      .join(' ')
    const fps = result.fpsBenchmark ? ` fps=${result.fpsBenchmark.fps}` : ''
    const reason = result.reason ? ` ${result.reason}` : ''
    console.log(
      `- ${status} ${result.browser}/${result.renderer}/${result.profile} ${pixels ?? ''}${fps}${reason}`,
    )

    for (const pageError of result.pageErrors ?? []) {
      console.log(`  pageerror: ${pageError}`)
    }
    for (const consoleError of result.consoleErrors ?? []) {
      console.log(`  console.error: ${consoleError}`)
    }
    for (const stateError of result.stateErrors ?? []) {
      console.log(`  state: ${stateError}`)
    }
  }
  console.log('────────────────────────────────────────────────────────────────────────')
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
  const fingerprint = []

  for (let y = normalized.y0; y < normalized.y1; y++) {
    for (let x = normalized.x0; x < normalized.x1; x++) {
      const offset = (y * image.width + x) * 4
      const r = image.data[offset]
      const g = image.data[offset + 1]
      const b = image.data[offset + 2]
      const a = image.data[offset + 3]
      if (isSignificantPixel(r, g, b, a)) significantPixels += 1
    }
  }

  const width = normalized.x1 - normalized.x0
  const height = normalized.y1 - normalized.y0
  for (let row = 0; row < 8; row++) {
    for (let column = 0; column < 16; column++) {
      const x = normalized.x0 + Math.floor(((column + 0.5) * width) / 16)
      const y = normalized.y0 + Math.floor(((row + 0.5) * height) / 8)
      const offset = (y * image.width + x) * 4
      fingerprint.push(image.data[offset], image.data[offset + 1], image.data[offset + 2])
    }
  }

  return {
    significantPixels,
    fingerprintHash: createHash('sha256')
      .update(Buffer.from(fingerprint))
      .digest('hex')
      .slice(0, 24),
  }
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

function captureOutput(child, label) {
  child.stdout.on('data', (chunk) => {
    for (const line of String(chunk).split('\n').filter(Boolean)) {
      if (line.includes('Local:') || line.includes('ready')) console.log(`[${label}] ${line}`)
    }
  })
  child.stderr.on('data', (chunk) => {
    for (const line of String(chunk).split('\n').filter(Boolean)) {
      if (line.includes('exited with code 143')) continue
      console.error(`[${label}] ${line}`)
    }
  })
}

async function stopChildren(children) {
  await Promise.all(
    children.map(
      (child) =>
        new Promise((resolveStop) => {
          if (child.exitCode !== null) {
            resolveStop()
            return
          }
          const forceTimer = setTimeout(() => {
            if (child.exitCode === null) killChildTree(child, 'SIGKILL')
            resolveStop()
          }, 5_000)

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

function parseArgs(rawArgs) {
  const parsed = {}
  for (const arg of rawArgs) {
    if (arg.startsWith('--base-url=')) {
      parsed.baseUrl = arg.slice('--base-url='.length)
    } else if (arg === '--fps') {
      parsed.fps = true
    } else if (arg.startsWith('--browser=')) {
      parsed.browsers = parseListArg(arg.slice('--browser='.length), [
        'chromium',
        'firefox',
        'webkit',
        'edge',
      ])
    } else if (arg.startsWith('--renderer=')) {
      parsed.renderers = parseListArg(arg.slice('--renderer='.length), [
        'canvas2d',
        'webgpu',
        'auto',
      ])
    } else if (arg.startsWith('--profile=')) {
      parsed.profiles = parseListArg(arg.slice('--profile='.length), SUPPORTED_PROFILES)
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}
