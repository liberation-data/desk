#!/usr/bin/env node
/*
 * The generated-app bridge, checked in a real browser. jsdom cannot run a sandboxed
 * frame's scripts, and a drag's release behaves differently there — this is what
 * found a drop that the browser also counted as a click on the row it came from.
 *
 *   npm run example          # in another terminal: the sample on localhost:5392
 *   npm run check:browser    # CHROME=/path/to/chrome to use another browser
 */
import puppeteer from 'puppeteer-core'

const url = process.env.SAMPLE_URL ?? 'http://localhost:5392'
const step = (n, what, value) => console.log(`${n}. ${what}: ${value}`)

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--window-size=1500,950'],
  defaultViewport: { width: 1500, height: 950, deviceScaleFactor: 2 },
})
const page = await browser.newPage()
page.on('pageerror', e => console.log('PAGE ERROR', e.message))
await page.goto(`${url}/#w=rides,card&f=rides`, { waitUntil: 'networkidle0' })
await page.waitForSelector('iframe[title="Ride card"]')
const frame = await (await page.$('iframe[title="Ride card"]')).contentFrame()
await frame.waitForFunction(() => window.desk && window.desk.window === 'card', { timeout: 5000 })
step(1, 'the app connected as window', await frame.evaluate(() => window.desk.window))

// Choose a ride in Rides: the app should hear it through the bridge.
const row = await page.$$('table[aria-label="Rides"] tbody tr')
await row[2].click()
await frame.waitForFunction(() => document.body.innerText.includes('Beach Road bunch'), { timeout: 5000 })
step(2, 'it heard ride.selected', await frame.evaluate(() => document.querySelector('.note').textContent))

// Say something back: the app's button publishes and asks for the map.
await frame.click('#map')
await page.waitForSelector('[data-desk-window="map"]', { timeout: 5000 })
step(3, 'it published, and opened the map, which draws', await page.$eval('.mapcard b', el => el.textContent))

// Drop a ride onto the app window — with the map closed, so nothing floats over it.
await page.click('[data-desk-window="map"] [data-control="close"]')
await page.waitForFunction(() => !document.querySelector('[data-desk-window="map"]'))
const source = (await page.$$('table[aria-label="Rides"] tbody tr'))[3]
const from = await source.boundingBox()
const to = await (await page.$('[data-desk-window="card"] .desk-app-frame')).boundingBox()
await page.mouse.move(from.x + 40, from.y + from.height / 2)
await page.mouse.down()
await page.mouse.move(from.x + 80, from.y + from.height / 2, { steps: 5 })
await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 20 })
await page.mouse.up()
await frame.waitForFunction(() => document.querySelector('.note')?.textContent.startsWith('Dropped'), { timeout: 5000 })
step(4, 'it took a dropped ride', await frame.evaluate(() => `${document.querySelector('h1').textContent} — ${document.querySelector('.note').textContent}`))

await browser.close()
console.log('The bridge works in a real browser.')
