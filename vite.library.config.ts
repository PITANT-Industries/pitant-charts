import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-library',
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'chart-library',
      cssFileName: 'chart-library',
    },
    rolldownOptions: {
      external: /^(react(?:-dom)?|echarts|recharts|d3-geo|d3-contour|topojson-client)(?:\/|$)/,
    },
  },
})
