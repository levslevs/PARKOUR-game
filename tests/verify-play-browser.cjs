#!/usr/bin/env node
'use strict';
// Replays verified routes with actual browser keyboard and pad event handling.
// Chrome's pad replay uses native multi-touch through CDP; WebKit uses PointerEvents.
const {chromium,webkit}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const reports=path.resolve(process.env.PARKOUR_REPORT_DIR||path.join(__dirname,'reports'));
const routeFile=path.resolve(process.env.PARKOUR_LEVEL_REPORT||path.join(reports,'level-validation-report.json'));
if(!fs.existsSync(routeFile))throw Error('Run validate-levels.cjs first and set PARKOUR_LEVEL_REPORT to its JSON report.');
const routes=JSON.parse(fs.readFileSync(routeFile,'utf8')).reports.filter(r=>r.route==='main-with-pickups-and-enemies');
assert.equal(routes.length,5,'expected one natural main route per round');
const source=fs.readFileSync(process.argv[2]||path.join(root,'parkour-enemies.html'),'utf8');
assert(source.includes("advanceClock(typeof time==='number'?time:performance.now());"));
const html=source.replace("advanceClock(typeof time==='number'?time:performance.now());",'/* replay owns the simulation clock */')
 .replace('renderFrame(gameInputBlocked()?1:frameRemainder/(1000/60))','renderFrame(1)')
 .replace('/* ---------- boot ---------- */',`window.__playQA={
  startRound,gameInputBlocked,
  step(n){for(let i=0;i<n;i++){captureRenderState();update();}renderFrame(1);},
  snap(){return JSON.parse(JSON.stringify({p:G.p,round:G.round,hearts:G.hearts,speedT:G.speedT,jumpT:G.jumpT,mode:G.mode,enemies:G.lvl&&G.lvl.enemies,keys,cam:G.cam}));}
 }; /* ---------- boot ---------- */`);
