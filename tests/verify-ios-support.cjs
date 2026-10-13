#!/usr/bin/env node
'use strict';
// Tests the app bridge in the actual built game. --browser also checks WebKit layouts.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {loadGame,clone}=require('./level-harness.cjs');
const root=path.resolve(__dirname,'..');
const args=process.argv.slice(2),htmlPath=path.resolve(args.find(arg=>arg!=='--browser')||path.join(root,'parkour-enemies.html'));
const html=fs.readFileSync(htmlPath,'utf8'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'parkour-ios-test-'));
const results=[];
function test(name,fn){fn();results.push(name);console.log('PASS '+name);}
function fire(target,type,fields={}){
 const event={type,pointerId:1,pointerType:'touch',button:0,preventDefault(){},...fields};
 for(const listener of target.listeners[type]||[])listener(event);
}
function create(options={}){
 const snapshot=options.snapshot||{},native=options.native!==false;
 const init=`<script>
  window.__PARKOUR_IOS__=${native};window.__PARKOUR_ACTIVE__=${options.active!==false};window.__PARKOUR_SAVED__=${JSON.stringify(snapshot)};
  window.innerWidth=820;window.innerHeight=1180;window.screen={width:820,height:1180};navigator.maxTouchPoints=5;
  window.__nativeMessages=[];window.__nativeClasses=[];window.__fullscreenRequests=0;
  document.body.classList.add=function(name){window.__nativeClasses.push(name);};
  document.documentElement.requestFullscreen=function(){window.__fullscreenRequests++;return Promise.resolve();};
  window.webkit={messageHandlers:{parkour:{postMessage:function(message){window.__nativeMessages.push(JSON.parse(JSON.stringify(message)));}}}};
  ${options.storageFails?"localStorage.getItem=function(){throw Error('storage unavailable');};localStorage.setItem=function(){throw Error('storage unavailable');};":''}
 </script>`;
 const filename=path.join(temp,'game-'+Math.random().toString(16).slice(2)+'.html');
 fs.writeFileSync(filename,html.replace('<script>',init+'<script>'));
 const game=loadGame(filename,options.browserSave);
 if(options.play!==false){
  game.startRound(1);
  game.G.lvl.plats=[{x:0,y:438,w:20000,h:16,start:true,route:'main'}];
  game.G.lvl.enemies=[];game.G.lvl.items=[];game.G.lvl.worldW=20000;
  Object.assign(game.G.p,{x:200,y:406,vx:0,vy:0,onGround:true,coyote:6,inv:90,jumpBuffer:0});
 }
 return game;
}
function state(game){return clone({G:game.G,keys:game.keys});}
function messages(game,type){return clone(game.sandbox.__nativeMessages).filter(message=>message.type===type);}

