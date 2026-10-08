#!/usr/bin/env node
'use strict';
// Tests the actual HTML's update() in a deterministic VM; no copied physics.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const clone = value => JSON.parse(JSON.stringify(value));
function makeDOM() {
  const nodes = new Map();
  const context = new Proxy({
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    measureText: str => ({ width: String(str).length * 8 }),
    getImageData: () => ({ data: new Uint8ClampedArray(4) }),
  }, { get(target, key) { return key in target ? target[key] : () => {}; } });
  class Element {
    constructor(tag = 'div', id = '') {
      this.tagName = tag.toUpperCase(); this.id = id; this.children = []; this.attributes = {};
      this.style = {}; this.dataset = {}; this.listeners = {}; this.hidden = false;
      this.textContent = ''; this.className = ''; this.width = 760; this.height = 560;
      this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
    }
    get childNodes() { return this.children; }
    set innerHTML(value) { this._innerHTML = value; this.children = []; }
    get innerHTML() { return this._innerHTML || ''; }
    appendChild(node) { this.children.push(node); return node; }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    getAttribute(key) { return this.attributes[key] || null; }
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }
    removeEventListener() {}
    getContext() { return context; }
    getBoundingClientRect() { return { left: 0, top: 0, width: 760, height: 560 }; }
    focus() {}
    querySelector() { return null; }
    querySelectorAll() { return []; }
  }
  const coins = [new Element('b'), new Element('b'), new Element('b')];
  const backs = Array.from({ length: 4 }, () => new Element('button'));
  const doc = {
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Element(id === 'game' ? 'canvas' : 'div', id)); return nodes.get(id); },
    createElement: tag => new Element(tag),
    querySelectorAll: selector => selector === '.coinTotal' ? coins : selector === '[data-back]' ? backs : [],
    querySelector(selector) { return selector[0] === '#' ? this.getElementById(selector.slice(1)) : null; },
    listeners: {},
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }, removeEventListener() {}, hidden: false,
    documentElement: new Element('html'), body: new Element('body'),
  };
  return { doc, nodes };
}

function loadGame(filename, initialSave, nativeValues) {
  const html = fs.readFileSync(filename, 'utf8');
  const { doc, nodes } = makeDOM();
  const storage = new Map();
  if (initialSave) storage.set('parkourEnemies', JSON.stringify(initialSave));
  const art = {};
  class FakeImage {
    constructor() { this.complete = true; this.naturalWidth = 1024; this.naturalHeight = 1024; this.width = 1024; this.height = 1024; }
    addEventListener() {}
    removeEventListener() {}
    decode() { return Promise.resolve(); }
    set src(value) { this._src = value; }
    get src() { return this._src || ''; }
  }
  for (const id of ['blue', 'frog', 'star', 'fox', 'ninja', 'king']) art[id] = {
    image: new FakeImage(), crop: [0, 0, 100, 100], footY: 100, bodyTop: 0, anchorX: 50,
  };
  const sandbox = {
    console, document: doc, Image: FakeImage, CHARACTER_ART: art,
    localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
    requestAnimationFrame() { throw new Error('Boot animation must not run in regression tests'); },
    cancelAnimationFrame() {}, setTimeout() {}, clearTimeout() {},
    performance: { now: () => 1000 }, devicePixelRatio: 1,
    navigator: { userAgent: 'mechanics-regression-test' },
    listeners: {},
    addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {} }),
  };
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.self = sandbox;
  const nativeMessages = [];
  if (nativeValues) {
    sandbox.parkourNative = {values: {...nativeValues}};
    sandbox.webkit = {messageHandlers: {parkour: {postMessage(message) {nativeMessages.push(clone(message));}}}};
  }
  vm.createContext(sandbox);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)];
  let found = false;
  for (let index = 0; index < scripts.length; index++) {
    const [, attrs, script] = scripts[index];
    if (/\bsrc\s*=/.test(attrs) || /application\/(?:ld\+)?json/.test(attrs)) continue;
    const marker = script.indexOf('/* ---------- boot ---------- */');
    if (marker >= 0) {
      // Mechanics tests skip boot/network; browser tests cover failed and pending assets.
      const source = script.slice(0, marker) + `\n
      if(typeof CHARACTER_ART!=='undefined') Object.keys(CHARACTER_ART).forEach(function(id){
        CHARACTER_ART[id].image=new Image();CHARACTER_ART[id].status='ready';
      });
      globalThis.__game = {
        G, keys, save, SKINS, ITEMS, buildLevel, rng, startRound, respawn, update, grab, hit, hurt,
        finishRound, pop, store, load, buildShop, showPanels, key, bindPad, skinById,
        advanceClock:typeof advanceClock==='function'?advanceClock:null,
        resetFrameClock:typeof resetFrameClock==='function'?resetFrameClock:null,
        pauseGame:typeof pauseGame==='function'?pauseGame:null,
        checkOrientation:typeof checkOrientation==='function'?checkOrientation:null,
        releaseControls:typeof releaseControls==='function'?releaseControls:null,
        gameInputBlocked:typeof gameInputBlocked==='function'?gameInputBlocked:null,
        constants: { W, H, GRAV, JUMP, SPD, MAXFALL, BOOST }
      };\n})();`;
      vm.runInContext(source, sandbox, { filename: `${path.basename(filename)}:mechanics`, timeout: 5000 });
      found = true; break;
    }
    vm.runInContext(script, sandbox, { filename: `${path.basename(filename)}:script-${index}`, timeout: 5000 });
  }
  assert.ok(found && sandbox.__game, `${filename}: cannot find original boot marker`);
  return { ...sandbox.__game, nodes, storage, sandbox, nativeMessages };
}

