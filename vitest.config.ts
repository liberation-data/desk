import { defineConfig } from 'vitest/config'

// React tests opt into jsdom per file with `// @vitest-environment jsdom`.
export default defineConfig({
  test: {
    include: ['test/**/*.test.{ts,tsx}'],
    // The garage sample is walked through in real time, pauses and all: a test that waits for it
    // needs room to report what went wrong rather than being cut off mid-wait.
    testTimeout: 30000,
    /*
     * jsdom puts the host OS in its user agent — "(darwin)" here, "(linux)" in CI — and the desk's look
     * is read from the device, so the same test would get the Mac look here and GNOME in CI. A device
     * nobody recognises instead: the Mac look, and a keyboard with Ctrl, on every machine. Tests about
     * the other looks, or about ⌘, choose them.
     */
    environmentOptions: {
      jsdom: { userAgent: 'Mozilla/5.0 (jsdom)' },
    },
  },
})