test('native host exposes pause and announces readiness once',()=>{
 const game=create({play:false});
 assert.equal(typeof game.sandbox.parkourNative.pause,'function');
 assert.deepEqual(messages(game,'ready'),[{type:'ready'}]);
 assert(game.sandbox.__nativeClasses.includes('native-ios'));
 assert.equal(game.nodes.get('btnFullscreen').hidden,true);
 game.nodes.get('btnFullscreen').onclick();assert.equal(game.sandbox.__fullscreenRequests,0);
});
test('native pause clears held controls and freezes simulation until user resumes',()=>{
 const game=create();
 fire(game.nodes.get('padR'),'pointerdown',{pointerId:10});fire(game.nodes.get('padJ'),'pointerdown',{pointerId:11});
 game.G.p.jumpBuffer=5;game.advanceClock(0);game.advanceClock(100);
 assert.equal(game.sandbox.parkourNative.pause(),true);
 const paused=state(game);
 assert.equal(game.keys.right,false);assert.equal(game.keys.jump,false);assert.equal(game.G.p.jumpBuffer,0);
 for(let i=0;i<20;i++){game.advanceClock(10000+i*100);game.update();}
 assert.deepEqual(state(game),paused);assert.equal(game.nodes.get('pauseScreen').hidden,false);
 game.nodes.get('btnResume').onclick();game.advanceClock(50000);assert.deepEqual(state(game),paused);
 assert.equal(game.gameInputBlocked(),false);
});
test('inactive native scene rejects resume and stays paused after activation',()=>{
 const game=create({active:false});
 assert.equal(game.gameInputBlocked(),true);assert.equal(game.nodes.get('pauseScreen').hidden,false);
 game.nodes.get('btnResume').onclick();assert.equal(game.gameInputBlocked(),true);
 game.sandbox.__PARKOUR_ACTIVE__=true;assert.equal(game.gameInputBlocked(),true);
 game.nodes.get('btnResume').onclick();assert.equal(game.gameInputBlocked(),false);
});
test('native viewport changes pause play without a phone rotation blocker',()=>{
 const game=create();game.sandbox.screen={width:320,height:1024};
 game.sandbox.innerWidth=320;game.sandbox.innerHeight=1024;
 fire(game.sandbox,'resize');
 assert.equal(game.nodes.get('rotateScreen').hidden,true);assert.equal(game.nodes.get('wrap').inert,false);
 assert.equal(game.gameInputBlocked(),true);
 game.nodes.get('btnResume').onclick();assert.equal(game.gameInputBlocked(),false);
 fire(game.sandbox,'resize');assert.equal(game.gameInputBlocked(),false,'unchanged viewport does not interrupt play');
});
test('page hide clears input and pauses before browser restoration',()=>{
 const game=create();fire(game.nodes.get('padR'),'pointerdown');fire(game.sandbox,'pagehide');
 assert.equal(game.keys.right,false);assert.equal(game.gameInputBlocked(),true);
 fire(game.sandbox,'pageshow');assert.equal(game.gameInputBlocked(),true);
});
test('native snapshot restores coins, characters and sound when WK storage is unavailable',()=>{
 const saved={coins:123,owned:['blue','frog','star'],skin:'star',best:4};
 const game=create({snapshot:{parkourEnemies:JSON.stringify(saved),parkourEnemiesSound:'on'},storageFails:true,play:false});
 assert.deepEqual(clone(game.save),saved);assert.equal(game.nodes.get('btnSound').getAttribute('aria-pressed'),'true');
});
test('native snapshot wins over stale browser storage',()=>{
 const saved={coins:32,owned:['blue','frog'],skin:'frog',best:2};
 const game=create({snapshot:{parkourEnemies:JSON.stringify(saved)},browserSave:{coins:999,owned:['blue','king'],skin:'king',best:6},play:false});
 assert.deepEqual(clone(game.save),saved);
});
test('native save writes reach the app when WK storage fails',()=>{
 const game=create({storageFails:true});game.save.coins=42;game.store();
 const latest=messages(game,'storage').filter(message=>message.key==='parkourEnemies').at(-1);
 assert.equal(JSON.parse(latest.value).coins,42);
 assert.equal(JSON.parse(game.sandbox.__PARKOUR_SAVED__.parkourEnemies).coins,42);
 game.nodes.get('btnSound').onclick();
 assert.equal(messages(game,'storage').filter(message=>message.key==='parkourEnemiesSound').at(-1).value,'on');
 game.sandbox.parkourNative.pause();
 assert.deepEqual(messages(game,'storage').slice(-2).map(message=>message.key),['parkourEnemies','parkourEnemiesSound']);
});
test('malformed native saves retain existing validation',()=>{
 const game=create({snapshot:{parkourEnemies:JSON.stringify({coins:-10,owned:['blue','unknown','frog','frog'],skin:'king',best:999})},play:false});
 assert.deepEqual(clone(game.save),{coins:0,owned:['blue','frog'],skin:'blue',best:6});
});
test('a missing native message handler does not interrupt gameplay or saving',()=>{
 const game=create();delete game.sandbox.webkit;game.save.coins=10;
 assert.doesNotThrow(()=>game.store());assert.doesNotThrow(()=>game.sandbox.parkourNative.pause());
});
test('browser build still saves locally and keeps supported fullscreen',()=>{
 const saved={coins:18,owned:['blue','frog'],skin:'frog',best:2};
 const game=create({native:false,browserSave:saved,play:false});assert.deepEqual(clone(game.save),saved);
 assert.equal(game.nodes.get('btnFullscreen').hidden,false);assert.deepEqual(messages(game,'ready'),[]);
 game.save.coins=19;game.store();assert.equal(JSON.parse(game.storage.get('parkourEnemies')).coins,19);
 game.nodes.get('btnFullscreen').onclick();assert.equal(game.sandbox.__fullscreenRequests,1);
});

