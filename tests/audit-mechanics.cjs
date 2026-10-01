#!/usr/bin/env node
'use strict';
// Adversarial state-boundary checks against the real game, not a copied model.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {loadGame, frame, clone} = require('./level-harness.cjs');
const html = process.argv[2] || path.resolve(__dirname, '../parkour-enemies.html');
const results = [];
function test(name, fn) {
  try { const evidence = fn(); results.push({name, passed:true, evidence}); console.log(`PASS ${name}`); }
  catch (error) { results.push({name, passed:false, error:error.message}); console.error(`FAIL ${name}: ${error.message}`); }
}
function create(saved) {
  const game = loadGame(html, saved); game.startRound(1);
  game.G.lvl.plats=[{x:0,y:400,w:1200,h:16,route:'main'}];
  game.G.lvl.worldW=3000; game.G.lvl.enemies=[]; game.G.lvl.items=[];
  game.G.lvl.door={x:2900,y:348,w:36,h:52};
  Object.assign(game.G.p,{x:200,y:368,vx:0,vy:0,onGround:true,coyote:6,jumpBuffer:0,inv:0});
  game.G.checkpoint={x:32,y:366,platformX:0};
  return game;
}
function enemy(x=200) { return {x,y:372,w:28,h:28,minX:x,maxX:x,dir:1,spd:0,alive:true,t:0}; }
function fire(game,type,key,code=key) {
  const e={key,code,repeat:false,preventDefault(){}};
  for(const listener of game.sandbox.listeners[type] || []) listener(e);
}
function pointer(game,id,type,pointerId=1) {
  const e={type,pointerId,pointerType:'touch',button:0,preventDefault(){}};
  for(const listener of game.nodes.get(id).listeners[type] || []) listener(e);
}