fs.mkdirSync(reports,{recursive:true});
function descendants(){
 if(process.platform==='win32')return []; // RSS sampling is optional on Windows.
 const rows=execFileSync('ps',['-axo','pid=,ppid=,rss=,comm='],{encoding:'utf8'}).trim().split('\n').map(line=>{const m=line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);return m?{pid:+m[1],ppid:+m[2],rssKiB:+m[3],command:m[4]}:null;}).filter(Boolean);
 const found=new Set([process.pid]);let changed=true;
 while(changed){changed=false;for(const row of rows)if(found.has(row.ppid)&&!found.has(row.pid)){found.add(row.pid);changed=true;}}
 return rows.filter(row=>row.pid!==process.pid&&found.has(row.pid)&&!/\/ps$|^ps$/.test(row.command));
}
async function run(engine){let browser;const result={engine,routes:[],memoryBatches:[]};
 try{
  const options={headless:true};if(engine==='Chrome'&&process.env.PW_CHROMIUM_EXECUTABLE)options.executablePath=process.env.PW_CHROMIUM_EXECUTABLE;
  browser=await(engine==='WebKit'?webkit:chromium).launch(options);
  const context=await browser.newContext({viewport:{width:820,height:1180},screen:{width:820,height:1180},deviceScaleFactor:1,isMobile:true,hasTouch:true,
   userAgent:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'});
  await context.addInitScript(()=>{
   Object.defineProperty(window.screen,'width',{get:()=>window.__screenWidth||820});Object.defineProperty(window.screen,'height',{get:()=>window.__screenHeight||1180});
   localStorage.removeItem('parkourEnemies');window.__unhandled=[];addEventListener('unhandledrejection',e=>window.__unhandled.push(String(e.reason)));
  });
  await context.route('**/*',route=>{const u=new URL(route.request().url());
   if(/\.(png|webp)$/.test(u.pathname))return route.fulfill({path:path.join(root,'assets',path.basename(u.pathname))});
   if(u.pathname.endsWith('analytics.js'))return route.fulfill({body:''});return route.fulfill({contentType:'text/html',body:html});});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://parkour-play.test/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!document.getElementById('btnPlay').disabled);
  const step=n=>page.evaluate(n=>window.__playQA.step(n),n),snap=()=>page.evaluate(()=>window.__playQA.snap());
  const pointer=async(id,type,pointerId=1)=>page.locator('#'+id).dispatchEvent(type,{pointerId,pointerType:'touch',isPrimary:pointerId===1,button:0,bubbles:true,cancelable:true});
  await page.locator('#btnPlay').tap();await step(3);
  for(const[width,height]of [[744,1133],[820,1180],[1133,744],[1180,820],[1366,1024]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(30);
   const state=await page.evaluate(()=>({rotate:!document.getElementById('rotateScreen').hidden,overflow:document.documentElement.scrollWidth>innerWidth,
    rects:['padL','padR','padJ'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};})}));
   assert(!state.rotate&&!state.overflow,engine+' tablet layout');
   for(const r of state.rects){assert(r.w>=64&&r.h>=64,engine+' tablet target '+r.id);assert(r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1,engine+' tablet clipped '+r.id);}
  }
  result.ipadSizes=5;await page.setViewportSize({width:1180,height:820});await page.waitForTimeout(30);
  const cdp=engine==='Chrome'?await context.newCDPSession(page):null;
  const held={left:false,right:false,jump:false},ids={left:'padL',right:'padR',jump:'padJ'},pids={left:1,right:2,jump:3},points={};
  async function positions(){for(const k of Object.keys(ids)){const b=await page.locator('#'+ids[k]).boundingBox();assert(b,'visible pad '+k);points[k]={x:b.x+b.width/2,y:b.y+b.height/2,id:pids[k]};}}
  async function touch(k,down){
   if(held[k]===down)return;
   if(cdp){
    held[k]=down;
    await cdp.send('Input.dispatchTouchEvent',{type:down?'touchStart':'touchEnd',touchPoints:down?Object.keys(held).filter(k=>held[k]).map(k=>points[k]):[points[k]]});
   }else{await pointer(ids[k],down?'pointerdown':'pointerup',pids[k]);held[k]=down;}
  }
  async function clearTouch(){if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});else for(const k of Object.keys(held))if(held[k])await pointer(ids[k],'pointercancel',pids[k]);for(const k of Object.keys(held))held[k]=false;}
  await positions();await touch('right',true);await step(12);const moved=await snap();await touch('jump',true);await step(8);const jumped=await snap();
  assert(jumped.keys.right&&jumped.keys.jump&&jumped.p.x>moved.p.x&&jumped.p.y<moved.p.y);
  await touch('jump',false);assert((await snap()).keys.right&&!(await snap()).keys.jump);await clearTouch();
  if(cdp){
   await touch('right',true);await touch('jump',true);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...points.right,x:points.right.x+100,y:points.right.y-100},points.jump]});
   assert((await snap()).keys.right);await touch('jump',false);assert((await snap()).keys.right);await clearTouch();assert(!(await snap()).keys.right);
  }
  result.simultaneousTouch=cdp?'native browser multitouch':'DOM PointerEvent handlers';
  // Mixed ownership uses native keyboard events and the selected engine's touch route.
  await page.locator('#game').focus();await page.keyboard.down('ArrowRight');await touch('right',true);await touch('right',false);
  assert((await snap()).keys.right,'touch release canceled keyboard');await page.keyboard.up('ArrowRight');assert(!(await snap()).keys.right);
  await touch('right',true);await page.keyboard.down('ArrowRight');await page.keyboard.up('ArrowRight');assert((await snap()).keys.right,'keyboard release canceled touch');await clearTouch();assert(!(await snap()).keys.right);
  await page.keyboard.down('ArrowRight');await page.keyboard.down('d');await page.keyboard.up('d');assert((await snap()).keys.right);await page.keyboard.up('ArrowRight');
  result.mixedInputOwnership='passed';
  // Native button activation must return keyboard control to the game.
  await page.evaluate(()=>window.__playQA.startRound(1));await step(3);
  await page.locator('#btnGameSound').tap();
  assert.equal(await page.evaluate(()=>document.activeElement.id),'game','sound button retained keyboard focus');
  const beforeSoundMove=await snap();await page.keyboard.down('ArrowRight');await page.keyboard.down('Space');await step(3);
  const afterSoundMove=await snap();assert(afterSoundMove.p.x>beforeSoundMove.p.x&&afterSoundMove.p.y<beforeSoundMove.p.y);
  await page.keyboard.up('Space');await page.keyboard.up('ArrowRight');await page.locator('#btnGameSound').tap();
  result.soundReturnsKeyboardFocus='passed';
  await page.keyboard.down('Escape');assert(await page.locator('#pauseScreen').isVisible());
  const escapePaused=await snap();
  for(let repeat=0;repeat<4;repeat++)await page.keyboard.down('Escape');
  await step(60);assert(await page.locator('#pauseScreen').isVisible());assert.deepEqual(await snap(),escapePaused);
  await page.keyboard.up('Escape');await page.keyboard.press('Escape');assert(!(await page.locator('#pauseScreen').isVisible()));
  assert.equal(await page.evaluate(()=>document.activeElement.id),'game');result.heldEscapeDoesNotToggle='passed';
  await touch('right',true);await touch('jump',true);await step(2);await page.locator('#btnPause').tap();const paused=await snap();await step(120);assert.deepEqual(await snap(),paused);await clearTouch();
  await page.locator('#btnResume').tap();assert(!(await snap()).keys.right&&!(await snap()).keys.jump);
  await page.evaluate(()=>{window.__screenWidth=390;window.__screenHeight=844;});await page.setViewportSize({width:390,height:844});await page.locator('#rotateScreen').waitFor({state:'visible'});
  const rotated=await snap();await step(120);assert.deepEqual(await snap(),rotated);assert(await page.locator('#wrap').evaluate(e=>e.inert));
  for(const[width,height]of [[844,390],[667,375],[932,430]]){
   await page.setViewportSize({width,height});await page.locator('#rotateScreen').waitFor({state:'hidden'});
   if(await page.locator('#btnResume').isVisible())await page.locator('#btnResume').tap();
   const boxes=await page.evaluate(()=>['padL','padR','padJ','game'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}));
   for(const r of boxes){assert(r.x>=-1&&r.y>=-1&&r.right<=width+1&&r.bottom<=height+1,engine+' phone bounds '+JSON.stringify(r));if(r.id!=='game')assert(r.w>=56&&r.h>=56);}
  }
  result.pauseAndRotateFreeze='passed';result.phoneSizes=3;
  await page.evaluate(()=>{window.__screenWidth=820;window.__screenHeight=1180;});await page.setViewportSize({width:1180,height:820});await page.waitForTimeout(30);
  for(const mode of ['keyboard','touch']){
   const heldKeys={left:false,right:false,jump:false},keyboard={left:'ArrowLeft',right:'ArrowRight',jump:'Space'};
   for(const route of routes){
    await page.evaluate(round=>window.__playQA.startRound(round),route.round);await step(3);await positions();
    let replayFrames=0;
    for(const leg of route.legs){for(const command of leg.inputs){
      for(const k of Object.keys(heldKeys)){
       if(mode==='touch'){await touch(k,!!command[k]);}
       else if(heldKeys[k]!==!!command[k]){await page.keyboard[command[k]?'down':'up'](keyboard[k]);heldKeys[k]=!!command[k];}
      }
      await step(command.frames);replayFrames+=command.frames;
     }
     const state=await snap();assert(state.hearts>=3,engine+' '+mode+' round '+route.round+' lost life');
     if(leg.landing){assert(Math.abs(state.p.x-leg.landing.x)<.001,engine+' '+mode+' round '+route.round+' landing X mismatch');assert(Math.abs(state.p.y-leg.landing.y)<.001,engine+' '+mode+' round '+route.round+' landing Y mismatch');}
    }
    const state=await snap();assert.equal(state.mode,route.round===5?'win':'clear');
    if(mode==='touch')await clearTouch();else for(const k of Object.keys(heldKeys))if(heldKeys[k]){await page.keyboard.up(keyboard[k]);heldKeys[k]=false;}
    result.routes.push({round:route.round,input:mode,frames:replayFrames,hearts:state.hearts,result:state.mode});
    console.log('PASS '+engine+' '+mode+' round '+route.round+' ('+replayFrames+' updates)');
   }
   const processes=descendants();result.memoryBatches.push({after:mode+' five-level batch',processes:processes.length,rssMiB:Math.round(processes.reduce((n,p)=>n+p.rssKiB,0)/1024)});
  }
  await page.setViewportSize({width:844,height:390});await page.locator('#win [data-back]').tap();await page.locator('#btnHelp').tap();assert(await page.locator('#help').isVisible());
  await page.getByRole('button',{name:'Close how to play',exact:true}).tap();await page.locator('#btnShop').tap();assert.equal(await page.locator('#shopGrid .skin').count(),6);
  assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.__unhandled),[]);result.errors=errors;
  return result;
 }finally{if(browser)await browser.close();result.childProcessesAfterClose=descendants();}
}
(async()=>{const results=[];for(const engine of(process.env.PARKOUR_BROWSER_ENGINES||'WebKit,Chrome').split(','))results.push(await run(engine));
 fs.writeFileSync(path.join(reports,'play-browser-report.json'),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify({completedRoutes:results.reduce((n,r)=>n+r.routes.length,0),engines:results.map(r=>r.engine),results}));
})().catch(error=>{console.error(error);process.exitCode=1;});
