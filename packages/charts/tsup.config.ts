import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'data-engine/index': 'src/data-engine/index.ts',
    'data-engine/data-engine.worker': 'src/data-engine/data-engine.worker.ts',
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: true,
  target: 'es2022',
  outDir: 'dist',
})