/** Snapshots search candidate inputs; committed tests replay actual update() calls. */
function snapshot(game) {
  return clone({ G: game.G, keys: game.keys, save: game.save });
}
function restore(game, state) {
  for (const [target, value] of [[game.G, state.G], [game.keys, state.keys], [game.save, state.save]]) {
    for (const key of Object.keys(target)) delete target[key];
    Object.assign(target, clone(value));
  }
}
function frame(game, input = {}) {
  const jump = !!input.jump;
  game.keys.jumpTap = jump && !game.keys.jump;
  game.keys.jump = jump;
  game.keys.left = !!input.left;
  game.keys.right = !!input.right;
  game.update();
  return game.G;
}
function sequence(game, commands, observe) {
  let count = 0;
  for (const command of commands) {
    for (let i = 0; i < (command.frames || 1); i++) {
      frame(game, command); count++;
      if (observe) observe(game, count, command);
    }
  }
  return count;
}
function standingPlatform(game, tolerance = 0.001) {
  const p = game.G.p;
  if (!p.onGround) return null;
  return game.G.lvl.plats.find(q => Math.abs(p.y + p.h - q.y) <= tolerance && p.x + p.w > q.x && p.x < q.x + q.w) || null;
}
function samePlatform(a, b) {
  return a && b && a.x === b.x && a.y === b.y && a.w === b.w;
}
function compressInputs(inputs) {
  const result = [];
  for (const input of inputs) {
    const previous = result[result.length - 1];
    if (previous && !!previous.left === !!input.left && !!previous.right === !!input.right && !!previous.jump === !!input.jump) previous.frames++;
    else result.push({ left: !!input.left, right: !!input.right, jump: !!input.jump, frames: 1 });
  }
  return result;
}