test('Falling bypasses enemy invulnerability and costs exactly one life',()=>{
  const game=create();game.G.p.inv=40;game.G.p.y=game.constants.H+121;game.G.p.vy=16;
  game.update();assert.equal(game.G.hearts,2);assert.equal(game.G.p.x,32);assert.equal(game.G.p.y,366);
  assert.equal(game.G.p.inv,90);assert.equal(game.G.mode,'play');
  return {hearts:game.G.hearts,respawnY:game.G.p.y};
});
test('Real second-island fall returns immediately instead of disappearing for 49 frames',()=>{
  const game=loadGame(html);game.startRound(1);
  game.G.checkpoint={x:388,y:376,platformX:356};game.respawn(false);game.G.speedT=420;
  let firstRespawn=0,offscreenFrames=0;
  for(let i=1;i<=100;i++) {
    frame(game,{left:i<=12}); if(game.G.p.y>game.constants.H+120)offscreenFrames++;
    if(game.G.hearts<3){firstRespawn=i;break;}
  }
  assert.ok(firstRespawn>0&&firstRespawn<=42,`first respawn update was ${firstRespawn}`);
  assert.equal(offscreenFrames,0);assert.equal(game.G.hearts,2);
  return {firstRespawn,offscreenFrames};
});
test('A real wide-island fall puts the respawned hero on screen immediately',()=>{
  const game=loadGame(html);game.startRound(2);
  const island=game.G.lvl.plats.find(p=>p.w===420);
  game.G.checkpoint={x:island.x+32,y:island.y-34,platformX:island.x};
  Object.assign(game.G.p,{x:island.x+island.w-40,y:island.y-32,vy:0,vx:0,onGround:true,inv:0});
  game.G.cam=game.G.p.x-game.constants.W*.36;
  let respawned=false;
  for(let i=1;i<=100;i++) {
    frame(game,{right:i<=15});
    if(game.G.hearts<3){respawned=true;break;}
  }
  assert.ok(respawned,'fixture must fall and recover');
  const screenX=game.G.p.x-game.G.cam;
  assert.ok(screenX>=0&&screenX+game.G.p.w<=game.constants.W,`respawn screen X was ${screenX}`);
  assert.ok(game.G.cam>=0&&game.G.cam<=game.G.lvl.worldW-game.constants.W);
  return {screenX,hearts:game.G.hearts};
});
test('Invulnerable enemy contact still protects the player',()=>{
  const game=create();game.G.p.inv=40;game.G.lvl.enemies=[enemy()];game.update();
  assert.equal(game.G.hearts,3);assert.equal(game.G.p.x,200);assert.equal(game.G.p.inv,39);
});
test('Fatal fall reaches game-over even during spawn protection',()=>{
  const game=create();game.G.hearts=1;game.G.p.inv=40;game.G.p.y=game.constants.H+121;
  game.update();assert.equal(game.G.mode,'over');assert.equal(game.G.hearts,0);
  const after=clone(game.G);for(let i=0;i<10;i++)game.update();assert.deepEqual(clone(game.G),after);
});
test('Fatal contact cannot be overwritten by a portal in the same update',()=>{
  const game=create();game.G.hearts=1;game.G.lvl.enemies=[enemy()];
  game.G.lvl.door={x:200,y:348,w:36,h:52};game.update();
  assert.equal(game.G.mode,'over');assert.equal(game.G.hearts,0);assert.equal(game.save.best,1);
});
test('Two contacts in a fatal update cannot drive hearts below zero',()=>{
  const game=create();game.G.hearts=1;game.G.lvl.enemies=[enemy(),enemy()];game.update();
  assert.equal(game.G.mode,'over');assert.equal(game.G.hearts,0);
});
test('A fatal update cannot collect a pickup after death',()=>{
  const game=create();game.G.hearts=1;game.G.lvl.enemies=[enemy()];
  game.G.lvl.items=[{kind:'coin',x:214,y:384,t:0,got:false}];game.update();
  assert.equal(game.G.mode,'over');assert.equal(game.save.coins,0);assert.equal(game.G.lvl.items[0].got,false);
});
test('Nonfatal damage stops interactions until the next update at the checkpoint',()=>{
  const game=create();game.G.lvl.enemies=[enemy()];
  game.G.lvl.items=[{kind:'coin',x:46,y:384,t:0,got:false}];game.update();
  assert.equal(game.G.hearts,2);assert.equal(game.save.coins,0);assert.equal(game.G.lvl.items[0].got,false);
  game.update();assert.equal(game.save.coins,1);
});
test('A valid head stomp preserves hearts and kills the enemy exactly once',()=>{
  const game=create(),en=enemy();game.G.lvl.enemies=[en];
  Object.assign(game.G.p,{y:337,vy:4,onGround:false,coyote:0});frame(game,{jump:true});
  assert.equal(en.alive,false);assert.equal(game.G.hearts,3);assert.equal(game.G.p.vy,-10);
  const bops=game.G.pops.filter(p=>p.txt==='BOP!').length;assert.equal(bops,1);
  for(let i=0;i<8;i++)frame(game,{jump:true});assert.equal(game.G.pops.filter(p=>p.txt==='BOP!').length,1);
});

test('Releasing D does not cancel an independently held ArrowRight',()=>{
  const game=create();fire(game,'keydown','ArrowRight');fire(game,'keydown','d','KeyD');fire(game,'keyup','d','KeyD');
  assert.equal(game.keys.right,true);game.update();assert.ok(game.G.p.x>200);
  fire(game,'keyup','ArrowRight');assert.equal(game.keys.right,false);
});
test('Releasing one jump alias preserves a second held jump key',()=>{
  const game=create();fire(game,'keydown','w','KeyW');game.update();
  fire(game,'keydown',' ','Space');fire(game,'keyup','w','KeyW');
  assert.equal(game.keys.jump,true);game.update();assert.ok(game.G.p.vy<-10);
  fire(game,'keyup',' ','Space');assert.equal(game.keys.jump,false);
});
test('Touch release cannot cancel a keyboard direction that remains held',()=>{
  const game=create();fire(game,'keydown','ArrowRight');pointer(game,'padR','pointerdown',21);pointer(game,'padR','pointerup',21);
  assert.equal(game.keys.right,true);fire(game,'keyup','ArrowRight');assert.equal(game.keys.right,false);
});
test('Keyboard release cannot cancel a touch direction that remains held',()=>{
  const game=create();pointer(game,'padR','pointerdown',22);fire(game,'keydown','ArrowRight');fire(game,'keyup','ArrowRight');
  assert.equal(game.keys.right,true);pointer(game,'padR','pointerup',22);assert.equal(game.keys.right,false);
});
test('Pause discards all key owners and resume needs a fresh press',()=>{
  const game=create();fire(game,'keydown','ArrowRight');fire(game,'keydown','d','KeyD');game.pauseGame();
  assert.equal(game.keys.right,false);game.nodes.get('btnResume').onclick();assert.equal(game.keys.right,false);
  fire(game,'keyup','ArrowRight');fire(game,'keyup','d','KeyD');assert.equal(game.keys.right,false);
  fire(game,'keydown','d','KeyD');assert.equal(game.keys.right,true);
});

