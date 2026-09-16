import { defineConfig } from 'vitest/config'

// React tests opt into jsdom per file with `// @vitest-environment jsdom`.
export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    testTimeout: 15000,
  },
})
