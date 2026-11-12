// Run against npm run preview, with Playwright available via NODE_PATH.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {})});
 try {
 const page=await browser.newPage();
 const user={id:'00000000-0000-4000-8000-000000000001',aud:'authenticated',role:'authenticated',email:'test@example.test',user_metadata:{}};
 await page.addInitScript(user=>{localStorage.setItem('life-locale','en');const payload=btoa(JSON.stringify({sub:user.id,exp:Math.floor(Date.now()/1000)+3600}));localStorage.setItem('sb-pbmzjxjtctwhgxxbcgxl-auth-token',JSON.stringify({access_token:`e30.${payload}.fake`,refresh_token:'fake',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user}));},user);
 await page.route('**/auth/v1/user',r=>r.fulfill({json:user}));
 await page.route('**/rest/v1/**',r=>r.request().method()==='GET'?r.fulfill({json:new URL(r.request().url()).pathname.endsWith('life_user_prefs')?{user_id:user.id,prefs:{locale:'en'}}:new URL(r.request().url()).pathname.endsWith('life_objects')?[{id:'00000000-0000-4000-8000-000000000002',user_id:user.id,type:'plan',title:'Measure',body:'',meta:{},visibility:'private',occurred_at:new Date().toISOString(),created_at:new Date().toISOString(),updated_at:new Date().toISOString()}]:[]}):new Promise(()=>{}));
 await page.goto(`${process.env.TEST_BASE_URL || 'http://127.0.0.1:4173'}/object/00000000-0000-4000-8000-000000000002/edit`);
 await page.locator('button[form=edit-object-form]').click();
 await page.locator('.saving-spinner').waitFor();

 for (const width of [390, 1280]) {
  await page.setViewportSize({ width, height: 900 });
  for (const theme of ['light', 'dark']) {
   await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
   for (const size of [16, 20]) {
    for (const stretched of [false, true]) {
     const frames = await page.locator('.saving-spinner').evaluate((el, { size, stretched }) => {
      const svg = el.querySelector('svg');
      const circle = svg.querySelector('circle');
      if (!circle) throw new Error('Expected a fixed circular path');
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      // Parent layout must not change the circle's path during animation.
      el.style.width = stretched ? '30px' : '';
      el.style.height = stretched ? '28px' : '';
      const animation = el.getAnimations({ subtree: true })[0];
      if (!animation) throw new Error('Missing gap animation');
      animation.pause();
      const frames = [];
      for (let i = 0; i <= 16; i++) {
       animation.currentTime = animation.effect.getTiming().duration * i / 16;
       const matrix = circle.getScreenCTM();
       const center = new DOMPoint(circle.cx.baseVal.value, circle.cy.baseVal.value).matrixTransform(matrix);
       const points = Array.from({ length: 64 }, (_, n) => {
        const p = circle.getPointAtLength(circle.getTotalLength() * n / 64).matrixTransform(matrix);
        return [p.x, p.y];
       });
       const rect = circle.getBoundingClientRect();
       frames.push({ center: [center.x, center.y], points,
        bounds: [rect.x, rect.y, rect.width, rect.height],
        gap: getComputedStyle(circle).strokeDashoffset });
      }
      return frames;
     }, { size, stretched });
     const start = frames[0];
     let drift = 0;
     for (const frame of frames) {
      const delta = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
      drift = Math.max(drift, delta(frame.center, start.center), delta(frame.bounds, start.bounds),
       ...frame.points.map((p, i) => delta(p, start.points[i])));
     }
     assert(drift < 0.001, `Circle moved by ${drift}px`);
     assert(new Set(frames.map(frame => frame.gap)).size > 8, 'Gap must move around the fixed circle');
     console.log(`${width}px ${theme} ${size}px stretched=${stretched}: circle drift=${drift.toFixed(6)}px; gap moves`);
    }
   }
  }
 }
 await page.emulateMedia({ reducedMotion: 'reduce' });
 assert.equal(await page.locator('.saving-spinner').evaluate(el => el.getAnimations({ subtree: true }).length), 0);
 console.log('Reduced motion: no animation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
