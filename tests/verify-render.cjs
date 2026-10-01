#!/usr/bin/env node
'use strict';
const fs=require('node:fs'), path=require('node:path'), os=require('node:os'), assert=require('node:assert/strict');
const {loadGame,frame}=require('./level-harness.cjs');
const target=path.resolve(process.argv[2] || path.join(__dirname,'../parkour-enemies.html'));
const source=fs.readFileSync(target,'utf8');
assert(source.includes('function renderFrame('),'Build the game before testing render support.');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'parkour-render-'));
const fixture=path.join(temp,'instrumented.html');
fs.writeFileSync(fixture,source.replace('/* ---------- boot ---------- */',`globalThis.__renderQA={
  captureRenderState,resetRenderState,renderFrame,
  viewY:function(){return renderViewY;},replaceDraw:function(fn){draw=fn;}
}; /* ---------- boot ---------- */`));
let passed=0;
function test(name,run){run();passed++;console.log('PASS '+name);}
function create(round=1){const game=loadGame(fixture);game.startRound(round);game.sandbox.__renderQA.resetRenderState(true);return game;}
function state(game){return JSON.stringify({G:game.G,keys:game.keys,save:game.save});}
function close(a,b,message){assert(Math.abs(a-b)<1e-7,message+': '+a+' vs '+b);}
try{
  test('half-step interpolation moves player, camera and patrol without mutating simulation',()=>{
    const game=create(3),qa=game.sandbox.__renderQA;
    Object.assign(game.G.p,{x:900,y:300,anim:1});game.G.cam=600;qa.resetRenderState(true);qa.captureRenderState();
    const en=game.G.lvl.enemies[0],oldEnemyX=en.x;
    game.G.p.x+=4.5;game.G.p.y-=12;game.G.p.anim+=.9;game.G.cam+=4;en.x+=1.2;
    const before=state(game),player=game.G.p,level=game.G.lvl,enemy=level.enemies[0];let observed;
    qa.replaceDraw(()=>{observed={x:game.G.p.x,y:game.G.p.y,cam:game.G.cam,en:game.G.lvl.enemies[0].x};});
    qa.renderFrame(.5);
    close(observed.x,902.25,'player x');close(observed.y,294,'player y');close(observed.cam,602,'camera');close(observed.en,oldEnemyX+.6,'enemy');
    assert.equal(state(game),before);assert.equal(game.G.p,player);assert.equal(game.G.lvl,level);assert.equal(game.G.lvl.enemies[0],enemy);
  });
  test('drawing exception restores original state and object identities',()=>{
    const game=create(),qa=game.sandbox.__renderQA;qa.captureRenderState();game.G.p.x+=4;
    const before=state(game),player=game.G.p,level=game.G.lvl;
    qa.replaceDraw(()=>{throw Error('intentional renderer test failure');});
    assert.throws(()=>qa.renderFrame(.5),/intentional/);assert.equal(state(game),before);assert.equal(game.G.p,player);assert.equal(game.G.lvl,level);
    close(qa.viewY(),0,'temporary vertical offset restored');
  });
  test('120/144 Hz render schedules preserve identical sixty-step physics',()=>{
    const outcomes=[];
    for(const hz of [60,120,144]){
      const game=create(),qa=game.sandbox.__renderQA;qa.replaceDraw(()=>{});let ticks=0;
      for(let i=0;i<=hz;i++){
        const clock=i*60/hz;
        while(ticks<Math.floor(clock+1e-8)){qa.captureRenderState();frame(game,{right:true,jump:ticks<28});ticks++;}
        const before=state(game);qa.renderFrame(clock-Math.floor(clock+1e-8));assert.equal(state(game),before);
      }
      outcomes.push(state(game));
    }
    assert.equal(outcomes[0],outcomes[1]);assert.equal(outcomes[0],outcomes[2]);
  });
  test('mid-step positions progress continuously across the 120 Hz sequence',()=>{
    const game=create(),qa=game.sandbox.__renderQA;Object.assign(game.G.p,{x:100,y:300});qa.resetRenderState(true);
    const positions=[];qa.replaceDraw(()=>positions.push(game.G.p.x));
    for(let i=0;i<4;i++){qa.captureRenderState();game.G.p.x+=4.5;qa.renderFrame(0);qa.renderFrame(.5);}
    for(let i=1;i<positions.length;i++)close(positions[i]-positions[i-1],2.25,'half-frame movement');
  });
  test('extra renders do not advance vertical camera or change the next camera step',()=>{
    const outcomes=[];
    for(const renders of [1,2,5]){
      const game=create(2),qa=game.sandbox.__renderQA;game.G.p.y=160;qa.resetRenderState(true);let last;
      qa.replaceDraw(()=>{last=qa.viewY();});
      for(let i=0;i<20;i++){
        qa.captureRenderState();game.G.p.y-=10;
        for(let j=1;j<=renders;j++)qa.renderFrame(j/renders);
      }
      outcomes.push(last);
    }
    close(outcomes[0],outcomes[1],'120 Hz camera');close(outcomes[0],outcomes[2],'extra-frame camera');
  });
  test('boosted jumps on every bonus route stay below HUD and within view',()=>{
    for(let round=2;round<=5;round++){
      const game=create(round),qa=game.sandbox.__renderQA;
      const bonus=game.G.lvl.plats.find(p=>p.route==='bonus');
      Object.assign(game.G.p,{x:bonus.x+50,y:bonus.y-32,vy:0,vx:0,onGround:true,coyote:6,inv:0});
      game.G.jumpT=420;qa.resetRenderState(true);let minimumWorldY=Infinity,minimumScreenY=Infinity;
      qa.replaceDraw(()=>{minimumScreenY=Math.min(minimumScreenY,game.G.p.y-qa.viewY());});
      for(let i=0;i<70;i++){
        qa.captureRenderState();frame(game,{jump:true});minimumWorldY=Math.min(minimumWorldY,game.G.p.y);
        const before=state(game);qa.renderFrame(0);qa.renderFrame(.5);qa.renderFrame(1);assert.equal(state(game),before);
      }
      assert(minimumWorldY< -50,'Test must reproduce high offscreen world position.');
      assert(minimumScreenY>=108-1e-7,'Round '+round+' player obscured: '+minimumScreenY);
    }
  });
  test('new round and teleport reset interpolation without a camera fly-through',()=>{
    const game=create(2),qa=game.sandbox.__renderQA;game.G.p.y=-50;qa.resetRenderState(true);qa.captureRenderState();
    game.startRound(3);qa.resetRenderState(true);let observed;
    qa.replaceDraw(()=>{observed={x:game.G.p.x,y:game.G.p.y,cam:game.G.cam,camY:qa.viewY()};});
    qa.renderFrame(0);close(observed.x,game.G.p.x,'spawn x');close(observed.y,game.G.p.y,'spawn y');close(observed.camY,0,'spawn vertical camera');
    qa.captureRenderState();game.G.p.x+=800;game.G.p.y=300;qa.renderFrame(.25);close(observed.x,game.G.p.x,'teleport x');close(observed.y,300,'teleport y');
  });
  test('normal first-island jump leaves the vertical camera stable',()=>{
    const game=create(),qa=game.sandbox.__renderQA;frame(game,{});qa.resetRenderState(true);
    qa.replaceDraw(()=>close(qa.viewY(),0,'normal jump camera'));
    for(let i=0;i<55;i++){qa.captureRenderState();frame(game,{jump:true});qa.renderFrame(.5);}
  });
  console.log('PASS render regression: '+passed+' scenarios');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