test('Malformed save restores a valid wallet, known unique ownership, and owned selection',()=>{
  const game=loadGame(html,{coins:-5,owned:['king','king','ghost',null],skin:'frog',best:-10});
  assert.equal(game.save.coins,0);assert.ok(game.save.owned.includes('blue'));assert.ok(game.save.owned.includes('king'));
  assert.equal(new Set(game.save.owned).size,game.save.owned.length);
  assert.ok(game.save.owned.every(id=>game.SKINS.some(s=>s.id===id)));
  assert.ok(game.save.owned.includes(game.save.skin));assert.equal(game.save.best,1);
  game.buildShop();const before=clone(game.save);game.nodes.get('shopGrid').children[1].onclick();
  assert.deepEqual(clone(game.save),before,'invalid funds must not permit a paid purchase');
});
test('Large valid wallet does not wrap into a negative signed 32-bit integer',()=>{
  const game=loadGame(html,{coins:2147483648,owned:['blue'],skin:'blue',best:4});
  assert.equal(game.save.coins,2147483648);game.buildShop();game.nodes.get('shopGrid').children[1].onclick();
  assert.equal(game.save.coins,2147483648-game.skinById('frog').price);assert.equal(game.save.skin,'frog');
});
test('Existing valid saves keep coins, characters, selection, and progress',()=>{
  const saved={coins:42,owned:['blue','frog','star','fox','ninja','king'],skin:'fox',best:4};
  const game=loadGame(html,saved);assert.deepEqual(clone(game.save),saved);
  game.store();assert.deepEqual(JSON.parse(game.storage.get('parkourEnemies')),saved);
});
test('Invalid JSON and unavailable storage do not prevent a new game or earned coins',()=>{
  const game=create();game.storage.set('parkourEnemies','{broken');assert.doesNotThrow(()=>game.load());
  game.sandbox.localStorage.getItem=()=>{throw new Error('Storage blocked');};assert.doesNotThrow(()=>game.load());
  game.sandbox.localStorage.setItem=()=>{throw new Error('Quota exceeded');};
  game.grab({kind:'coin',x:214,y:384});assert.equal(game.save.coins,1);game.update();assert.equal(game.G.mode,'play');
});
test('Repeated activation of a stale purchase button cannot charge twice',()=>{
  const game=create();game.save.coins=game.skinById('frog').price;game.buildShop();
  const button=game.nodes.get('shopGrid').children[1];button.onclick();button.onclick();
  assert.equal(game.save.coins,0);assert.equal(game.save.skin,'frog');assert.deepEqual(clone(game.save.owned),['blue','frog']);
  const reloaded=loadGame(html,JSON.parse(game.storage.get('parkourEnemies')));assert.equal(reloaded.save.skin,'frog');
});
test('Insufficient funds never unlock or select a character',()=>{
  const game=create({coins:2,owned:['blue'],skin:'blue',best:1});game.buildShop();
  for(let i=0;i<10;i++)game.nodes.get('shopGrid').children[1].onclick();
  assert.equal(game.save.coins,2);assert.equal(game.save.skin,'blue');assert.deepEqual(clone(game.save.owned),['blue']);
});
test('All five portal transitions preserve coins and freeze finished worlds',()=>{
  const game=loadGame(html);
  for(let round=1;round<=5;round++) {
    game.startRound(round);const door=game.G.lvl.door;
    Object.assign(game.G.p,{x:door.x,y:door.y+door.h-game.G.p.h,vx:0,vy:0,onGround:true,inv:0});
    game.update();assert.equal(game.G.mode,round===5?'win':'clear');
    const finished=clone(game.G);for(let i=0;i<20;i++)game.update();assert.deepEqual(clone(game.G),finished);
    assert.ok(game.save.best>=round);
  }
});

const report={file:path.resolve(html),passed:results.filter(r=>r.passed).length,failed:results.filter(r=>!r.passed).length,results};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,failed:report.failed}));
if(report.failed)process.exitCode=1;
