#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const h = require('./level-harness.cjs');

const filename = process.argv[2] || path.resolve(__dirname,'../parkour-enemies.html');

const game = h.loadGame(filename), reports = [], launchWindows=[];
const mainPlatforms = () => (game.G.lvl.mainPath || game.G.lvl.plats.filter(p => p.route === 'main'))
  .map(p => typeof p === 'number' ? game.G.lvl.plats[p] : p);
function prepare(round, boost, geometry = true) {
  game.startRound(round);
  if (geometry) { game.G.lvl.enemies = []; game.G.lvl.items = []; }
  if (boost === 'speed' || boost === 'both') game.G.speedT = 100000;
  if (boost === 'jump' || boost === 'both') game.G.jumpT = 100000;
}
function report(round, route, boost, result) {
  const data = {round, route, boost, success:result.success && ['clear','win'].includes(result.mode),
    mode:result.mode, totalFrames:result.totalFrames, hearts:game.G.hearts,
    landings:result.legs.filter(l=>l.target !== 'door').length,
    minimumLandingMargin:Math.min(...result.legs.map(l=>l.margin)),
    failIndex:result.index, failSource:result.source, failTarget:result.target,
    legs:result.legs};
  reports.push(data);
  console.log(JSON.stringify({...data,legs:undefined}));
  return data;
}
for (let round=1;round<=5;round++) {
  prepare(round,'none');
  const main=mainPlatforms(), bonuses=game.G.lvl.plats.filter(p=>p.route==='bonus');
  assert(main.length>=3, `round ${round} must expose its ordered mainPath`);
  for (const boost of ['none','speed','jump','both']) {
    prepare(round,boost);
    report(round,'main-geometry',boost,h.traverse(game,mainPlatforms(),{firstSuccess:true}));
  }
  for (let index=0;index<bonuses.length;index++) {
    for (const geometry of [true,false]) {
      prepare(round,'none',geometry);
      const b=game.G.lvl.plats.filter(p=>p.route==='bonus')[index];
      if (!Number.isInteger(b.bonusFrom) || !Number.isInteger(b.bonusTo)) continue;
      const path=mainPlatforms(), route=[...path.slice(0,b.bonusFrom+1),b,...path.slice(b.bonusTo)];
      report(round,`bonus-${index}-${geometry?'geometry':'with-pickups-and-enemies'}`,'none',h.traverse(game,route,{firstSuccess:true}));
    }
  }
  prepare(round,'none',false);
  report(round,'main-with-pickups-and-enemies','natural',h.traverse(game,mainPlatforms(),{firstSuccess:true}));
  prepare(round,'none');
  const runway=mainPlatforms();
  for (let index=1;index<runway.length;index++) {
    const measured=h.measureLaunchWindow(game,runway[index-1],runway[index],{step:4,maxInset:64});
    launchWindows.push({round,index,...measured});
    if (measured.largestContinuousWindowPx<16) console.log(JSON.stringify({warning:'tight-takeoff-window',round,index,
      pixels:measured.largestContinuousWindowPx,source:measured.source,target:measured.target}));
  }
}
const summary={file:path.resolve(filename),checks:reports.length,passed:reports.filter(r=>r.success).length,
  totalReplayFrames:reports.reduce((sum,r)=>sum+r.totalFrames,0),reports,launchWindows};
const reportPath=process.argv[3]||path.join(__dirname,'reports/level-validation-report.json');
fs.mkdirSync(path.dirname(reportPath),{recursive:true});
fs.writeFileSync(reportPath,JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({...summary,reports:undefined,launchWindows:undefined,
  minimumTakeoffWindowPx:Math.min(...launchWindows.map(w=>w.largestContinuousWindowPx))}));
if (summary.passed!==summary.checks) process.exitCode=1;
