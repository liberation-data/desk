import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

/*
 * One stylesheet, or the parts of it you need.
 *
 * `desk.css` is every part in this order, which is what most apps want and what the docs tell them
 * to import. An app that uses a few pieces — a console with no conversation, a kiosk with no dock —
 * can import `@liberation-data/desk/css/tokens.css` and only the parts it draws, and ship less.
 *
 * Tokens come first and are not optional: every other part reads them.
 */
export const PARTS = [
  'tokens',
  'windows',
  'dock',
  'menus',
  'controls',
  'overlays',
  'conversation',
  'search',
  'setup',
  'apps',
]

const banner = (name) => `/* @liberation-data/desk — ${name}.css */\n`

mkdirSync('dist/css', { recursive: true })
const whole = PARTS.map((name) => {
  const css = readFileSync(`src/css/${name}.css`, 'utf8')
  writeFileSync(`dist/css/${name}.css`, banner(name) + css)
  return banner(name) + css
}).join('\n')
writeFileSync('dist/desk.css', whole)
