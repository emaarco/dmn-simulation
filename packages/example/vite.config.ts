import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

/** Absolute path to a file inside the sibling library package. */
const lib = (path: string) => fileURLToPath(new URL(`../dmn-js-simulation/${path}`, import.meta.url))

export default defineConfig(({ command }) => ({
  base: './',
  server: { port: 5178, strictPort: true },
  preview: { port: 5178, strictPort: true },
  resolve: {
    alias:
      command === 'serve'
        ? [
            {
              find: '@emaarco/dmn-js-simulation/assets/dmn-js-simulation.css',
              replacement: lib('src/styles/dmn-js-simulation.css'),
            },
            { find: '@emaarco/dmn-js-simulation', replacement: lib('src/index.ts') },
          ]
        : [],
  },
}))
