#!/usr/bin/env node
'use strict';
// Executes the actual exported game code; fake DOM only supplies event plumbing.
const assert = require('node:assert/strict');
const path = require('node:path');
const {loadGame, clone} = require('./level-harness.cjs');
const html = process.argv[2] || path.resolve(__dirname, '../parkour-enemies.html');
const results = [];
function test(name, fn) { fn(); results.push(name); console.log(`PASS ${name}`); }
function fire(target, type, fields={}) {
  const event = {type, pointerId:1, pointerType:'touch', button:0, preventDefault(){this.prevented=true;}, ...fields};
  for (const listener of target.listeners[type] || []) listener(event);
  return event;
}
function create() {
  const game=loadGame(html);
  game.sandbox.innerWidth=1180; game.sandbox.innerHeight=820;
  game.sandbox.navigator.maxTouchPoints=5;
  game.sandbox.matchMedia=()=>({matches:true,addEventListener(){}});
  for(const id of ['padL','padR','padJ']) {
    const el=game.nodes.get(id), classes=new Set(); el.captures=[];
    el.classList={add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)};
    el.setPointerCapture=id=>el.captures.push(id);
  }
  game.checkOrientation(); game.startRound(1);
  // Large neutral fixture makes wall-clock comparisons independent of finishing/falling.
  game.G.lvl.plats=[{x:0,y:438,w:20000,h:16,start:true,route:'main'}];
  game.G.lvl.enemies=[]; game.G.lvl.items=[]; game.G.lvl.worldW=20000;
  Object.assign(game.G.p,{x:200,y:406,vx:0,vy:0,onGround:true,coyote:6,inv:90,jumpBuffer:0});
  game.G.checkpoint={x:200,y:404,platformX:0};
  return game;
}
function press(game,id,pointerId=1) { return fire(game.nodes.get(id),'pointerdown',{pointerId}); }
function release(game,id,pointerId=1,type='pointerup') { return fire(game.nodes.get(id),type,{pointerId}); }
function runClock(game,hz,seconds=1) { game.resetFrameClock(); for(let i=0;i<=hz*seconds;i++) game.advanceClock(i*1000/hz); }
function gameState(game) { return clone({G:game.G,keys:game.keys}); }
function resume(game) { game.nodes.get('btnResume').onclick(); }

