import { describe, expect, it } from 'vitest'
import { lookFor } from '../../src/core/index.js'

describe('lookFor', () => {
  it.each([
    ['MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5)', 'mac'],
    ['macOS', '', 'mac'],
    ['iPad', 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 'mac'],
    ['Win32', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'windows'],
    ['Windows', '', 'windows'],
    ['Linux x86_64', 'Mozilla/5.0 (X11; Linux x86_64)', 'gnome'],
    ['Linux', '', 'gnome'],
    ['Chrome OS', '', 'gnome'],
    ['FreeBSD amd64', 'Mozilla/5.0 (X11; FreeBSD amd64)', 'gnome'],
  ] as const)('reads %s as %s → %s', (platform, userAgent, look) => {
    expect(lookFor(platform, userAgent)).toBe(look)
  })

  it('does not take an Android phone for a Linux desktop', () => {
    // Android reports a Linux platform string; its user agent says what it actually is.
    expect(lookFor('Linux armv8l', 'Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('mac')
  })

  it('keeps today’s look for a device it does not recognise', () => {
    expect(lookFor('', '')).toBe('mac')
  })
})
