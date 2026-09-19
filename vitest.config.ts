import { defineConfig } from 'vitest/config'

// React tests opt into jsdom per file with `// @vitest-environment jsdom`.
export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    // The garage sample is walked through in real time, pauses and all: a test that waits for it
    // needs room to report what went wrong rather than being cut off mid-wait.
    testTimeout: 30000,
  },
})
