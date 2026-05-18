#!/usr/bin/env node
/**
 * CLI benchmark runner for @pitant/charts.
 *
 * Usage:
 *   bun run bench              — run all scenarios
 *   bun run bench:scenario 005 — run single scenario
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { BenchmarkResult } from './scenarios.js'
import { scenarios } from './scenarios.js'

// ── CLI Args ─────────────────────────────────────────────────

const args = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const positional = args.filter((a) => !a.startsWith('--'))
const singleScenario = positional[0]
const updateBaseline = flags.has('--update-baseline')
const jsonOutput = flags.has('--json')

// ── Colors (ANSI) ────────────────────────────────────────────

const isCI = !!process.env['CI']
const useColor = !isCI || process.env['FORCE_COLOR'] === '1'
const c = {
  reset: useColor ? '\x1b[0m' : '',
  bold: useColor ? '\x1b[1m' : '',
  dim: useColor ? '\x1b[2m' : '',
  green: useColor ? '\x1b[32m' : '',
  red: useColor ? '\x1b[31m' : '',
  yellow: useColor ? '\x1b[33m' : '',
  cyan: useColor ? '\x1b[36m' : '',
}

// ── Baseline ─────────────────────────────────────────────────

const baselinePath = resolve(import.meta.dir, '..', 'baseline.json')

interface BaselineEntry {
  value: number
  unit: string
  target: number
}
type Baseline = Record<string, BaselineEntry>

function loadBaseline(): Baseline {
  if (!existsSync(baselinePath)) return {}
  try {
    return JSON.parse(readFileSync(baselinePath, 'utf-8')) as Baseline
  } catch {
    return {}
  }
}

function saveBaseline(results: BenchmarkResult[]): void {
  const baseline: Baseline = {}
  for (const r of results) {
    baseline[r.scenario] = { value: r.value, unit: r.unit, target: r.target }
  }
  writeFileSync(baselinePath, `${JSON.stringify(baseline, null, 2)}\n`)
  console.log(`\n${c.green}✓${c.reset} Baseline updated: ${baselinePath}`)
}

// ── Runner ───────────────────────────────────────────────────

function run(): BenchmarkResult[] {
  const scenarioKeys = singleScenario
    ? Object.keys(scenarios).filter((k) => k.includes(singleScenario))
    : Object.keys(scenarios).sort()

  if (scenarioKeys.length === 0) {
    console.error(`${c.red}✗${c.reset} No scenarios matching "${singleScenario}"`)
    process.exit(1)
  }

  const results: BenchmarkResult[] = []
  const baseline = loadBaseline()

  console.log(`\n${c.bold}@pitant/charts benchmark${c.reset}`)
  console.log(`${c.dim}${'─'.repeat(72)}${c.reset}\n`)

  for (const key of scenarioKeys) {
    const fn = scenarios[key]
    if (!fn) continue

    process.stdout.write(`  ${c.cyan}▸${c.reset} ${key} ... `)
    const startMem = process.memoryUsage().heapUsed
    const result = fn()
    const entries = Array.isArray(result) ? result : [result]
    const heapDelta = process.memoryUsage().heapUsed - startMem

    for (const entry of entries) {
      results.push(entry)
      const status = entry.passed ? `${c.green}✓ PASS${c.reset}` : `${c.red}✗ FAIL${c.reset}`

      const baseEntry = baseline[entry.scenario]
      let delta = ''
      if (baseEntry) {
        const pctChange = ((entry.value - baseEntry.value) / baseEntry.value) * 100
        const sign = pctChange > 0 ? '+' : ''
        const color = Math.abs(pctChange) > 10 ? c.yellow : c.dim
        delta = `  ${color}(${sign}${pctChange.toFixed(1)}% vs baseline)${c.reset}`
      }

      console.log(
        `${status}  ${entry.value} ${entry.unit}  ${c.dim}(target: ${entry.target} ${entry.unit})${c.reset}${delta}`,
      )
      if (heapDelta > 50 * 1024 * 1024) {
        console.log(`    ${c.dim}heap Δ: +${(heapDelta / 1024 / 1024).toFixed(1)} MB${c.reset}`)
      }
    }
  }

  return results
}

// ── Main ─────────────────────────────────────────────────────

const results = run()

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed).length

console.log(`\n${c.dim}${'─'.repeat(72)}${c.reset}`)
console.log(
  `  ${c.bold}${passed} passed${c.reset}${failed > 0 ? `, ${c.red}${c.bold}${failed} failed${c.reset}` : ''}  ${c.dim}(${results.length} total)${c.reset}\n`,
)

if (updateBaseline) {
  saveBaseline(results)
}

if (jsonOutput) {
  console.log(JSON.stringify(results, null, 2))
}

process.exit(failed > 0 ? 1 : 0)