/** Search from the present grounded state; never teleport to takeoff. */
function planJump(game, target, options = {}) {
  const before = snapshot(game);
  const source = standingPlatform(game);
  if (!source) throw new Error('planJump requires the player to be grounded');
  const launchMargins = options.launchMargins || [16, 32, 52, 76, 104, 4, 0];
  const landingFractions = options.landingFractions || [.45, .65, .25, .8, .15];
  const holdFrames = options.holdFrames || [60, 36, 28, 22, 17, 12, 8, 6, 4, 2, 0];
  let best = null, attempts = 0;
  for (const margin of launchMargins) {
    for (const fraction of landingFractions) {
      for (const hold of holdFrames) {
        restore(game, before); attempts++;
        const inputs = [], trace = [];
        let invalid = false, airborne = false;
        const act = input => {
          const priorInv = game.G.p.inv, priorHearts = game.G.hearts;
          inputs.push(input); frame(game, input);
          const p = game.G.p;
          trace.push({ x:p.x, y:p.y, vx:p.vx, vy:p.vy, onGround:p.onGround });
          if (game.G.hearts < priorHearts || p.inv > priorInv || game.G.mode === 'over') invalid = true;
        };
        const takeoff = Math.max(source.x + 8, source.x + source.w - game.G.p.w - margin);
        let approachJump = 0;
        for (let i = 0; i < 160 && (Math.abs(game.G.p.x - takeoff) > 4 || !game.G.p.onGround); i++) {
          const p = game.G.p, direction = Math.sign(takeoff-p.x);
          const approachingEnemy = game.G.lvl.enemies.some(en => en.alive && en.y+en.h === source.y &&
            (direction > 0 ? en.x >= p.x && en.x-p.x < 80 : en.x+en.w <= p.x+p.w && p.x-en.x < 80));
          if (p.onGround && approachingEnemy && approachJump <= 0) approachJump = 26;
          act({ right:p.x < takeoff-4, left:p.x > takeoff+4, jump:approachJump > 0 });
          if (approachJump > 0) approachJump--;
          if (invalid || (game.G.p.onGround && !samePlatform(standingPlatform(game), source)) || game.G.p.y+game.G.p.h > source.y+1) {
            invalid = true; break;
          }
        }
        if (invalid || !samePlatform(standingPlatform(game), source)) continue;
        // Re-arm jump after a possible preparatory hop over an enemy on this island.
        if (game.keys.jump) act({});
        const aim = target.x + target.w * fraction - game.G.p.w / 2;
        for (let i = 0; i < 115 && game.G.mode === 'play'; i++) {
          const delta = aim - game.G.p.x;
          act({ right:delta > 8, left:delta < -8, jump:i < hold });
          if (invalid) break;
          if (!game.G.p.onGround) airborne = true;
          if (airborne && game.G.p.onGround) break;
          if (game.G.p.y > game.constants.H + 100) { invalid = true; break; }
        }
        if (invalid) continue;
        const reachedGoal = target.goal && ['clear','win'].includes(game.G.mode);
        if (!reachedGoal && !samePlatform(standingPlatform(game), target)) continue;
        for (let i = 0; i < 10 && game.G.mode === 'play'; i++) act({});
        if (invalid || (!reachedGoal && !samePlatform(standingPlatform(game), target))) continue;
        const p = game.G.p, landingMargin = Math.min(p.x - target.x, target.x + target.w - p.x - p.w);
        if (!reachedGoal && landingMargin < (options.minimumLandingMargin ?? 10)) continue;
        const result = { inputs:compressInputs(inputs), frameCount:inputs.length, trace, landingMargin,
          takeoff, holdFrames:hold, landingFraction:fraction, end:snapshot(game) };
        if (!best || result.landingMargin > best.landingMargin + 4 ||
            (Math.abs(result.landingMargin-best.landingMargin) <= 4 && result.frameCount < best.frameCount)) best = result;
        if (options.firstSuccess) break;
      }
      if (best && options.firstSuccess) break;
    }
    if (best && options.firstSuccess) break;
  }
  restore(game, before);
  if (best) best.attempts = attempts;
  return best;
}

