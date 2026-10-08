
(function(){
  "use strict";
  var cv = document.getElementById('game'), ctx = cv.getContext('2d');
  var W = 760, H = 560;

  /* ---------- save ---------- */
  var save = { coins:0, owned:['blue'], skin:'blue', best:1 };
  function load(){
    try {
      var raw=readPreference('parkourEnemies'), d=raw?JSON.parse(raw):null;
      if(!d || typeof d!=='object' || Array.isArray(d)) return;
      save.coins=Number.isSafeInteger(d.coins)&&d.coins>=0?d.coins:0;
      var known=SKINS.map(function(s){return s.id;});
      save.owned=['blue'];
      if(Array.isArray(d.owned)) d.owned.forEach(function(id){
        if(known.indexOf(id)>=0&&save.owned.indexOf(id)<0) save.owned.push(id);
      });
      save.skin=save.owned.indexOf(d.skin)>=0?d.skin:'blue';
      save.best=Number.isFinite(d.best)?Math.max(1,Math.min(6,Math.floor(d.best))):1;
    } catch(e) {}
  }
  function store(){ try{ writePreference('parkourEnemies', JSON.stringify(save)); }catch(e){} }

  /* ---------- skins ---------- */
  var SKINS = [
    { id:'blue',  name:'Blue Guy',  price:0,  body:'#4cc9ff', dark:'#1f7fb0', hat:'none'  },
    { id:'frog',  name:'Frog',      price:3,  body:'#5ef2b0', dark:'#2c9c70', hat:'ears'  },
    { id:'star',  name:'Star Kid',  price:7,  body:'#ff8fd0', dark:'#c2508f', hat:'star'  },
    { id:'fox',   name:'Fox',       price:12, body:'#ff9d44', dark:'#c26a1e', hat:'ears'  },
    { id:'ninja', name:'Ninja',     price:18, body:'#5b5f92', dark:'#2d3060', hat:'band'  },
    { id:'king',  name:'Gold King', price:28, body:'#ffc93c', dark:'#b3852a', hat:'crown' }
  ];
  function skinById(id){ for(var i=0;i<SKINS.length;i++) if(SKINS[i].id===id) return SKINS[i]; return SKINS[0]; }

  load();

  /* ---------- items ---------- */
  var ITEMS = {
    coin:  { col:'#ffc93c', dark:'#b3852a', label:'Ⓗ coin', help:'buy skins' },
    speed: { col:'#4cc9ff', dark:'#1f7fb0', label:'Speed',   help:'run super fast' },
    jump:  { col:'#5ef2b0', dark:'#2c9c70', label:'Big jump',help:'jump way higher' },
    heart: { col:'#ff5a6e', dark:'#b32d3d', label:'Extra life', help:'one more heart' },
    star:  { col:'#e5b3ff', dark:'#8a5fb0', label:'Star',    help:'3 coins! way up high' }
  };

  /* ---------- level ---------- */
  function rng(seed){ var s = seed*9301 + 49297;
    return function(){ s = (s*9301 + 49297) % 233280; return s/233280; }; }

  var LOW = 430, HIGH = 310, SKY = 190;   // the three lanes
  var PITCH = 196, PW = 126;

  function buildLevel(round){
    var r = rng(round*13 + 5);
    var cols = 7 + round;
    var plats = [], items = [], enemies = [];

    // start pad
    plats.push({x:16, y:LOW, w:150, h:16, start:true});

    var slots = [];   // every platform you can choose
    for(var i=0;i<cols;i++){
      var bx = 190 + i*PITCH;
      var lo = {x:bx,    y:LOW,  w:PW, h:16};
      var hi = {x:bx+18, y:HIGH, w:PW, h:16};
      plats.push(lo); plats.push(hi);
      slots.push({p:lo, lane:0, col:i});
      slots.push({p:hi, lane:1, col:i});
      // a risky sky platform every 3rd column
      if(i%3 === 2){
        var sk = {x:bx+34, y:SKY, w:92, h:16};
        plats.push(sk);
        slots.push({p:sk, lane:2, col:i});
      }
    }

    // goal pad
    var gx = 190 + cols*PITCH;
    var goal = {x:gx, y:LOW-60, w:210, h:16, goal:true};
    plats.push(goal);

    /* --- place things so every column is a real choice --- */
    var byCol = [];
    for(var c=0;c<cols;c++) byCol.push([]);
    slots.forEach(function(s){ byCol[s.col].push(s); });

    var nEnemies = Math.min(5, 2 + round);
    var enemyCols = [];
    // spread the enemies out, never on the first column
    var avail = []; for(var c2=1;c2<cols;c2++) avail.push(c2);
    for(var e=0;e<nEnemies && avail.length;e++){
      enemyCols.push(avail.splice(Math.floor(r()*avail.length),1)[0]);
    }

    // sky platforms always hold the big prize
    slots.forEach(function(s){
      if(s.lane === 2) s.give = 'star';
    });

    enemyCols.forEach(function(c){
      var opts = byCol[c].filter(function(s){ return s.lane < 2; });
      var pick = opts[Math.floor(r()*opts.length)];
      pick.give = 'enemy';
      // the other lane in that column gets a treat, so the choice matters
      opts.forEach(function(o){
        if(o !== pick && !o.give){
          var t = r();
          o.give = t < 0.45 ? 'coin' : (t < 0.7 ? 'speed' : (t < 0.9 ? 'jump' : 'heart'));
        }
      });
    });

    // sprinkle a few more treats on empty ground lanes
    var empties = slots.filter(function(s){ return !s.give && s.lane < 2; });
    var treats = ['coin','coin','jump','speed','heart','coin'];
    for(var t2=0; t2<treats.length && empties.length; t2++){
      var idx = Math.floor(r()*empties.length);
      empties.splice(idx,1)[0].give = treats[t2];
    }

    // turn the plan into real objects
    slots.forEach(function(s){
      if(!s.give) return;
      var p = s.p;
      if(s.give === 'enemy'){
        enemies.push({ x:p.x+p.w/2-14, y:p.y-28, w:28, h:28,
          minX:p.x+6, maxX:p.x+p.w-34, dir: 1, spd:0.8 + round*0.18,
          alive:true, t:Math.floor(r()*40) });
      } else {
        items.push({ kind:s.give, x:p.x+p.w/2, y:p.y-30, got:false, t:Math.floor(r()*60) });
      }
    });

    // two coins waiting on the goal pad
    items.push({kind:'coin', x:goal.x+62,  y:goal.y-30, got:false, t:0});
    items.push({kind:'coin', x:goal.x+148, y:goal.y-30, got:false, t:20});

    return {
      plats:plats, items:items, enemies:enemies,
      goal:goal,
      door:{x:goal.x+goal.w/2-18, y:goal.y-52, w:36, h:52},
      worldW: gx + 210 + 60,
      start:{x:60, y:LOW-34}
    };
  }

  /* ---------- state ---------- */
  var G = {
    mode:'menu', round:1, hearts:3, lvl:null,
    p:{x:0,y:0,w:28,h:32,vx:0,vy:0,onGround:false,face:1,inv:0,coyote:0,anim:0},
    cam:0, roundCoins:0, shake:0, pops:[],
    speedT:0, jumpT:0, checkpoint:null
  };
  var keys = {left:false,right:false,jump:false,jumpTap:false};

  var GRAV = 0.55, JUMP = -13.7, SPD = 4.5, MAXFALL = 16, BOOST = 420;

  function startRound(round){
    G.round = round; G.hearts = 3; G.roundCoins = 0;
    G.lvl = buildLevel(round);
    G.speedT = 0; G.jumpT = 0; G.pops = [];
    G.checkpoint = {x:G.lvl.start.x, y:G.lvl.start.y};
    respawn(true);
    G.mode = 'play'; showPanels();
  }
  function respawn(full){
    var p = G.p, c = G.checkpoint;
    p.x = c.x; p.y = c.y; p.vx = 0; p.vy = 0; p.inv = 90; p.onGround = false;
    G.cam=full?0:Math.max(0,Math.min(G.lvl.worldW-W,p.x-W*.36));
    if(typeof resetRenderState==='function') resetRenderState(true);
  }

  /* ---------- update ---------- */
  function update(){
    if(G.mode !== 'play') return;
    var p = G.p, L = G.lvl;
    var spd = G.speedT > 0 ? SPD*1.55 : SPD;
    var jmp = G.jumpT  > 0 ? JUMP*1.22 : JUMP;

    if(keys.left && !keys.right){ p.vx = -spd; p.face = -1; }
    else if(keys.right && !keys.left){ p.vx = spd; p.face = 1; }
    else p.vx *= 0.6;

    if(p.onGround) p.coyote = 6; else if(p.coyote > 0) p.coyote--;
    if(keys.jumpTap && p.coyote > 0){ p.vy = jmp; p.coyote = 0; p.onGround = false; }
    keys.jumpTap = false;
    if(!keys.jump && p.vy < -5) p.vy = -5;

    p.vy += GRAV;
    if(p.vy > MAXFALL) p.vy = MAXFALL;

    p.x += p.vx;
    if(p.x < 0) p.x = 0;
    if(p.x + p.w > L.worldW) p.x = L.worldW - p.w;
    var i;
    for(i=0;i<L.plats.length;i++){
      var pl = L.plats[i];
      if(hit(p, pl)){
        if(p.vx > 0) p.x = pl.x - p.w; else if(p.vx < 0) p.x = pl.x + pl.w;
        p.vx = 0;
      }
    }
    p.y += p.vy;
    p.onGround = false;
    for(i=0;i<L.plats.length;i++){
      var q = L.plats[i];
      if(hit(p, q)){
        if(p.vy > 0){
          p.y = q.y - p.h; p.vy = 0; p.onGround = true;
          // standing on a platform makes it your new safe spot
          if(!G.checkpoint || q.x + 4 > G.checkpoint.x){
            G.checkpoint = {x: Math.min(Math.max(p.x, q.x+4), q.x+q.w-p.w-4), y: q.y - p.h - 2};
          }
        } else if(p.vy < 0){ p.y = q.y + q.h; p.vy = 1; }
      }
    }
    p.anim += Math.abs(p.vx)*0.2;
    if(p.inv > 0) p.inv--;
    if(G.speedT > 0) G.speedT--;
    if(G.jumpT  > 0) G.jumpT--;

    if(p.y > H + 120){ hurt('fall'); return; }

    for(i=0;i<L.enemies.length;i++){
      var en = L.enemies[i];
      if(!en.alive) continue;
      en.t++;
      en.x += en.dir*en.spd;
      if(en.x < en.minX){ en.x = en.minX; en.dir = 1; }
      if(en.x > en.maxX){ en.x = en.maxX; en.dir = -1; }
      if(hit(p, en)){
        if(p.vy > 0 && (p.y + p.h) - en.y < 22){
          en.alive = false; p.vy = -10; G.shake = 8;
          pop(en.x+14, en.y+8, 'BOP!', '#ff5a6e');
        } else if(p.inv <= 0){ hurt(); return; }
      }
    }

    for(i=0;i<L.items.length;i++){
      var it = L.items[i];
      it.t++;
      if(it.got) continue;
      if(p.x < it.x+15 && p.x+p.w > it.x-15 && p.y < it.y+15 && p.y+p.h > it.y-15){
        it.got = true; grab(it);
      }
    }

    var d = L.door;
    if(p.x < d.x+d.w && p.x+p.w > d.x && p.y < d.y+d.h && p.y+p.h > d.y) finishRound();

    var want = p.x - W*0.36;
    if(want < 0) want = 0;
    if(want > L.worldW - W) want = L.worldW - W;
    G.cam += (want - G.cam)*0.12;

    if(G.shake > 0) G.shake--;
    for(i=G.pops.length-1;i>=0;i--){ var pp = G.pops[i]; pp.life--; pp.y -= 0.9;
      if(pp.life <= 0) G.pops.splice(i,1); }
  }

  function grab(it){
    if(it.kind === 'coin'){
      save.coins=Math.min(Number.MAX_SAFE_INTEGER,save.coins+1); G.roundCoins++; store(); pop(it.x, it.y-8, '+1', '#ffc93c');
    } else if(it.kind === 'star'){
      save.coins=Math.min(Number.MAX_SAFE_INTEGER,save.coins+3); G.roundCoins += 3; store(); pop(it.x, it.y-8, '+3!', '#e5b3ff');
    } else if(it.kind === 'speed'){
      G.speedT = BOOST; pop(it.x, it.y-8, 'FAST!', '#4cc9ff');
    } else if(it.kind === 'jump'){
      G.jumpT = BOOST; pop(it.x, it.y-8, 'HIGH!', '#5ef2b0');
    } else if(it.kind === 'heart'){
      if(G.hearts < 5) G.hearts++;
      pop(it.x, it.y-8, '+1 LIFE', '#ff5a6e');
    }
    paintCoinTotals();
  }

  function hit(a,b){ return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y; }

  function hurt(cause){
    if(G.mode!=='play' || (cause!=='fall' && G.p.inv>0)) return;
    G.hearts--; G.shake = 12;
    if(G.hearts <= 0){ G.mode = 'over'; showPanels(); }
    else { respawn(false); pop(G.p.x+14, G.p.y-14, 'OUCH', '#ff5a6e'); }
  }

  function finishRound(){
    if(G.mode!=='play') return;
    if(G.round >= 5){ G.mode = 'win'; }
    else {
      G.mode = 'clear';
      document.getElementById('clearTitle').textContent = 'Round ' + G.round + ' done!';
      document.getElementById('clearText').textContent =
        'You picked up ' + G.roundCoins + ' coin' + (G.roundCoins===1?'':'s') +
        ' and finished with ' + G.hearts + ' heart' + (G.hearts===1?'':'s') + '.';
    }
    if(G.round+1 > save.best) save.best = G.round+1;
    store(); showPanels();
  }

  function pop(x,y,txt,col){ G.pops.push({x:x,y:y,txt:txt,col:col,life:48}); }

  /* ---------- draw ---------- */
  function draw(){
    var g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0,'#3b2a6b'); g.addColorStop(1,'#141338');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);

    if(!G.lvl){ drawTitleScene(); return; }
    var L = G.lvl;
    var sx = G.shake ? (Math.random()-0.5)*G.shake : 0;
    var sy = G.shake ? (Math.random()-0.5)*G.shake : 0;

    ctx.save();
    ctx.translate(-G.cam + sx, sy);
    drawSkyline();

    // spike floor
    ctx.fillStyle = '#6f2340';
    ctx.fillRect(G.cam-20, H-34, W+40, 40);
    ctx.fillStyle = '#ff5a6e';
    for(var s=Math.floor((G.cam-20)/28)*28; s < G.cam+W+28; s+=28){
      ctx.beginPath(); ctx.moveTo(s, H-34); ctx.lineTo(s+14, H-56); ctx.lineTo(s+28, H-34);
      ctx.closePath(); ctx.fill();
    }

    var i;
    for(i=0;i<L.plats.length;i++){
      var p = L.plats[i];
      if(p.x + p.w < G.cam-40 || p.x > G.cam+W+40) continue;
      ctx.fillStyle = p.goal ? '#b3852a' : '#2c9c70';
      rr(ctx, p.x, p.y+5, p.w, p.h, 7); ctx.fill();
      ctx.fillStyle = p.goal ? '#ffc93c' : (p.start ? '#6f5ad6' : '#5ef2b0');
      rr(ctx, p.x, p.y, p.w, p.h, 7); ctx.fill();
    }

    // door
    var d = L.door;
    ctx.fillStyle = '#1d6b4d'; rr(ctx, d.x-3, d.y-3, d.w+6, d.h+3, 8); ctx.fill();
    ctx.fillStyle = '#5ef2b0'; rr(ctx, d.x, d.y, d.w, d.h, 6); ctx.fill();
    ctx.fillStyle = '#0b0d26';
    ctx.beginPath(); ctx.arc(d.x+d.w-9, d.y+d.h/2, 3.5, 0, 7); ctx.fill();
    ctx.font = 'bold 14px Nunito, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fff4e0'; ctx.fillText('GOAL', d.x+d.w/2, d.y-12);

    for(i=0;i<L.items.length;i++){
      var it = L.items[i];
      if(it.got || it.x < G.cam-40 || it.x > G.cam+W+40) continue;
      drawItem(ctx, it.kind, it.x, it.y + Math.sin(it.t*0.07)*3.5, 14);
    }
    for(i=0;i<L.enemies.length;i++){
      var en = L.enemies[i];
      if(!en.alive || en.x < G.cam-60 || en.x > G.cam+W+60) continue;
      drawEnemy(en);
    }
    drawPlayer();

    ctx.textAlign = 'center';
    for(i=0;i<G.pops.length;i++){
      var pp = G.pops[i];
      ctx.globalAlpha = Math.min(1, pp.life/26);
      ctx.fillStyle = pp.col;
      ctx.font = 'bold 20px Bungee, Nunito, sans-serif';
      ctx.fillText(pp.txt, pp.x, pp.y);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if(G.mode === 'play') drawHud();
  }

  function drawHud(){
    var L = G.lvl;
    ctx.save();
    ctx.font = '15px Bungee, Nunito, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0b0d2688'; rr(ctx, 12, 12, 250, 34, 10); ctx.fill();
    ctx.fillStyle = '#fff4e0'; ctx.fillText('Round ' + G.round, 24, 30);
    var hx = 110;
    for(var i=0;i<G.hearts;i++){ heart(ctx, hx + i*22, 29, 8, '#ff5a6e'); }

    // coins
    ctx.fillStyle = '#0b0d2688'; rr(ctx, W-118, 12, 106, 34, 10); ctx.fill();
    drawItem(ctx, 'coin', W-96, 29, 11);
    ctx.fillStyle = '#ffc93c'; ctx.textAlign = 'left';
    ctx.fillText(String(save.coins), W-76, 30);

    // boost timers
    var by = 58;
    if(G.speedT > 0){ boostBar(12, by, G.speedT, '#4cc9ff', 'SPEED'); by += 26; }
    if(G.jumpT  > 0){ boostBar(12, by, G.jumpT,  '#5ef2b0', 'JUMP'); }

    // progress bar
    var pct = Math.max(0, Math.min(1, G.p.x / (L.worldW - 120)));
    ctx.fillStyle = '#ffffff22'; rr(ctx, W/2-110, 18, 220, 12, 6); ctx.fill();
    ctx.fillStyle = '#5ef2b0'; rr(ctx, W/2-110, 18, Math.max(12, 220*pct), 12, 6); ctx.fill();
    ctx.fillStyle = '#fff4e0'; ctx.font = '11px Bungee, Nunito, sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('START', W/2-130, 25); ctx.fillText('GOAL', W/2+130, 25);
    ctx.restore();
  }
  function boostBar(x,y,t,col,label){
    ctx.fillStyle = '#0b0d2688'; rr(ctx, x, y, 132, 20, 7); ctx.fill();
    ctx.fillStyle = col; rr(ctx, x+4, y+4, 124*(t/BOOST), 12, 5); ctx.fill();
    ctx.fillStyle = '#0b0d26'; ctx.font = '11px Bungee, Nunito, sans-serif';
    ctx.textAlign = 'left'; ctx.fillText(label, x+10, y+11);
  }

  function drawSkyline(){
    ctx.fillStyle = '#ffffff0e';
    var start = Math.floor((G.cam*0.45 - 100)/150)*150;
    for(var i=0;i<14;i++){
      var bx = start + i*150;
      var h = 150 + ((Math.abs(Math.floor(bx/150))%4))*60;
      rr(ctx, bx + G.cam*0.55, H-34-h, 100, h, 5); ctx.fill();
    }
  }

  function drawItem(c, kind, x, y, r){
    var it = ITEMS[kind] || ITEMS.coin;
    c.fillStyle = it.dark; c.beginPath(); c.arc(x, y+2.5, r, 0, 7); c.fill();
    c.fillStyle = it.col;  c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.fillStyle = it.dark;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    if(kind === 'coin'){
      c.font = 'bold ' + Math.round(r*1.25) + 'px Nunito, sans-serif';
      c.fillText('H', x, y+1);
    } else if(kind === 'speed'){
      c.beginPath();
      c.moveTo(x+r*0.28, y-r*0.62); c.lineTo(x-r*0.42, y+r*0.1);
      c.lineTo(x-r*0.05, y+r*0.1);  c.lineTo(x-r*0.28, y+r*0.66);
      c.lineTo(x+r*0.45, y-r*0.14); c.lineTo(x+r*0.06, y-r*0.14);
      c.closePath(); c.fill();
    } else if(kind === 'jump'){
      c.beginPath();
      c.moveTo(x, y-r*0.6); c.lineTo(x+r*0.55, y+r*0.05); c.lineTo(x+r*0.22, y+r*0.05);
      c.lineTo(x+r*0.22, y+r*0.6); c.lineTo(x-r*0.22, y+r*0.6); c.lineTo(x-r*0.22, y+r*0.05);
      c.lineTo(x-r*0.55, y+r*0.05); c.closePath(); c.fill();
    } else if(kind === 'heart'){
      heart(c, x, y, r*0.62, it.dark);
    } else if(kind === 'star'){
      star(c, x, y, 5, r*0.72, r*0.32); c.fill();
    }
    c.textBaseline = 'alphabetic';
  }

  function heart(c, x, y, s, col){
    c.fillStyle = col; c.beginPath();
    c.moveTo(x, y + s*0.9);
    c.bezierCurveTo(x - s*1.6, y - s*0.35, x - s*0.55, y - s*1.5, x, y - s*0.45);
    c.bezierCurveTo(x + s*0.55, y - s*1.5, x + s*1.6, y - s*0.35, x, y + s*0.9);
    c.closePath(); c.fill();
  }
  function star(c, cx, cy, spikes, outer, inner){
    var rot = Math.PI/2*3, step = Math.PI/spikes;
    c.beginPath(); c.moveTo(cx, cy-outer);
    for(var i=0;i<spikes;i++){
      c.lineTo(cx+Math.cos(rot)*outer, cy+Math.sin(rot)*outer); rot += step;
      c.lineTo(cx+Math.cos(rot)*inner, cy+Math.sin(rot)*inner); rot += step;
    }
    c.closePath();
  }
  function rr(c,x,y,w,h,r){
    c.beginPath(); c.moveTo(x+r,y);
    c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r);
    c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath();
  }

  function drawEnemy(en){
    var wob = Math.sin(en.t*0.15)*2;
    ctx.fillStyle = '#b32d3d'; rr(ctx, en.x+1, en.y+4+wob, en.w, en.h, 8); ctx.fill();
    ctx.fillStyle = '#ff5a6e'; rr(ctx, en.x, en.y+wob, en.w, en.h, 8); ctx.fill();
    ctx.fillStyle = '#fff4e0';
    ctx.beginPath(); ctx.arc(en.x+9,  en.y+11+wob, 5, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(en.x+20, en.y+11+wob, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#0b0d26';
    ctx.beginPath(); ctx.arc(en.x+9 +en.dir*1.6, en.y+11+wob, 2.4, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(en.x+20+en.dir*1.6, en.y+11+wob, 2.4, 0, 7); ctx.fill();
    ctx.strokeStyle = '#0b0d26'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(en.x+14, en.y+25+wob, 5, Math.PI*1.15, Math.PI*1.85); ctx.stroke();
  }

  function drawPlayer(){
    var p = G.p;
    if(p.inv > 0 && Math.floor(p.inv/4)%2 === 0) return;
    if(G.speedT > 0){
      ctx.fillStyle = '#4cc9ff44';
      for(var i=1;i<=3;i++) rr(ctx, p.x - p.face*i*9, p.y+3, p.w, p.h-4, 8), ctx.fill();
    }
    var squash = p.onGround ? Math.sin(p.anim)*1.6 : 0;
    drawGuy(ctx, p.x, p.y - squash, p.w, p.h + squash, skinById(save.skin), p.face);
    if(G.jumpT > 0){
      ctx.strokeStyle = '#5ef2b0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x+p.w/2, p.y+p.h/2, p.w*0.95, 0, 7); ctx.stroke();
    }
  }

  function drawGuy(c, x, y, w, h, s, face){
    c.fillStyle = s.dark;
    c.fillRect(x+4, y+h-5, 8, 5);
    c.fillRect(x+w-12, y+h-5, 8, 5);
    rr(c, x+1, y+3, w, h-4, 9); c.fill();
    c.fillStyle = s.body; rr(c, x, y, w, h-4, 9); c.fill();
    c.fillStyle = '#fff4e0';
    c.beginPath(); c.arc(x+w*0.32, y+h*0.35, 5, 0, 7); c.fill();
    c.beginPath(); c.arc(x+w*0.68, y+h*0.35, 5, 0, 7); c.fill();
    c.fillStyle = '#0b0d26';
    c.beginPath(); c.arc(x+w*0.32+face*1.7, y+h*0.35, 2.5, 0, 7); c.fill();
    c.beginPath(); c.arc(x+w*0.68+face*1.7, y+h*0.35, 2.5, 0, 7); c.fill();
    c.strokeStyle = '#0b0d26'; c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath(); c.arc(x+w/2, y+h*0.55, 5.5, 0.25, Math.PI-0.25); c.stroke();
    if(s.hat === 'ears'){
      c.fillStyle = s.body;
      c.beginPath(); c.moveTo(x+2,y+2); c.lineTo(x+7,y-9); c.lineTo(x+14,y+1); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(x+w-2,y+2); c.lineTo(x+w-7,y-9); c.lineTo(x+w-14,y+1); c.closePath(); c.fill();
    } else if(s.hat === 'star'){
      c.fillStyle = '#ffc93c'; star(c, x+w/2, y-8, 5, 9, 4); c.fill();
    } else if(s.hat === 'band'){
      c.fillStyle = '#ff5a6e'; c.fillRect(x-2, y+h*0.2, w+4, 5);
    } else if(s.hat === 'crown'){
      c.fillStyle = '#ffc93c'; c.beginPath();
      c.moveTo(x+3,y+1); c.lineTo(x+3,y-10); c.lineTo(x+w*0.33,y-4);
      c.lineTo(x+w/2,y-13); c.lineTo(x+w*0.67,y-4); c.lineTo(x+w-3,y-10);
      c.lineTo(x+w-3,y+1); c.closePath(); c.fill();
    }
  }

  function drawTitleScene(){
    var t = Date.now()/650;
    drawSkyline();
    var lanes = [[130,380],[300,300],[470,380],[640,300]];
    for(var i=0;i<lanes.length;i++){
      ctx.fillStyle = '#2c9c70'; rr(ctx, lanes[i][0], lanes[i][1]+5, 120, 16, 7); ctx.fill();
      ctx.fillStyle = '#5ef2b0'; rr(ctx, lanes[i][0], lanes[i][1], 120, 16, 7); ctx.fill();
    }
    drawItem(ctx, 'jump', 360, 262 + Math.sin(t)*3, 14);
    drawItem(ctx, 'coin', 700, 342 + Math.sin(t+1)*3, 14);
    drawGuy(ctx, 170, 344 + Math.sin(t)*3, 28, 32, skinById(save.skin), 1);
  }

  function loop(){ update(); draw(); requestAnimationFrame(loop); }

  /* ---------- input ---------- */
  function key(e, down){
    var k = e.key;
    if(k==='ArrowLeft'||k==='a'||k==='A'){ keys.left = down; e.preventDefault(); }
    if(k==='ArrowRight'||k==='d'||k==='D'){ keys.right = down; e.preventDefault(); }
    if(k===' '||k==='ArrowUp'||k==='w'||k==='W'){
      if(down && !keys.jump) keys.jumpTap = true;
      keys.jump = down; e.preventDefault();
    }
  }
  window.addEventListener('keydown', function(e){
    if(e.key==='Escape'){
      if(e.repeat){e.preventDefault();return;}
      if(G.mode==='help'||G.mode==='shop'){closeGamePanel();e.preventDefault();return;}
      if(G.mode==='play'){if(userPaused)resumeGame();else pauseGame();e.preventDefault();return;}
    }
    key(e,true);
  });
  window.addEventListener('keyup', function(e){ key(e,false); });
  function bindPad(el, on, off){
    el.addEventListener('pointerdown', function(e){ e.preventDefault(); on(); });
    ['pointerup','pointerleave','pointercancel'].forEach(function(t){
      el.addEventListener(t, function(e){ e.preventDefault(); off(); });
    });
  }
  bindPad(document.getElementById('padL'), function(){keys.left=true;},  function(){keys.left=false;});
  bindPad(document.getElementById('padR'), function(){keys.right=true;}, function(){keys.right=false;});
  bindPad(document.getElementById('padJ'),
    function(){ if(!keys.jump) keys.jumpTap = true; keys.jump = true; },
    function(){ keys.jump = false; });

  /* ---------- ui ---------- */
  var P = {
    menu:document.getElementById('menu'), help:document.getElementById('help'),
    shop:document.getElementById('shop'), clear:document.getElementById('clear'),
    over:document.getElementById('over'), win:document.getElementById('win')
  };
  var pads = document.getElementById('pads');
  function showPanels(){
    for(var k in P) P[k].hidden = (G.mode !== k);
    pads.hidden = (G.mode !== 'play');
    paintCoinTotals();
  }
  function coinText(value){return value<10000?String(value):new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(value);}
  function paintCoinTotals(){
    var els = document.querySelectorAll('.coinTotal');
    for(var i=0;i<els.length;i++) els[i].textContent = coinText(save.coins);
  }

  document.getElementById('btnPlay').onclick  = function(){ startRound(1); };
  document.getElementById('btnHelp').onclick  = function(){ G.mode='help'; buildLegend(); showPanels(); };
  document.getElementById('btnShop').onclick  = openCharacterShop;
  document.getElementById('btnShop2').onclick = openCharacterShop;
  document.getElementById('btnNext').onclick  = function(){ startRound(G.round+1); };
  document.getElementById('btnRetry').onclick = function(){ startRound(G.round); };
  Array.prototype.forEach.call(document.querySelectorAll('[data-back]'), function(b){
    b.onclick = closeGamePanel;
  });

  function buildLegend(){
    var box = document.getElementById('legend');
    if(box.childNodes.length) return;
    ['coin','speed','jump','heart','star'].forEach(function(k){
      var row = document.createElement('div'); row.className = 'leg';
      var c = document.createElement('canvas'); c.width = 30; c.height = 30;
      drawItem(c.getContext('2d'), k, 15, 15, 12);
      var txt = document.createElement('span');
      txt.innerHTML = '<b>' + ITEMS[k].label + '</b> — ' + ITEMS[k].help;
      row.appendChild(c); row.appendChild(txt); box.appendChild(row);
    });
    var row2 = document.createElement('div'); row2.className = 'leg';
    var c2 = document.createElement('canvas'); c2.width = 30; c2.height = 30;
    var cc = c2.getContext('2d');
    cc.fillStyle = '#ff5a6e'; rr(cc, 3, 3, 24, 24, 7); cc.fill();
    cc.fillStyle = '#fff4e0';
    cc.beginPath(); cc.arc(11, 12, 4, 0, 7); cc.fill();
    cc.beginPath(); cc.arc(20, 12, 4, 0, 7); cc.fill();
    cc.fillStyle = '#0b0d26';
    cc.beginPath(); cc.arc(12, 12, 2, 0, 7); cc.fill();
    cc.beginPath(); cc.arc(21, 12, 2, 0, 7); cc.fill();
    var t2 = document.createElement('span');
    t2.innerHTML = '<b>Enemy</b> — jump on its head!';
    row2.appendChild(c2); row2.appendChild(t2); box.appendChild(row2);
  }

  function buildShop(){
    var grid = document.getElementById('shopGrid');
    grid.innerHTML = '';
    SKINS.forEach(function(s){
      var owned = save.owned.indexOf(s.id) >= 0, on = save.skin === s.id;
      var b = document.createElement('button');
      b.className = 'skin' + (owned?' owned':'') + (on?' on':'');
      var c = document.createElement('canvas'); c.width = 50; c.height = 50;
      drawGuy(c.getContext('2d'), 11, 9, 28, 32, s, 1);
      var nm = document.createElement('span'); nm.className='nm'; nm.textContent = s.name;
      var pr = document.createElement('span'); pr.className='pr';
      pr.textContent = on ? 'Wearing' : (owned ? 'Tap to wear' : 'Ⓗ ' + s.price);
      b.appendChild(c); b.appendChild(nm); b.appendChild(pr);
      b.onclick = function(){
        if(save.owned.indexOf(s.id) >= 0){ save.skin = s.id; }
        else if(save.coins >= s.price){
          save.coins -= s.price; save.owned.push(s.id); save.skin = s.id;
        } else { pr.textContent = 'Need ' + (s.price - save.coins) + ' more'; return; }
        store(); paintCoinTotals(); buildShop();
      };
      grid.appendChild(b);
    });
  }

  /* ---------- boot ---------- */
  function start(data){
    if(data && data.save){
      try{
        save.coins = data.save.coins|0;
        save.owned = data.save.owned || save.owned;
        save.skin  = data.save.skin  || save.skin;
      }catch(e){}
    }
    showPanels(); loop();
  }
  if(window.claude && window.claude.hot){
    try{ window.claude.hot.snapshot(function(){ return {save:save}; }); }catch(e){}
  }
  if(window.claude && window.claude.hot && window.claude.hot.ready) window.claude.hot.ready(start);
  else start((window.claude && window.claude.hot && window.claude.hot.data) || {});
})();
