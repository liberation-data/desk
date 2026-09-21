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
/*
 * Raised 0.5 react for the caller in a missing-provider error: an error boundary shows the
 * message and not the stack, so the frame that has to change is read off the stack and put in
 * the message. Half a KiB is the whole cost of a blank page being traceable to a line.
 */
/*
 * Raised react 48 → 52. Not for one feature: 48 was reached with 0.0 spare, which is a budget that
 * fails on the next commit whatever that commit is, and the three notes above are the same 0.x raise
 * three times. 9 KiB of the react bundle is comments — tsc emits them and `removeComments` would
 * take the `.d.ts` docs with them — so in this package prose costs budget, and a budget that makes
 * explaining a decision expensive buys bytes with the thing the bytes are for. 52 is room for the
 * features in front of us; it still catches what this is actually for, which is a stray dependency
 * or a duplicated module arriving unnoticed. Core 12 → 13 for the same reason and not for a change
 * of its own: it stood at 0.1 spare, so the next commit to touch it was red whatever it did.
 */
const BUDGETS = { core: 13, react: 52, css: 12 }

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
