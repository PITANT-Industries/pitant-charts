import { defineConfig } from 'tsup'

const shared = {
  format: ['esm'] as const,
  sourcemap: true,
  target: 'es2022',
  outDir: 'dist',
}

export default defineConfig([
  {
    ...shared,
    entry: {
      index: 'src/index.ts',
      'data-engine/index': 'src/data-engine/index.ts',
    },
    dts: true,
    clean: true,
    treeshake: true,
    splitting: true,
  },
  {
    ...shared,
    entry: {
      'data-engine.worker': 'src/data-engine/data-engine.worker.ts',
      'data-engine/data-engine.worker': 'src/data-engine/data-engine.worker.ts',
    },
    clean: false,
    dts: false,
    splitting: false,
    treeshake: false,
  },
])
