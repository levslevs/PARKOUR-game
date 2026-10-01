#!/usr/bin/env node
'use strict';
// Genuine image/network loading and boot, with one page per engine and guaranteed cleanup.
// NODE_PATH may point to an existing Playwright install; no test runner is required.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const root=path.resolve(__dirname,'..');
const target=path.resolve(process.argv[2]||path.join(root,'parkour-enemies.html'));
const reports=path.resolve(process.env.PARKOUR_REPORT_DIR||path.join(__dirname,'reports'));
const embeddedSource=fs.readFileSync(target,'utf8');
// Network fault tests replace only embedded image URLs; the game code is unchanged.
const source=embeddedSource.replace(/  var ASSET_SRC = (\{[^\n]+\});/,function(_,encoded){
 const ids=Object.keys(JSON.parse(encoded));return '  var ASSET_SRC = '+JSON.stringify(Object.fromEntries(ids.map(id=>[id,'/assets/'+id+'.png'])))+';';
});
const probe=`window.__assetQA={
  state(){return {mode:G.mode,skin:save.skin,assets:Object.fromEntries(Object.entries(CHARACTER_ART).map(([id,a])=>[id,{status:a.status||'idle',width:a.image?a.image.naturalWidth:0}]))};},
  captureCallbacks(id){var image=CHARACTER_ART[id].image;window.__retiredImageCallbacks={load:image.onload,error:image.onerror};},
  retiredHandlersCleared(id){var image=CHARACTER_ART[id].image;return image.onload===null&&image.onerror===null;},
  invokeRetired(){var retired=window.__retiredImageCallbacks;retired.load(new Event('load'));retired.error(new Event('error'));}
}; /* ---------- boot ---------- */`;
assert(source.includes('/* ---------- boot ---------- */'),'missing boot marker');
const instrumented=source.replace('/* ---------- boot ---------- */',probe);
fs.mkdirSync(reports,{recursive:true});
async function run(engine){let browser,active;
  const results=[];
  try {
    const options={headless:true};
    if(engine==='Chrome'&&process.env.PW_CHROMIUM_EXECUTABLE)options.executablePath=process.env.PW_CHROMIUM_EXECUTABLE;
    browser=await(engine==='WebKit'?webkit:chromium).launch(options);
    const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1});
    await context.addInitScript(()=>{
      window.__unhandledAssetErrors=[];
      window.addEventListener('unhandledrejection',event=>window.__unhandledAssetErrors.push(String(event.reason)));
    });
    const page=await context.newPage();
    page.on('pageerror',error=>{if(active)active.errors.push(error.message);});
    await context.route('**/*',async route=>{
      const fixture=active,u=new URL(route.request().url());
      try {
        if(/\.(png|webp)$/.test(u.pathname)){
          const id=path.basename(u.pathname).replace(/\.(png|webp)$/,'');
          fixture.requests.push(id);fixture.attempts[id]=(fixture.attempts[id]||0)+1;
          const policy=fixture.policy(id,fixture.attempts[id]);
          if(policy==='hold'){fixture.held.push({id,route});return;}
          if(policy==='404'){await route.fulfill({status:404,contentType:'text/plain',body:'Intentional missing image fixture'});return;}
          await route.fulfill({path:path.join(root,'assets',path.basename(u.pathname))});return;
        }
        if(u.pathname.endsWith('analytics.js')){await route.fulfill({body:''});return;}
        const seed='<script>localStorage.setItem("parkourEnemies",'+JSON.stringify(JSON.stringify(fixture.save))+');</script>';
        await route.fulfill({contentType:'text/html',body:instrumented.replace('<head>','<head>'+seed)});
      } catch(error) {
        // A timed-out Image deliberately cancels its network request; completing that retired route is harmless.
        if(!fixture.closing&&!fixture.retired&&!/closed|cancelled|canceled|intercept|already handled/i.test(error.message))fixture.routeErrors.push(error.message);
      }
    });
    async function begin(name,policy,save={coins:0,owned:['blue'],skin:'blue',best:1}){
      if(active){active.closing=true;for(const held of active.held)await held.route.abort().catch(()=>{});}
      active={name,policy,save,requests:[],attempts:{},held:[],errors:[],routeErrors:[],closing:false,retired:false};
      await page.goto('http://parkour-assets.test/'+encodeURIComponent(name),{waitUntil:'domcontentloaded'});
    }
    async function ready(){await page.waitForFunction(()=>!document.getElementById('btnPlay').disabled);}
    async function held(id){await page.waitForFunction(id=>window.__assetQA?.state().assets[id].status==='loading',id);assert(active.held.some(x=>x.id===id));}
    async function release(id){const index=active.held.findIndex(x=>x.id===id);assert(index>=0,'no pending image '+id);const item=active.held.splice(index,1)[0];await item.route.fulfill({path:path.join(root,'assets',id+'.png')}).catch(error=>{if(!active.retired)throw error;});}
    async function finish(evidence={}){
      await page.waitForTimeout(50);
      assert.deepEqual(active.errors,[],active.name+' runtime errors');assert.deepEqual(active.routeErrors,[],active.name+' route errors');
      assert.deepEqual(await page.evaluate(()=>window.__unhandledAssetErrors),[],active.name+' rejected promises');
      const result={name:active.name,passed:true,...evidence};results.push(result);console.log('PASS '+engine+' '+active.name);
    }

    await begin('Optional king 404 never blocks play',id=>id==='king'?'404':'ok');
    await ready();await page.waitForFunction(()=>window.__assetQA.state().assets.king.status==='error');
    await page.locator('#btnPlay').click();assert.equal(await page.evaluate(()=>window.__assetQA.state().mode),'play');
    await finish({king:'error',playable:true});

    await begin('Pending optional king never blocks play',id=>id==='king'?'hold':'ok');
    await ready();await held('king');await page.locator('#btnPlay').click();
    assert.equal(await page.evaluate(()=>window.__assetQA.state().mode),'play');
    await finish({king:'loading',playable:true});

    await begin('Primary hero failure retries successfully',(id,attempt)=>id==='blue'&&attempt===1?'404':'ok');
    await page.waitForFunction(()=>window.__assetQA.state().assets.blue.status==='error');
    assert(await page.locator('#btnPlay').isDisabled());assert(await page.locator('#btnRetryAssets').isVisible());
    assert.match(await page.locator('#assetStatus').innerText(),/could not load/);
    await page.locator('#btnRetryAssets').click();await ready();
    assert(!(await page.locator('#btnRetryAssets').isVisible()));assert(!(await page.locator('#assetStatus').isVisible()));
    await page.locator('#btnPlay').click();assert.equal(await page.evaluate(()=>window.__assetQA.state().mode),'play');
    await finish({blueAttempts:active.attempts.blue,playable:true});

    await begin('Saved hero loads first and Help is safe before its image arrives',id=>id==='fox'?'hold':'ok',
      {coins:12,owned:['blue','fox'],skin:'fox',best:2});
    await held('fox');assert.deepEqual(active.requests,['fox']);assert(await page.locator('#btnPlay').isDisabled());
    await page.locator('#btnHelp').click();assert(await page.locator('#help').isVisible());
    assert.equal(await page.evaluate(()=>window.__assetQA.state().mode),'help');
    await page.getByRole('button',{name:'Close how to play',exact:true}).click();await release('fox');await ready();
    assert.equal(await page.evaluate(()=>window.__assetQA.state().skin),'fox');
    await finish({firstRequested:'fox',helpDuringLoading:true});

    await begin('Timed out image callbacks cannot corrupt a successful retry',(id,attempt)=>id==='blue'&&attempt===1?'hold':'ok');
    await held('blue');await page.evaluate(()=>window.__assetQA.captureCallbacks('blue'));
    await page.waitForFunction(()=>window.__assetQA.state().assets.blue.status==='error',null,{timeout:16000});
    assert(await page.locator('#btnRetryAssets').isVisible());assert(await page.locator('#btnPlay').isDisabled());
    assert.equal(await page.evaluate(()=>window.__assetQA.retiredHandlersCleared('blue')),true);
    active.retired=true;await release('blue');
    await page.evaluate(()=>window.__assetQA.invokeRetired());
    assert.equal(await page.evaluate(()=>window.__assetQA.state().assets.blue.status),'error');
    await page.locator('#btnRetryAssets').click();await ready();
    await page.evaluate(()=>window.__assetQA.invokeRetired());
    assert.equal(await page.evaluate(()=>window.__assetQA.state().assets.blue.status),'ready');
    assert(!(await page.locator('#btnRetryAssets').isVisible()));
    await finish({timeoutMs:12000,lateCallbacksIgnored:true,retry:'ready'});
    return {engine,passed:results.length,results};
  } finally {
    if(active)active.closing=true;
    if(browser)await browser.close();
  }
}
(async()=>{
  const reportsByEngine=[];
  for(const engine of (process.env.PARKOUR_BROWSER_ENGINES||'WebKit,Chrome').split(','))reportsByEngine.push(await run(engine));
  fs.writeFileSync(path.join(reports,'assets-browser-report.json'),JSON.stringify(reportsByEngine,null,2)+'\n');
  console.log(JSON.stringify({passed:reportsByEngine.reduce((n,r)=>n+r.passed,0),engines:reportsByEngine.map(r=>r.engine)}));
})().catch(error=>{console.error(error);process.exitCode=1;});
