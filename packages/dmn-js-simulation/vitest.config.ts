import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // domain + adapter tests run in Node; DOM-dependent integration tests opt
    // into jsdom per-file via a `// @vitest-environment jsdom` docblock.
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts'],
  },
})
