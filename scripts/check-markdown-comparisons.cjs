// Start npm run dev first. Run with Playwright available via NODE_PATH.
const { chromium, webkit } = require('playwright')
const assert = require('node:assert/strict')

async function check(engine) {
  const browser = await engine.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'}/code-editor-check.html`)
    const editor = page.getByRole('region', { name: 'Comparison check' }).locator('[contenteditable="true"]')
    await editor.waitFor()
    assert.equal(await editor.innerText(), 'η<0.3이면 x>1.5W\n\nx<3.75W → η>0.15')
    assert(!await page.locator('output').innerText().then((text) => text.includes('Error parsing markdown')))
    assert.deepEqual(errors, [])
    console.log(`${engine.name()}: comparisons render without parsing errors`)
  } finally {
    await browser.close()
  }
}

;(async () => {
  await check(chromium)
  await check(webkit)
})().catch((error) => { console.error(error); process.exitCode = 1 })
