#!/usr/bin/env node
/*
 * The README's screenshots, taken from the garage sample so they can be taken again: the chrome
 * changes, and a screenshot nobody can reproduce is one that quietly goes out of date.
 *
 *   npm run example          # in another terminal: the sample on localhost:5392
 *   npm run screenshots      # CHROME=/path/to/chrome to use another browser
 *
 * The setup assistant's screenshot is not here: it has no chrome of its own to go stale.
 */
import puppeteer from 'puppeteer-core'

const url = process.env.SAMPLE_URL ?? 'http://localhost:5392'
const out = 'docs/screenshots'

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  defaultViewport: { width: 1200, height: 750, deviceScaleFactor: 1.5 },
})

const settle = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms))
// ⌘ where the browser runs on a Mac, Ctrl elsewhere: the keyboard is the device's, whatever the look.
const mod = process.platform === 'darwin' ? 'Meta' : 'Control'

async function chord(page, ...keys) {
  for (const key of keys) await page.keyboard.down(key)
  for (const key of keys.reverse()) await page.keyboard.up(key)
}

/** A page on the sample, with the given windows open and the look, dock side and theme chosen. */
async function open(windows, { look = 'mac', side = 'left', theme = 'dark' } = {}) {
  const page = await browser.newPage()
  page.on('pageerror', error => console.log('PAGE ERROR', error.message))
  await page.evaluateOnNewDocument(
    (look, side) => localStorage.setItem('garage.appearance', JSON.stringify({ look, side })),
    look,
    side,
  )
  await page.goto(`${url}/#w=${windows.join(',')}&f=${windows[0]}`, { waitUntil: 'networkidle0' })
  await page.evaluate(theme => (document.documentElement.dataset.theme = theme), theme)
  await settle()
  return page
}

async function arranged(options) {
  const page = await open(['rides', 'map', 'weather', 'parts'], options)
  await chord(page, mod, 'Alt', 'KeyA')
  // The Weather window asks a (pretend) service first; a screenshot of a spinner shows nothing.
  await page.waitForFunction(() => !document.body.innerText.includes('Asking the weather service'), { timeout: 15000 })
  await settle(700)
  return page
}

async function shoot(page, name) {
  await page.screenshot({ path: `${out}/${name}.png` })
  await page.close()
  console.log(`${out}/${name}.png`)
}

await shoot(await arranged(), 'arrange')
await shoot(await arranged({ theme: 'light' }), 'light')
await shoot(await arranged({ look: 'gnome' }), 'look-gnome')
await shoot(await arranged({ look: 'windows' }), 'look-windows')

{
  const page = await open(['rides'])
  const [menu] = await page.$$("xpath/.//button[normalize-space()='Window']")
  await menu.click()
  await settle()
  await shoot(page, 'menus')
}

{
  const page = await open(['rides'])
  await chord(page, mod, 'KeyK')
  await settle()
  await page.keyboard.type('ride')
  await settle()
  await shoot(page, 'search')
}

{
  // A thread, not a greeting: two questions asked, and each answered before the next.
  const page = await open(['chat'])
  for (const [asked, question] of ['How worn is the chain?', 'Is Sunday a good day to ride?'].entries()) {
    await page.type('.desk-composer textarea', question)
    await page.keyboard.press('Enter')
    await page.waitForFunction(
      replies => document.body.innerText.split('Mechanic').length - 1 >= replies,
      { timeout: 15000 },
      asked + 2,
    )
  }
  await settle()
  await shoot(page, 'chat')
}

await browser.close()
