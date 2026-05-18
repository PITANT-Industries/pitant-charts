# Contributing

## Prerequisites

- [Bun](https://bun.sh) >= 1.1
- Node.js >= 22

## Setup

```bash
git clone <repo-url>
cd Pchart
bun install
```

## Development Workflow

```bash
bun run build        # Build all packages
bun run typecheck    # TypeScript strict check
bun run lint         # Biome lint + format
bun run lint:fix     # Auto-fix
bun run test         # Run tests
bun run test:watch   # Watch mode
bun run test:coverage # Coverage report
```

## Commit Hooks

Pre-commit hooks run automatically via [lefthook](https://github.com/evilmartians/lefthook):
- Biome lint + format check
- TypeScript typecheck

## Code Style

- **Formatter**: Biome — single quotes, no semicolons, trailing commas
- **Line width**: 100 characters
- **Module system**: ESM only (`"type": "module"`)
- **TypeScript**: Strict mode with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`

## Adding a New Package

1. Create `packages/<name>/package.json` with `"name": "@pitant/<name>"`
2. Add `tsconfig.json` extending root
3. Add `tsup.config.ts` for build
4. Update root build script if ordering is needed
