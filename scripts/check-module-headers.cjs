// Start npm run dev first. Run with Playwright available in NODE_PATH.
const { chromium, webkit } = require('playwright')
const assert = require('node:assert/strict')

async function check(engine) {
  const browser = await engine.launch({ headless: true })
  try {
    const page = await browser.newPage()
    const user = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'test@example.test', user_metadata: {} }
    const folderId = '00000000-0000-4000-8000-000000000002'
    await page.addInitScript((user) => {
      localStorage.setItem('life-locale', 'en')
      const payload = btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }))
      localStorage.setItem('sb-pbmzjxjtctwhgxxbcgxl-auth-token', JSON.stringify({
        access_token: `e30.${payload}.fake`, refresh_token: 'fake', expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600, token_type: 'bearer', user,
      }))
    }, user)
    await page.route('**/auth/v1/user', (route) => route.fulfill({ json: user }))
    await page.route('**/rest/v1/**', (route) => {
      const table = new URL(route.request().url()).pathname.split('/').pop()
      const json = table === 'life_note_folders' ? [{ id: folderId, user_id: user.id, name: '수능', parent_id: null }]
        : table === 'life_user_prefs' ? { user_id: user.id, prefs: { locale: 'en' } } : []
      return route.fulfill({ json })
    })
    const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5173'
    const routes = ['/settings/cards', `/notes?folder=${folderId}`, '/assets/history', '/notes', '/plans', '/journal', '/goals', '/projects', '/clipboard', '/assets', '/settings']
    for (const width of [390, 799, 800, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      for (const path of routes) {
        await page.goto(`${base}${path}`)
        await page.locator('.module-heading h1').waitFor()
        if (path.includes('folder=')) await page.locator('.notes-path').getByText('수능', { exact: true }).waitFor()
        const layout = await page.locator('.module-header').evaluate((header) => {
          const back = header.querySelector('.back-link')
          const heading = header.querySelector('.module-heading')
          const rect = (el) => { const { x, y, width, height } = el.getBoundingClientRect(); return { x, y, width, height } }
          return { back: getComputedStyle(back).display === 'none' ? null : rect(back), heading: rect(heading) }
        })
        const { back, heading } = layout
        if (back) assert.ok(back.y + back.height <= heading.y || back.x + back.width <= heading.x,
          `${engine.name()} ${width}px ${path}: back button overlaps heading`)
        else assert.ok(width >= 800 && !path.includes('folder='), `${path}: unexpected hidden back button`)
      }
    }
    console.log(`${engine.name()}: 11 headers × 5 viewport widths passed`)
  } finally { await browser.close() }
}
;(async () => { await check(chromium); await check(webkit) })().catch((error) => { console.error(error); process.exitCode = 1 })
