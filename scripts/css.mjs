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
  // Last: a look restyles the parts above, and wins by coming after them.
  'looks',
]

/*
 * THE TYPE SCALE IS THE ONLY SOURCE OF A FONT SIZE (HIG.md §2). A size written as a number is a size
 * off the scale sooner or later — 11.5, 12.5 and 13.5 each arrived that way — and an app that restyles
 * the desk by token cannot reach it. So the build refuses one, and names where it is.
 */
const literalSizes = PARTS.flatMap((name) =>
  readFileSync(`src/css/${name}.css`, 'utf8')
    .split('\n')
    .map((line, i) => ({ where: `src/css/${name}.css:${i + 1}`, line: line.trim() }))
    .filter(({ line }) => /font-size:/.test(line) && !/font-size:\s*var\(--desk-text-[a-z]+\)/.test(line)),
)
if (literalSizes.length) {
  for (const { where, line } of literalSizes) console.error(`${where}  ${line}  — use a --desk-text-* token`)
  process.exit(1)
}

const banner = (name) => `/* @liberation-data/desk — ${name}.css */\n`

mkdirSync('dist/css', { recursive: true })
const whole = PARTS.map((name) => {
  const css = readFileSync(`src/css/${name}.css`, 'utf8')
  writeFileSync(`dist/css/${name}.css`, banner(name) + css)
  return banner(name) + css
}).join('\n')
writeFileSync('dist/desk.css', whole)
