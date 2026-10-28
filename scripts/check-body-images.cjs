// Start npm run dev first. Requires Playwright with Chromium and WebKit installed.
// Run: NODE_PATH=/path/to/node_modules node scripts/check-body-images.cjs
const { chromium, webkit } = require('playwright')
const assert = require('node:assert/strict')

async function check(engine) {
  const browser = await engine.launch({ headless: true })
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
      isMobile: true, hasTouch: true, locale: 'ko-KR',
    })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.route('https://example.test/**', (route) => {
      const portrait = route.request().url().includes('portrait')
      return route.fulfill({ contentType: 'image/svg+xml', body:
        `<svg xmlns="http://www.w3.org/2000/svg" width="${portrait ? 900 : 1600}" height="${portrait ? 1600 : 900}"><rect width="100%" height="100%" fill="${portrait ? '#bd8850' : '#3478f6'}"/></svg>`,
      })
    })
    await page.goto('http://127.0.0.1:5173/body-image-check.html')
    const images = page.locator('.inline-markdown-content img[src]')
    await images.nth(1).waitFor()
    const dimensions = await images.evaluateAll((items) => items.map((image) => {
      const rect = image.getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    }))
    assert.deepEqual(dimensions, [{ width: 104, height: 104 }, { width: 104, height: 104 }])
    assert.equal(await page.locator('img[data-lexical-managed-linebreak][role="button"]').count(), 0)
    if (engine === webkit) {
      assert(await page.locator('img[data-lexical-managed-linebreak]').count() > 0)
      const sizes = await page.locator('img[data-lexical-managed-linebreak]').evaluateAll((items) => items.map((image) => image.getBoundingClientRect().width))
      assert(sizes.every((width) => width === 0), 'Safari layout images must remain zero-width')
    }
    assert.equal(await page.evaluate(() => innerWidth), 390, 'Page must fit the mobile viewport')
    const hitArea = await page.locator('.body-image-delete').first().boundingBox()
    assert.equal(hitArea.width, 44)
    assert.equal(hitArea.height, 44)
    await images.first().tap({ position: { x: 20, y: 60 } })
    await page.locator('dialog[open]').waitFor()
    assert.equal(await page.locator('.gallery-count').textContent(), '1 / 2')
    await page.getByRole('button', { name: '다음 이미지', exact: true }).tap()
    assert.equal(await page.locator('.gallery-count').textContent(), '2 / 2')
    assert((await page.locator('dialog img').boundingBox()).height > 104)
    await page.getByRole('button', { name: '닫기', exact: true }).tap()

    let pendingDialog = page.waitForEvent('dialog')
    let pendingTap = page.locator('.body-image-delete').first().tap()
    let confirmation = await pendingDialog
    assert.equal(confirmation.message(), '이 이미지를 본문에서 삭제할까요?')
    await confirmation.dismiss()
    await pendingTap
    assert.equal(await images.count(), 2, 'Cancel must keep the image')
    pendingDialog = page.waitForEvent('dialog')
    pendingTap = page.locator('.body-image-delete').first().tap()
    confirmation = await pendingDialog
    await confirmation.accept()
    await pendingTap
    await page.waitForFunction(() => !document.querySelector('#markdown').textContent.includes('landscape'))
    assert.equal(await images.count(), 1, 'Confirm removes only the chosen image')
    assert((await page.locator('#markdown').textContent()).includes('portrait'))
    const pendingChooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: '이미지 넣기', exact: true }).tap()
    await (await pendingChooser).setFiles([])
    assert.deepEqual(errors, [])
    console.log(`PASS ${engine.name()}: mobile thumbnails, Safari layout images, gallery, delete confirmation/cancel 44px button and native file picker`)
  } finally {
    await browser.close()
  }
}
;(async () => { for (const engine of [chromium, webkit]) await check(engine) })()
  .catch((error) => { console.error(error); process.exitCode = 1 })
