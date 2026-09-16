#!/usr/bin/env node
/*
 * A budget, so the package cannot quietly grow. Numbers are the shipped bytes
 * (gzipped) of what a consumer loads; raise them deliberately, in a commit that
 * says why.
 */
import { gzipSync } from 'node:zlib'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BUDGETS = { core: 9, react: 46, css: 9 } // KiB gzipped

const walk = dir =>
  readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })

const sizeOf = paths => paths.reduce((total, path) => total + gzipSync(readFileSync(path)).length, 0) / 1024

const js = walk('dist').filter(path => path.endsWith('.js'))
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

if (over) {
  console.error('\nOver budget. Trim it, or raise the budget in scripts/size.mjs and say why.')
  process.exit(1)
}
