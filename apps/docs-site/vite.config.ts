import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const root = resolve(__dirname, '../..')
const useClientDirective = /^(['"])use client\1;?\s*/

export default defineConfig({
  plugins: [
    {
      name: 'pitant-docs-strip-use-client',
      enforce: 'pre',
      transform(code, id) {
        if (!useClientDirective.test(code)) {
          return null
        }
        if (!id.includes('/registry/pitant/') && !id.includes('/packages/charts-react/src/')) {
          return null
        }

        return {
          code: code.replace(useClientDirective, ''),
          map: null,
        }
      },
    },
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      {
        find: '@pitant/charts/styles/tokens.css',
        replacement: resolve(root, 'packages/charts/styles/tokens.css'),
      },
      {
        find: '@pitant/charts-react',
        replacement: resolve(root, 'packages/charts-react/src/index.ts'),
      },
      { find: '@pitant/charts', replacement: resolve(root, 'packages/charts/src/index.ts') },
    ],
  },
  server: {
    fs: {
      allow: [root],
    },
  },
})