function traverse(game, platforms, options = {}) {
  const legs = [];
  let totalFrames = 0;
  for (let settle = 0; settle < 90 && game.G.mode === 'play' && !game.G.p.onGround; settle++) { frame(game); totalFrames++; }
  for (let index = 0; index < platforms.length; index++) {
    const target = platforms[index];
    if (samePlatform(standingPlatform(game), target)) continue;
    if (['clear','win'].includes(game.G.mode)) break;
    const initial = snapshot(game);
    const plan = planJump(game, target, options);
    if (!plan) return { success:false, index, target, source:standingPlatform(game), state:clone(game.G.p), legs, totalFrames };
    sequence(game, plan.inputs);
    assert.deepEqual(snapshot(game), plan.end, 'actual input replay must match the searched trajectory');
    legs.push({ target:clone(target), from:clone(initial.G.p), landing:clone(game.G.p), frames:plan.frameCount,
      margin:plan.landingMargin, inputs:plan.inputs, attempts:plan.attempts,
      hearts:game.G.hearts,coins:game.G.roundCoins,speedT:game.G.speedT,jumpT:game.G.jumpT });
    totalFrames += plan.frameCount;
  }
  if (standingPlatform(game)?.goal && game.G.mode === 'play') {
    const inputs = [];
    for (let i = 0; i < 180 && game.G.mode === 'play'; i++) {
      const d = game.G.lvl.door, delta = d.x + d.w/2 - (game.G.p.x + game.G.p.w/2);
      const input = {right:delta > 0, left:delta < 0};
      const hearts = game.G.hearts;
      inputs.push(input); frame(game,input); totalFrames++;
      if (game.G.hearts < hearts) return {success:false, reason:'damage walking to door', legs, totalFrames};
    }
    legs.push({target:'door',frames:inputs.length,inputs:compressInputs(inputs),margin:Infinity});
  }
  return { success:true, mode:game.G.mode, hearts:game.G.hearts, coins:game.G.roundCoins, legs, totalFrames };
}

/** Independent edge unit test: setup on source, then only real input-driven movement. */
function measureLaunchWindow(game, source, target, options = {}) {
  const before = snapshot(game), step = options.step || 4;
  const successfulInsets = [];
  for (let inset = 0; inset <= (options.maxInset || 80); inset += step) {
    restore(game,before);
    game.G.mode='play'; game.G.hearts=3; game.G.lvl.enemies=[]; game.G.lvl.items=[];
    game.G.speedT=options.speed ? 100000 : 0; game.G.jumpT=options.jump ? 100000 : 0;
    Object.assign(game.G.p,{x:source.x+source.w-game.G.p.w-inset,y:source.y-game.G.p.h,
      vx:0,vy:0,onGround:true,coyote:6,inv:0});
    Object.assign(game.keys,{left:false,right:false,jump:false,jumpTap:false});
    const result=planJump(game,target,{launchMargins:[inset],firstSuccess:true,
      minimumLandingMargin:options.minimumLandingMargin ?? 20});
    if (result) successfulInsets.push(inset);
  }
  let longest=0, consecutive=0, last=-Infinity;
  for (const inset of successfulInsets) {
    consecutive=inset-last === step ? consecutive+step : 0;
    longest=Math.max(longest,consecutive); last=inset;
  }
  restore(game,before);
  return {source:clone(source),target:clone(target),successfulInsets,
    largestContinuousWindowPx:longest,
    equivalentFrames:longest/(game.constants.SPD*(options.speed ? 1.55 : 1))};
}

module.exports = { loadGame, makeDOM, clone, snapshot, restore, frame, sequence, standingPlatform,
  samePlatform, compressInputs, planJump, traverse, measureLaunchWindow };

if (require.main === module) {
  const filename = process.argv[2];
  if (!filename) throw new Error('Usage: node level-harness.cjs path/to/game.html');
  const game = loadGame(filename);
  const reports = [];
  for (let round = 1; round <= 5; round++) {
    game.startRound(round);
    const path = game.G.lvl.mainPath || game.G.lvl.plats.filter(p => p.route === 'main' || p.mainIndex !== undefined || p.start || p.goal);
    const platforms = path.map(p => typeof p === 'number' ? game.G.lvl.plats[p] : p);
    if (platforms.length < 3) throw new Error('No main path metadata found; use module API with explicit platforms');
    const result = traverse(game, platforms, {firstSuccess:true});
    reports.push({round,...result});
    console.log(JSON.stringify({round, success:result.success, mode:result.mode, failedIndex:result.index,
      frames:result.totalFrames, hearts:game.G.hearts, coins:game.G.roundCoins,
      landings:result.legs.length, minMargin:result.legs.length ? Math.min(...result.legs.map(x=>x.margin)) : null}));
    if (!result.success) console.error(JSON.stringify({source:result.source,target:result.target,state:result.state}));
  }
  if (reports.some(r=>!r.success)) process.exitCode=1;
}