test('60 Hz and 120 Hz produce identical physics, enemies, timers and camera',()=>{
  const a=create(),b=create();
  for(const game of [a,b]) {
    game.G.speedT=900;game.G.jumpT=900;
    game.G.lvl.enemies=[{x:1600,y:410,w:28,h:28,minX:1500,maxX:1800,dir:1,spd:1.4,alive:true,t:0}];
    press(game,'padR',11); press(game,'padJ',12);
  }
  runClock(a,60); runClock(b,120);
  assert.deepEqual(gameState(a),gameState(b));
  assert.equal(a.G.speedT,840); assert.equal(a.G.jumpT,840);
  assert.ok(Math.abs(a.G.p.x-(200+4.5*1.55*60))<1e-8);
  assert.equal(a.G.lvl.enemies[0].t,60);
});
test('144 Hz and irregular RAF intervals retain 60 simulation steps per second',()=>{
  const reference=create(),fast=create(),jitter=create();
  for(const game of [reference,fast,jitter]){game.G.speedT=900;press(game,'padR');}
  runClock(reference,60);runClock(fast,144);
  jitter.resetFrameClock();let t=0;jitter.advanceClock(0);const gaps=[5,31,9,22,12,7,29,18];let i=0;
  while(t<1000){t=Math.min(1000,t+gaps[i++%gaps.length]);jitter.advanceClock(t);}
  assert.deepEqual(gameState(reference),gameState(fast));
  assert.deepEqual(gameState(reference),gameState(jitter));
});
test('long RAF stall catch-up is bounded to six frames; no large teleport',()=>{
  const game=create();press(game,'padR');game.advanceClock(0);game.advanceClock(10000);
  assert.equal(game.G.p.x,227); assert.equal(game.G.p.inv,84);
});
test('movement and jump use separate pointers; releasing jump keeps movement',()=>{
  const game=create();press(game,'padR',31);press(game,'padJ',32);
  assert.equal(game.keys.right,true);assert.equal(game.keys.jump,true);assert.equal(game.keys.jumpTap,true);
  assert.deepEqual(game.nodes.get('padR').captures,[31]);assert.deepEqual(game.nodes.get('padJ').captures,[32]);
  game.update();assert.ok(game.G.p.vy < -10);assert.ok(game.G.p.x>200);
  release(game,'padJ',32);assert.equal(game.keys.jump,false);assert.equal(game.keys.right,true);
  game.update();assert.ok(game.G.p.vy>=-5,'releasing jump changes jumpheight');
  release(game,'padR',31);assert.equal(game.keys.right,false);
});
test('two pointers on one pad retain input until the final owner releases',()=>{
  const game=create();press(game,'padR',10);press(game,'padR',11);
  release(game,'padR',999);assert.equal(game.keys.right,true);
  release(game,'padR',10);assert.equal(game.keys.right,true);
  release(game,'padR',10,'lostpointercapture');assert.equal(game.keys.right,true);
  release(game,'padR',11,'pointercancel');assert.equal(game.keys.right,false);
  assert.equal(game.nodes.get('padR').classList.contains('pressed'),false);
});
test('pointer leave preserves captured hold; lost capture safely releases',()=>{
  const game=create();press(game,'padL',20);fire(game.nodes.get('padL'),'pointerleave',{pointerId:20});
  assert.equal(game.keys.left,true);release(game,'padL',20,'lostpointercapture');assert.equal(game.keys.left,false);
  fire(game.nodes.get('padR'),'pointerdown',{pointerType:'mouse',button:2,pointerId:99});assert.equal(game.keys.right,false);
});
test('pause freezes player, enemies, boosts, invulnerability and buffered input',()=>{
  const game=create();game.G.speedT=400;game.G.jumpT=400;press(game,'padR',5);press(game,'padJ',6);
  game.advanceClock(0);game.advanceClock(100);game.G.p.jumpBuffer=5;game.pauseGame();
  const state=gameState(game);assert.equal(game.G.p.jumpBuffer,0);assert.equal(game.keys.jumpTap,false);
  for(let i=0;i<20;i++){game.advanceClock(1000+i*100);game.update();}
  assert.deepEqual(gameState(game),state);assert.equal(game.nodes.get('pauseScreen').hidden,false);
  press(game,'padR',50);press(game,'padJ',51);assert.deepEqual(gameState(game),state);
  resume(game);game.advanceClock(50000);assert.deepEqual(gameState(game),state,'resume must reset clock and begin without catchingup');
  assert.equal(game.nodes.get('pads').hidden,false);assert.equal(game.keys.right,false);assert.equal(game.keys.jump,false);
});
test('blur and hidden document pause; foreground requires explicit resume',()=>{
  const game=create();press(game,'padR');fire(game.sandbox,'blur');assert.equal(game.gameInputBlocked(),true);
  assert.equal(game.keys.right,false);resume(game);assert.equal(game.gameInputBlocked(),false);
  game.sandbox.document.hidden=true;fire(game.sandbox.document,'visibilitychange');
  assert.equal(game.gameInputBlocked(),true);game.sandbox.document.hidden=false;fire(game.sandbox.document,'visibilitychange');
  assert.equal(game.gameInputBlocked(),true);resume(game);assert.equal(game.gameInputBlocked(),false);
});
test('phone portrait freezes; rotating back requires resume; iPad portrait is allowed',()=>{
  const game=create();press(game,'padR',61);press(game,'padJ',62);game.update();
  game.sandbox.innerWidth=390;game.sandbox.innerHeight=844;game.checkOrientation();
  assert.equal(game.nodes.get('rotateScreen').hidden,false);assert.equal(game.nodes.get('wrap').inert,true);
  const state=gameState(game);game.update();game.advanceClock(0);game.advanceClock(10000);assert.deepEqual(gameState(game),state);
  game.sandbox.innerWidth=844;game.sandbox.innerHeight=390;game.checkOrientation();
  assert.equal(game.nodes.get('rotateScreen').hidden,true);assert.equal(game.nodes.get('pauseScreen').hidden,false);
  assert.equal(game.nodes.get('wrap').inert,false);assert.equal(game.gameInputBlocked(),true);resume(game);
  assert.equal(game.gameInputBlocked(),false);assert.equal(game.keys.right,false);assert.equal(game.keys.jump,false);
  game.sandbox.innerWidth=744;game.sandbox.innerHeight=1133;game.checkOrientation();
  assert.equal(game.nodes.get('rotateScreen').hidden,true);assert.equal(game.gameInputBlocked(),false);
});
test('jump buffer accepts an early press before landing; held jump does not auto-bounce',()=>{
  const game=create();Object.assign(game.G.p,{y:395,vy:8,onGround:false,coyote:0,jumpBuffer:0});
  press(game,'padJ',77);game.update();assert.equal(game.G.p.onGround,false);game.update();assert.equal(game.G.p.onGround,true);
  game.update();assert.ok(game.G.p.vy < -10);assert.equal(game.G.p.jumpBuffer,0);
  for(let i=0;i<75;i++)game.update();assert.equal(game.G.p.onGround,true);assert.equal(game.G.p.vy,0);
});
test('respawn resets buffered jump and coyote time; held button cannot create a new jump',()=>{
  const game=create();press(game,'padJ',79);game.update();game.G.p.jumpBuffer=6;game.G.p.coyote=5;
  game.respawn(false);assert.equal(game.G.p.jumpBuffer,0);assert.equal(game.G.p.coyote,0);
  for(let i=0;i<25;i++)game.update();assert.equal(game.G.p.onGround,true);assert.equal(game.G.p.vy,0);
});
test('new round clears pressed input and pause state; controls work again',()=>{
  const game=create();press(game,'padL',88);press(game,'padJ',89);game.pauseGame();game.startRound(2);
  assert.equal(game.gameInputBlocked(),false);assert.equal(game.keys.left,false);assert.equal(game.keys.jump,false);
  assert.equal(game.nodes.get('padL').classList.contains('pressed'),false);press(game,'padR',90);assert.equal(game.keys.right,true);
});
test('resume ignores stale keyboard repeats until a fresh key press',()=>{
  const game=create();
  const event={key:'ArrowRight',code:'ArrowRight',repeat:false,preventDefault(){}};
  game.key(event,true);game.pauseGame();resume(game);
  game.key({...event,repeat:true},true);assert.equal(game.keys.right,false);
  game.key(event,false);game.key(event,true);assert.equal(game.keys.right,true);
});
test('tablet split view uses physical screen size while phones still require landscape',()=>{
  const game=create();game.sandbox.screen={width:820,height:1180};
  game.sandbox.innerWidth=507;game.sandbox.innerHeight=1024;game.checkOrientation();
  assert.equal(game.nodes.get('rotateScreen').hidden,true);
  game.sandbox.screen={width:390,height:844};game.checkOrientation();
  assert.equal(game.nodes.get('rotateScreen').hidden,false);
});
test('holding Escape pauses only once until the key is released and pressed again',()=>{
  const game=create();
  fire(game.sandbox,'keydown',{key:'Escape',code:'Escape',repeat:false});
  assert.equal(game.gameInputBlocked(),true);
  for(let i=0;i<5;i++)fire(game.sandbox,'keydown',{key:'Escape',code:'Escape',repeat:true});
  assert.equal(game.gameInputBlocked(),true);
  fire(game.sandbox,'keyup',{key:'Escape',code:'Escape'});
  fire(game.sandbox,'keydown',{key:'Escape',code:'Escape',repeat:false});
  assert.equal(game.gameInputBlocked(),false);
});
console.log(JSON.stringify({passed:results.length,checks:results},null,2));