async function browserChecks(){
 const {webkit}=require('playwright');
 const browser=await webkit.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:820,height:1180},screen:{width:820,height:1180},isMobile:true,hasTouch:true});
  await context.addInitScript(()=>{
   window.__PARKOUR_IOS__=true;window.__PARKOUR_ACTIVE__=true;window.__PARKOUR_SAVED__={};window.__nativeMessages=[];
   window.webkit={messageHandlers:{parkour:{postMessage:message=>window.__nativeMessages.push(message)}}};
  });
  await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:html}));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://parkour-ipad.test/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!document.getElementById('btnPlay').disabled);
  assert.equal(await page.locator('#btnFullscreen').isVisible(),false);
  await page.locator('#btnPlay').tap();
  for(const [width,height] of [[744,1133],[820,1180],[1024,1366],[1133,744],[1180,820],[1366,1024],[507,1024],[320,1024],[1024,507]]){
   await page.setViewportSize({width,height});
   await page.evaluate(()=>window.dispatchEvent(new Event('resize')));
   const layout=await page.evaluate(()=>({rotate:!document.getElementById('rotateScreen').hidden,overflow:document.documentElement.scrollWidth>innerWidth,
    rects:['padL','padR','padJ','btnPause','btnResume'].map(id=>{const element=document.getElementById(id),rect=element.getBoundingClientRect();return{id,visible:!!rect.width&&!!rect.height,x:rect.x,y:rect.y,w:rect.width,h:rect.height,right:rect.right,bottom:rect.bottom};})}));
   assert.equal(layout.rotate,false,`native ${width}x${height} rotation blocker`);assert.equal(layout.overflow,false,`native ${width}x${height} overflow`);
   // Resize pauses: resume target must remain visible before controls reappear.
   const resume=layout.rects.find(rect=>rect.id==='btnResume');
   assert(resume.visible&&resume.x>=0&&resume.y>=0&&resume.right<=width+1&&resume.bottom<=height+1,`native ${width}x${height} resume is clipped`);
   await page.locator('#btnResume').tap();
   const pads=await page.evaluate(()=>['padL','padR','padJ'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{id,x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}));
   for(const r of pads){assert(r.w>=64&&r.h>=64,`native ${width}x${height} target ${r.id}`);assert(r.x>=0&&r.y>=0&&r.right<=width+1&&r.bottom<=height+1,`native ${width}x${height} pad ${r.id} is clipped`);}
  }
  await page.evaluate(()=>window.parkourNative.pause());await page.locator('#btnPauseMenu').tap();
  for(const [width,height] of [[820,1180],[1180,820],[507,768],[320,1024]]){
   await page.setViewportSize({width,height});
   assert(await page.locator('#btnPlay').isVisible());await page.locator('#btnShop').tap();
   assert(await page.locator('#btnCloseShop').isVisible());assert.equal(await page.locator('#shopGrid .skin').count(),6);
   await page.locator('#btnCloseShop').tap();
  }
  assert.deepEqual(errors,[]);results.push('native WebKit layouts, resume and shop across iPad and Split View sizes');
  console.log('PASS '+results.at(-1));
 }finally{await browser.close();}
}
(async()=>{
 try{if(args.includes('--browser'))await browserChecks();console.log(JSON.stringify({passed:results.length,checks:results},null,2));}
 finally{fs.rmSync(temp,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
