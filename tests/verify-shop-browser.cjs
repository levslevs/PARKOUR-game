#!/usr/bin/env node
'use strict';
// Real browser checks for shopping, retained runs, focus and compact touch layouts.
// npm install --no-save playwright; node scripts/parkour/verify-shop-browser.cjs
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
const characters=JSON.parse(fs.readFileSync(path.join(root,'src/characters.json'),'utf8'));
const price=id=>characters.find(s=>s.id===id).price;
const startingCoins=price('frog')+price('star')+2;
const reports=path.resolve(process.env.PARKOUR_REPORT_DIR||path.join(__dirname,'reports'));
const embeddedSource=fs.readFileSync(path.join(root,'parkour-enemies.html'),'utf8');
// Network fault tests replace only embedded image URLs; the game code is unchanged.
const source=embeddedSource.replace(/  var ASSET_SRC = (\{[^\n]+\});/,function(_,encoded){
 const ids=Object.keys(JSON.parse(encoded));return '  var ASSET_SRC = '+JSON.stringify(Object.fromEntries(ids.map(id=>[id,'/assets/'+id+'.png'])))+';';
});
const html=source.replace("advanceClock(typeof time==='number'?time:performance.now());",'/* deterministic UI audit clock */')
.replace('/* ---------- boot ---------- */',`window.__shopQA={G,save,step(n){for(let i=0;i<n;i++)update();draw();},snapshot(){return JSON.parse(JSON.stringify({mode:G.mode,round:G.round,p:G.p,coins:save.coins,skin:save.skin}));}}; /* ---------- boot ---------- */`);
fs.mkdirSync(reports,{recursive:true});
async function run(engine){let browser;
try{
 const options={headless:true};if(engine==='Chrome'&&process.env.PW_CHROMIUM_EXECUTABLE)options.executablePath=process.env.PW_CHROMIUM_EXECUTABLE;
 browser=await(engine==='WebKit'?webkit:chromium).launch(options);
 const context=await browser.newContext({viewport:{width:1280,height:900},screen:{width:820,height:1180},deviceScaleFactor:1,isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
 await context.addInitScript(wallet=>{
  localStorage.setItem('parkourEnemies',JSON.stringify({coins:wallet,owned:['blue'],skin:'blue',best:1}));
  // Split View changes the viewport, not the iPad's physical screen.
  Object.defineProperty(window.screen,'width',{get:()=>820});Object.defineProperty(window.screen,'height',{get:()=>1180});
 },startingCoins);
 const page=await context.newPage(),errors=[];let failBlue=false;page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(failBlue&&/\/blue\.(png|webp)$/.test(u.pathname)){failBlue=false;return route.fulfill({status:404,body:'QA image failure'});}if(/\.(png|webp)$/.test(u.pathname))return route.fulfill({path:path.join(root,'assets',path.basename(u.pathname))});if(u.pathname.endsWith('analytics.js'))return route.fulfill({body:''});return route.fulfill({contentType:'text/html',body:html});});
 await page.goto('http://parkour-ui.test/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!document.getElementById('btnPlay').disabled);
 await page.screenshot({path:path.join(reports,engine+'-menu-desktop.png')});
 assert.match(await page.locator('#btnShop').innerText(),/Character shop/);await page.locator('#btnWalletShop').tap();assert(await page.locator('#shop').isVisible());
 await page.screenshot({path:path.join(reports,engine+'-shop-desktop.png')});
 await page.locator('[data-skin="frog"]').focus();await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>window.__shopQA.save.coins),startingCoins-price('frog'));assert.equal(await page.evaluate(()=>document.activeElement.dataset.skin),'frog');assert.match(await page.locator('[data-skin="frog"] .pr').innerText(),/Selected/);
 await page.locator('[data-skin="king"]').tap();assert.equal(await page.evaluate(()=>window.__shopQA.save.coins),startingCoins-price('frog'));assert.match(await page.locator('#shopStatus').innerText(),new RegExp((price('king')-(startingCoins-price('frog')))+' more coins'));
 await page.locator('#btnCloseShop').tap();assert(await page.locator('#menu').isVisible());
 await page.locator('#btnPlay').focus();await page.keyboard.press('Space');await page.waitForFunction(()=>window.__shopQA.G.mode==='play');await page.evaluate(()=>window.__shopQA.step(5));
 await page.locator('#btnPause').tap();const before=await page.evaluate(()=>window.__shopQA.snapshot());await page.locator('#btnPauseShop').tap();
 await page.locator('[data-skin="star"]').tap();assert.equal(await page.evaluate(()=>window.__shopQA.save.coins),2);await page.locator('#btnCloseShop').tap();assert(await page.locator('#pauseScreen').isVisible());
 const after=await page.evaluate(()=>window.__shopQA.snapshot());assert.deepEqual(after.p,before.p);assert.equal(after.round,before.round);assert.equal(after.skin,'star');
 await page.locator('#btnResume').tap();assert(!(await page.locator('#pauseScreen').isVisible()));
 for(const [width,height]of [[600,601],[600,640],[507,1024],[744,1133]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(100);assert(!(await page.locator('#rotateScreen').isVisible()),engine+' tablet split view blocked');
  const rects=await page.evaluate(()=>['padL','padR','padJ'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
  for(const r of rects)assert(r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1,engine+' clipped '+JSON.stringify(r));
  if(width===507||height===601)await page.screenshot({path:path.join(reports,engine+'-portrait-'+width+'x'+height+'.png')});
 }
 await page.setViewportSize({width:568,height:320});await page.waitForTimeout(100);await page.locator('#btnPause').tap();
 for(const id of ['btnResume','btnPauseShop','btnPauseMenu']){const r=await page.locator('#'+id).boundingBox();assert(r&&r.x>=0&&r.y>=0&&r.x+r.width<=569&&r.y+r.height<=321,engine+' small phone pause '+id);}
 await page.screenshot({path:path.join(reports,engine+'-pause-small-phone.png')});
 await page.locator('#btnPauseShop').tap();const balance=await page.locator('#shop .collection-meta').boundingBox();await page.locator('#shop .sheetBody').evaluate(e=>e.scrollTop=e.scrollHeight);const balanceAfter=await page.locator('#shop .collection-meta').boundingBox();assert.equal(balance.y,balanceAfter.y);
 const back=await page.locator('#btnCloseShop').boundingBox();assert(back.y>=0&&back.y+back.height<=321);await page.screenshot({path:path.join(reports,engine+'-shop-small-phone.png')});
 await page.locator('#btnCloseShop').tap();await page.locator('#btnPauseMenu').tap();assert(await page.locator('#menu').isVisible());assert.equal(await page.evaluate(()=>window.__shopQA.save.coins),2);assert.equal(await page.evaluate(()=>window.__shopQA.G.lvl),null);
 failBlue=true;await page.goto('http://parkour-ui.test/recovery',{waitUntil:'domcontentloaded'});await page.locator('#btnRetryAssets').waitFor({state:'visible'});
 await page.screenshot({path:path.join(reports,engine+'-loading-recovery-small-phone.png')});await page.locator('#btnShop').tap();assert(await page.locator('#shop').isVisible());await page.locator('#btnCloseShop').tap();await page.locator('#btnRetryAssets').tap();await page.waitForFunction(()=>!document.getElementById('btnPlay').disabled);
 assert.deepEqual(errors,[]);return{engine,selectedImageFailureRecovery:'passed',purchaseAndBalance:'passed',insufficientCoins:'passed',keyboardSpacePlay:'passed',focusAfterPurchase:'passed',pausedRunRetained:'passed',portraitLayouts:4,smallPhonePauseAndShop:'passed',errors};
}finally{if(browser)await browser.close();}}
(async()=>{const results=[];for(const engine of (process.argv.includes('--webkit-only')?['WebKit']:['WebKit','Chrome'])){const r=await run(engine);results.push(r);console.log(JSON.stringify(r));}fs.writeFileSync(path.join(reports,'shop-browser-report.json'),JSON.stringify(results,null,2));})().catch(e=>{console.error(e);process.exitCode=1;});
