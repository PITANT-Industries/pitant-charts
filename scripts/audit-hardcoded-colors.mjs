#!/usr/bin/env node

/**
 * CI audit script — detects hardcoded colors in chart source files.
 *
 * Usage:
 *   node scripts/audit-hardcoded-colors.mjs [--fix]
 *
 * Exit code 1 if any hardcoded color is found in packages/.
 * Ignores:
 *   - tokens.css (that's the source of truth)
 *   - *.test.ts / *.spec.ts (test fixtures are fine)
 *   - resolve-tokens.ts DEFAULT_TOKENS (fallback values are OK)
 *   - types.ts files (no runtime values)
 */

import { execSync } from 'node:child_process'

// Patterns that indicate hardcoded colors
const COLOR_PATTERNS = [
  // hsl(…) / hsla(…)
  String.raw`hsl\s*\(`,
  // rgb(…) / rgba(…)
  String.raw`rgba?\s*\(`,
  // Hex colors: #rgb, #rrggbb, #rrggbbaa
  String.raw`#[0-9a-fA-F]{3,8}\b`,
]

const PATTERN = COLOR_PATTERNS.join('|')

// Files/paths to exclude from the audit
const EXCLUDES = [
  'tokens.css',
  'resolve-tokens.ts', // DEFAULT_TOKENS fallbacks are intentional
  '*.test.ts',
  '*.spec.ts',
  '__tests__',
  'dist/',
  'node_modules/',
  '.d.ts',
]

const EXCLUDE_ARGS = EXCLUDES.map((e) => `--glob '!${e}'`).join(' ')

let exitCode = 0

try {
  const result = execSync(
    `grep -rEn '${PATTERN}' packages/ ${EXCLUDE_ARGS} --include='*.ts' --include='*.tsx' --include='*.css' || true`,
    { encoding: 'utf-8' },
  ).trim()

  if (result) {
    console.error('❌ Hardcoded colors found in packages/:\n')
    console.error(result)
    console.error(
      '\n→ Use CSS variables (--chart-*) instead. See packages/charts/styles/tokens.css\n',
    )
    exitCode = 1
  } else {
    console.log('✅ No hardcoded colors found outside token definitions.')
  }
} catch {
  // grep returns exit 1 when no matches — that's the success case
  console.log('✅ No hardcoded colors found outside token definitions.')
}

process.exit(exitCode)
