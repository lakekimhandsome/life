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
 await page.setViewportSize({width,height:900});
 for (const theme of ['light','dark']) {
 await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
 for (const size of [16,20]) {
 for (const stretched of [false,true]) {
 const measurement=await page.locator('.saving-spinner').evaluate((el,{size,stretched})=>{
 const svg=el.querySelector('svg');svg.setAttribute('width',String(size));svg.setAttribute('height',String(size));
 // Extra wrapper space must never move the SVG rotation axis.
 el.style.width=stretched?'30px':'';el.style.height=stretched?'28px':'';
 const animations=el.getAnimations({subtree:true});
 const animation=animations[0];if(!animation)throw new Error('Missing rotation animation');animation.pause();
 const frames=[];
 for(let i=0;i<=16;i++){
 animation.currentTime=animation.effect.getTiming().duration*i/16;
 const center=new DOMPoint(12,12).matrixTransform(svg.getScreenCTM());
 const rect=svg.getBoundingClientRect();
 frames.push({x:center.x,y:center.y,boxX:rect.x+rect.width/2,boxY:rect.y+rect.height/2});
 }
 return frames;
 },{size,stretched});
 const start=measurement[0];
 const drift=Math.max(...measurement.map(p=>Math.hypot(p.x-start.x,p.y-start.y)));
 const offset=Math.max(...measurement.map(p=>Math.hypot(p.x-p.boxX,p.y-p.boxY)));
 assert(drift<0.01,`Rotation axis drifted ${drift}px`);
 assert(offset<0.01,`SVG center differs from viewport center by ${offset}px`);
 console.log(`${width}px ${theme} ${size}px stretched=${stretched}: drift=${drift.toFixed(6)}px`);
 }
 }
 }
 }
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.saving-spinner').evaluate(el=>el.getAnimations({subtree:true}).length),0);
 console.log('Reduced motion: no rotation');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
