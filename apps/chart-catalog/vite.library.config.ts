import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nativeSourceEntries, writeSourceArchive } from './vite.native-source'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'native-chart-source',
      apply: 'build',
      writeBundle({ dir }) {
        if (dir) writeSourceArchive(resolve(dir, 'native-chart-source.tgz'), nativeSourceEntries)
      },
    },
  ],
  build: {
    outDir: 'dist-library',
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'chart-library',
      cssFileName: 'chart-library',
    },
    rolldownOptions: {
      external: /^(react(?:-dom)?|@ui-sdk\/(?:react|core)|echarts|recharts|d3-geo|d3-contour|topojson-client)(?:\/|$)/,
    },
  },
})
