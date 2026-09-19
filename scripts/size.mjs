#!/usr/bin/env node
/*
 * A budget, so the package cannot quietly grow. Numbers are the shipped bytes
 * (gzipped) of what a consumer loads; raise them deliberately, in a commit that
 * says why.
 */
import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/*
 * KiB gzipped. `css` is the whole stylesheet, which is what an app that imports `desk.css` loads;
 * the parts are printed under it, because an app can import only the ones it draws, and because a
 * part growing is easier to notice than a total growing.
 */
/*
 * Raised for minimizing (0.9 core, 0.3 react) and the browser title (0.4 react): a window kept
 * loaded off the desk is a third state that the desk, the URL, the dock and the Window menu all
 * have to know about. Still tight — a budget with room in it is not one.
 */
const BUDGETS = { core: 12, react: 47, css: 12 }

const walk = dir =>
  readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

const sizeOf = paths => paths.reduce((total, path) => total + gzipSync(readFileSync(path)).length, 0) / 1024

const js = walk('dist').filter(path => path.endsWith('.js'))
const parts = walk('dist/css').filter(path => path.endsWith('.css')).sort()
const measured = {
  core: sizeOf(js.filter(path => path.includes('/core/'))),
  react: sizeOf(js.filter(path => path.includes('/react/'))),
  css: sizeOf(['dist/desk.css']),
}

let over = false
for (const [name, budget] of Object.entries(BUDGETS)) {
  const actual = measured[name]
  const room = budget - actual
  console.log(`${name.padEnd(6)} ${actual.toFixed(1).padStart(6)} KiB of ${budget} — ${room < 0 ? 'OVER' : `${room.toFixed(1)} spare`}`)
  if (room < 0) over = true
}

console.log(
  '\ncss parts:  ' +
    parts.map(path => `${path.split('/').pop().replace('.css', '')} ${sizeOf([path]).toFixed(1)}`).join('  '),
)

if (over) {
  console.error('\nOver budget. Trim it, or raise the budget in scripts/size.mjs and say why.')
  process.exit(1)
}
