  /* Soft 3D world art. All geometry and state remain owned by the game. */
  function artGlow(c, x, y, r, color) {
    var g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(x-r, y-r, r*2, r*2);
  }

  function artOval(c, x, y, rx, ry, color) {
    c.fillStyle = color; c.beginPath(); c.ellipse(x,y,rx,ry,0,0,Math.PI*2); c.fill();
  }

  function artSparkle(c, x, y, r, color) {
    c.fillStyle=color; c.beginPath();
    c.moveTo(x,y-r); c.quadraticCurveTo(x+r*.2,y-r*.2,x+r,y);
    c.quadraticCurveTo(x+r*.2,y+r*.2,x,y+r);
    c.quadraticCurveTo(x-r*.2,y+r*.2,x-r,y);
    c.quadraticCurveTo(x-r*.2,y-r*.2,x,y-r); c.fill();
  }

  function artCloud(c, x, y, s, alpha) {
    if(x+100*s < -24 || x-100*s > W+24) return;
    c.save(); c.globalAlpha=alpha; c.translate(x,y); c.scale(s,s);
    var g=c.createLinearGradient(0,-26,0,18);
    g.addColorStop(0,'#9baecc'); g.addColorStop(1,'#425579'); c.fillStyle=g;
    c.beginPath(); c.moveTo(-64,13);
    c.bezierCurveTo(-93,11,-83,-12,-56,-12);
    c.bezierCurveTo(-57,-35,-20,-38,-13,-20);
    c.bezierCurveTo(2,-47,43,-30,42,-10);
    c.bezierCurveTo(79,-19,93,12,62,15);
    c.bezierCurveTo(29,18,-28,18,-64,13); c.fill(); c.restore();
  }

  function artIsland(c, x, y, s, alpha, variant) {
    if(x+100*s < -24 || x-100*s > W+24) return;
    c.save(); c.translate(x,y); c.scale(s,s); c.globalAlpha=alpha;
    var g=c.createLinearGradient(0,-5,0,93);
    g.addColorStop(0,'#577d91'); g.addColorStop(.2,'#435a7b'); g.addColorStop(1,'#283655');
    c.fillStyle=g; c.beginPath(); c.moveTo(-94,0);
    c.bezierCurveTo(-54,-5,56,-9,95,0);
    c.bezierCurveTo(76,31,35,29,19,70);
    c.quadraticCurveTo(9,94,-1,65); c.bezierCurveTo(-17,39,-65,37,-94,0); c.fill();
    artOval(c,0,-2,95,9,'#779da0');
    c.fillStyle='#658c91';
    c.beginPath(); c.moveTo(-76,-4); c.quadraticCurveTo(-51,-25,-28,-5);
    c.quadraticCurveTo(6,-33,42,-6); c.quadraticCurveTo(67,-23,85,-4); c.fill();
    for(var i=0;i<3;i++) {
      var tx=-50+i*46+(variant%3)*5, th=19+(i+variant)%3*11;
      c.fillStyle='#597f88'; rr(c,tx-2,-th-5,4,th,2); c.fill();
      var tg=c.createLinearGradient(tx-10,0,tx+13,0);
      tg.addColorStop(0,'#91b9ad'); tg.addColorStop(1,'#557f8b');
      artOval(c,tx,-th,10,th*.54,tg);
    }
    c.strokeStyle='#8eaab0'; c.globalAlpha=alpha*.24; c.lineWidth=3;
    c.beginPath(); c.moveTo(45,13); c.quadraticCurveTo(28,42,14,47); c.stroke();
    c.restore();
  }

  function drawSkyline() {
    ctx.save(); ctx.translate(G.cam,0);
    var sky=ctx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0,'#172642'); sky.addColorStop(.47,'#34486b');
    sky.addColorStop(.77,'#51527d'); sky.addColorStop(1,'#382f55');
    ctx.fillStyle=sky; ctx.fillRect(-24,-24,W+48,H+48);
    artGlow(ctx,540,217,354,'rgba(130,133,185,.23)');
    artGlow(ctx,72,409,330,'rgba(52,156,160,.15)');
    var time=Date.now()*.00025;
    for(var i=0;i<54;i++) {
      var tx=((i*137.37+25-G.cam*.018)%(W+40)+W+40)%(W+40)-20;
      var ty=76+(i*57.71)%277;
      var a=.18+(Math.sin(time+i*2.4)+1)*.13;
      if(i%9===0) artSparkle(ctx,tx,ty,2.5,'rgba(226,241,241,'+a+')');
      else artOval(ctx,tx,ty,i%5===0?1.3:.8,i%5===0?1.3:.8,'rgba(226,241,241,'+a+')');
    }
    var mx=614-G.cam*.014, my=144;
    artGlow(ctx,mx,my,126,'rgba(255,204,162,.15)');
    var moon=ctx.createRadialGradient(mx-15,my-20,4,mx,my,46);
    moon.addColorStop(0,'#fff3d1'); moon.addColorStop(.72,'#f8d4b5'); moon.addColorStop(1,'#e5ad9b');
    artOval(ctx,mx,my,43,43,moon);
    ctx.strokeStyle='rgba(255,229,204,.18)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.arc(mx,my,51,0,Math.PI*2); ctx.stroke();
    artOval(ctx,mx+15,my+13,9,8,'rgba(209,146,147,.12)');
    artOval(ctx,mx-19,my+7,5,5,'rgba(209,146,147,.11)');
    artOval(ctx,mx+10,my-18,4,4,'rgba(255,248,222,.3)');
    for(var j=-1;j<5;j++) {
      var cloudX=j*262-((G.cam*.055) % 262);
      artCloud(ctx,cloudX,184+(j%2)*43,1.1,.11);
    }
    for(var k=-1;k<5;k++) {
      var ix=k*310-((G.cam*.15)%310)+60;
      artIsland(ctx,ix,258+(k%2)*31,.72,.27,k+4);
    }
    for(var n=-1;n<4;n++) {
      var nearX=n*365-((G.cam*.25)%365)+130;
      artIsland(ctx,nearX,385+(n%2)*46,1.25,.19,n+3);
    }
    var mist=ctx.createLinearGradient(0,375,0,H);
    mist.addColorStop(0,'rgba(47,51,82,0)'); mist.addColorStop(1,'rgba(34,29,59,.85)');
    ctx.fillStyle=mist; ctx.fillRect(0,375,W,H-375); ctx.restore();
  }

  function artPlatform(p) {
    var x=p.x,y=p.y,w=p.w,h=p.h;
    var bonus=p.route==='bonus';
    ctx.save();
    artOval(ctx,x+w/2,y+43,w*.46,9,'rgba(17,19,42,.1)');
    var stone=ctx.createLinearGradient(x,y+9,x+w*.28,y+46);
    stone.addColorStop(0,'#74699b'); stone.addColorStop(.43,'#62577f'); stone.addColorStop(1,'#3c395b');
    ctx.fillStyle=stone; ctx.beginPath(); ctx.moveTo(x+6,y+10);
    ctx.lineTo(x+w-6,y+10); ctx.quadraticCurveTo(x+w-9,y+28,x+w-25,y+33);
    ctx.lineTo(x+w*.69,y+37); ctx.quadraticCurveTo(x+w*.53,y+47,x+w*.38,y+35);
    ctx.lineTo(x+24,y+31); ctx.quadraticCurveTo(x+10,y+29,x+6,y+10); ctx.fill();
    ctx.fillStyle='rgba(169,146,191,.17)'; ctx.beginPath();
    ctx.moveTo(x+13,y+15); ctx.lineTo(x+w*.43,y+17); ctx.lineTo(x+w*.36,y+34);
    ctx.lineTo(x+25,y+28); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(24,24,48,.16)'; ctx.beginPath();
    ctx.moveTo(x+w*.64,y+17); ctx.lineTo(x+w-11,y+16); ctx.lineTo(x+w-24,y+30);
    ctx.lineTo(x+w*.66,y+36); ctx.closePath(); ctx.fill();
    var edge=ctx.createLinearGradient(0,y,0,y+h+3);
    edge.addColorStop(0,p.goal?'#f9daa0':'#87e6c5');
    edge.addColorStop(.48,p.goal?'#e1b669':'#54b9a4');
    edge.addColorStop(1,p.goal?'#946c40':'#2d746f');
    ctx.fillStyle=edge; rr(ctx,x,y,w,h+2,7); ctx.fill();
    var top=ctx.createLinearGradient(0,y,0,y+9);
    top.addColorStop(0,p.goal?'#ffebbc':bonus?'#f7e3ac':'#b4f5d6');
    top.addColorStop(1,p.goal?'#eac887':bonus?'#dfbb72':'#73d8b7');
    ctx.fillStyle=top; rr(ctx,x+.6,y,w-1.2,9,4.5); ctx.fill();
    ctx.strokeStyle=p.goal||bonus?'rgba(255,249,217,.65)':'rgba(221,255,230,.63)'; ctx.lineWidth=1.3;
    ctx.beginPath(); ctx.moveTo(x+6,y+1.2); ctx.lineTo(x+w-6,y+1.2); ctx.stroke();
    ctx.strokeStyle='rgba(22,72,72,.12)'; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(x+9,y+10); ctx.lineTo(x+w-9,y+10); ctx.stroke();
    for(var i=0;i<Math.floor(w/29);i++) {
      artOval(ctx,x+15+i*28,y+5,2.2,.65,p.goal||bonus?'rgba(255,246,211,.4)':'rgba(207,255,222,.45)');
    }
    /* Mineral details sit beneath the landing edge. */
    artOval(ctx,x+w*.24,y+22,3.2,1.4,'rgba(170,204,205,.27)');
    artOval(ctx,x+w*.73,y+25,2,1.1,'rgba(156,226,206,.24)');
    if(bonus) {
      artSparkle(ctx,x+w/2,y+22,3.4,'rgba(251,219,144,.72)');
    } else if(!p.goal) {
      ctx.strokeStyle='rgba(32,107,91,.42)'; ctx.lineWidth=1.5;
      ctx.lineCap='round'; ctx.lineJoin='round';
      for(var mark=0;mark<2;mark++) {
        var mx=x+w-35+mark*8;
        ctx.beginPath(); ctx.moveTo(mx,y+3); ctx.lineTo(mx+3,y+5.5);
        ctx.lineTo(mx,y+8); ctx.stroke();
      }
    }
    if(p.start && G.round===1 && G.mode==='play' && G.p.x<x+w+60) {
      ctx.font='800 10px "Avenir Next", sans-serif';
      ctx.textAlign='center'; ctx.textBaseline='alphabetic';
      ctx.fillStyle='rgba(214,241,229,.83)';
      ctx.fillText('HOLD TO JUMP FARTHER',x+w/2,y-100);
      ctx.strokeStyle='rgba(190,227,215,.65)'; ctx.lineWidth=1.5;
      ctx.lineCap='round'; ctx.lineJoin='round';
      var ax=x+w/2+72, ay=y-99;
      ctx.beginPath(); ctx.moveTo(ax,ay); ctx.quadraticCurveTo(ax+5,ay-9,ax+13,ay-8);
      ctx.lineTo(ax+10,ay-11); ctx.moveTo(ax+13,ay-8); ctx.lineTo(ax+9,ay-5); ctx.stroke();
    }
    ctx.restore();
  }

  function artCrystal(x,y,w,h,alpha) {
    ctx.save(); ctx.globalAlpha=alpha;
    var g=ctx.createLinearGradient(x,y-h,x+w,y+7);
    g.addColorStop(0,'#ffb3b6'); g.addColorStop(.35,'#df7b9d'); g.addColorStop(1,'#763e75');
    ctx.fillStyle=g; ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+w*.47,y-h);
    ctx.lineTo(x+w,y); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,197,205,.29)'; ctx.beginPath(); ctx.moveTo(x,y);
    ctx.lineTo(x+w*.47,y-h); ctx.lineTo(x+w*.47,y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='rgba(255,211,213,.42)'; ctx.lineWidth=.75;
    ctx.beginPath(); ctx.moveTo(x+w*.08,y-1); ctx.lineTo(x+w*.47,y-h); ctx.stroke(); ctx.restore();
  }

  function artPortal(d) {
    ctx.save(); var cx=d.x+d.w/2;
    artGlow(ctx,cx,d.y+d.h*.48,68,'rgba(131,255,205,.2)');
    artOval(ctx,cx,d.y+d.h+3,29,5,'rgba(24,30,42,.32)');
    var outer=ctx.createLinearGradient(d.x,d.y,d.x+d.w,d.y+d.h);
    outer.addColorStop(0,'#fff2ba'); outer.addColorStop(.36,'#e5c579'); outer.addColorStop(1,'#a7814c');
    ctx.fillStyle='#796547'; rr(ctx,d.x-6,d.y-8,d.w+12,d.h+10,22); ctx.fill();
    ctx.fillStyle=outer; rr(ctx,d.x-6,d.y-11,d.w+12,d.h+12,22); ctx.fill();
    var inside=ctx.createLinearGradient(0,d.y-4,0,d.y+d.h);
    inside.addColorStop(0,'#9ef8d7'); inside.addColorStop(.4,'#57c1b0'); inside.addColorStop(1,'#285870');
    ctx.fillStyle=inside; rr(ctx,d.x,d.y-4,d.w,d.h+4,17); ctx.fill();
    ctx.strokeStyle='rgba(219,255,224,.8)'; ctx.lineWidth=1.3;
    rr(ctx,d.x+1.5,d.y-2,d.w-3,d.h+1,15); ctx.stroke();
    var t=Date.now()*.002;
    for(var i=0;i<7;i++) {
      var py=d.y+6+((i*9-t*7)%41+41)%41;
      artOval(ctx,cx+Math.sin(i*12)*10,py,.8,.8,'rgba(236,255,229,.75)');
    }
    ctx.strokeStyle='#efffe3'; ctx.lineWidth=2.5; ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.beginPath(); ctx.moveTo(cx-7,d.y+25); ctx.lineTo(cx+7,d.y+25);
    ctx.moveTo(cx+2,d.y+20); ctx.lineTo(cx+7,d.y+25); ctx.lineTo(cx+2,d.y+30); ctx.stroke();
    ctx.fillStyle='#d8b978'; rr(ctx,d.x-9,d.y+d.h-2,d.w+18,6,3); ctx.fill();
    ctx.fillStyle='#fff0bd'; rr(ctx,d.x-7,d.y+d.h-3,d.w+14,3,1.5); ctx.fill();
    ctx.font='900 10px "Avenir Next", sans-serif'; ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillStyle='#fff2d3'; ctx.fillText('FINISH',cx,d.y-20);
    artSparkle(ctx,d.x-12,d.y+8,3,'#e6ffe6'); artSparkle(ctx,d.x+d.w+11,d.y+29,2,'#e6ffe6');
    ctx.restore();
  }

  function draw() {
    if(!G.lvl) { drawTitleScene(); return; }
    var L=G.lvl;
    var sx=G.shake?(Math.random()-.5)*G.shake:0, sy=G.shake?(Math.random()-.5)*G.shake:0;
    ctx.save(); ctx.translate(-G.cam+sx,sy); drawSkyline();
    ctx.translate(0,-(renderViewY || 0));
    var i;
    /* Crystals mark the original falling zone without changing its rules. */
    var first=Math.floor((G.cam-50)/31)*31;
    for(var s=first;s<G.cam+W+60;s+=62) {
      var sh=17+(Math.abs(Math.floor(s/31))*7)%19;
      artCrystal(s-5,H-13,29,sh,.32);
    }
    var floor=ctx.createLinearGradient(0,H-31,0,H);
    floor.addColorStop(0,'rgba(77,38,76,0)'); floor.addColorStop(1,'#44213f');
    ctx.fillStyle=floor; ctx.fillRect(G.cam-25,H-42,W+50,65);
    for(s=first;s<G.cam+W+60;s+=31) {
      artCrystal(s,H+3,31,34+(Math.abs(Math.floor(s/31))*13)%19,.88);
    }
    for(i=0;i<L.plats.length;i++) {
      var p=L.plats[i];
      if(p.x+p.w<G.cam-45||p.x>G.cam+W+45) continue;
      artPlatform(p);
    }
    if(L.door.x>G.cam-90 && L.door.x<G.cam+W+90) artPortal(L.door);
    for(i=0;i<L.items.length;i++) {
      var it=L.items[i];
      if(it.got||it.x<G.cam-40||it.x>G.cam+W+40) continue;
      var bob=Math.sin(it.t*.07)*3.5;
      artOval(ctx,it.x,it.y+27,9,2,'rgba(21,48,60,.12)');
      drawItem(ctx,it.kind,it.x,it.y+bob,14);
    }
    for(i=0;i<L.enemies.length;i++) {
      var en=L.enemies[i];
      if(!en.alive||en.x<G.cam-60||en.x>G.cam+W+60) continue;
      drawEnemy(en);
    }
    drawPlayer();
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    for(i=0;i<G.pops.length;i++) {
      var pp=G.pops[i]; ctx.globalAlpha=Math.min(1,pp.life/26);
      ctx.font='900 18px "Avenir Next", sans-serif'; ctx.lineWidth=4;
      ctx.strokeStyle='rgba(26,31,57,.8)'; ctx.strokeText(pp.txt,pp.x,pp.y);
      ctx.fillStyle=pp.col; ctx.fillText(pp.txt,pp.x,pp.y);
    }
    ctx.restore(); if(G.mode==='play') drawHud();
  }

  function artHudCapsule(x,y,w,h) {
    ctx.fillStyle='rgba(8,20,37,.18)'; rr(ctx,x,y+3,w,h,16); ctx.fill();
    var g=ctx.createLinearGradient(0,y,0,y+h);
    g.addColorStop(0,'rgba(30,48,70,.96)'); g.addColorStop(1,'rgba(20,34,56,.94)');
    ctx.fillStyle=g; rr(ctx,x,y,w,h,16); ctx.fill();
    ctx.strokeStyle='rgba(180,213,225,.14)'; ctx.lineWidth=1; rr(ctx,x+.5,y+.5,w-1,h-1,15.5); ctx.stroke();
    ctx.strokeStyle='rgba(214,234,231,.11)';
    ctx.beginPath(); ctx.moveTo(x+16,y+1); ctx.lineTo(x+w-16,y+1); ctx.stroke();
  }

  function drawHud() {
    ctx.save(); ctx.textBaseline='middle'; ctx.textAlign='left';
    artHudCapsule(18,16,190,52);
    var badge=ctx.createLinearGradient(32,25,61,58);
    badge.addColorStop(0,'#b9f2d1'); badge.addColorStop(1,'#60bca6');
    ctx.fillStyle=badge; rr(ctx,29,25,34,34,11); ctx.fill();
    ctx.fillStyle='#214757'; ctx.font='900 20px "Avenir Next", sans-serif'; ctx.textAlign='center';
    ctx.fillText(String(G.round),46,43);
    ctx.textAlign='left'; ctx.font='900 9px "Avenir Next", sans-serif'; ctx.fillStyle='#a9becb';
    ctx.fillText('ROUND '+String(G.round).padStart(2,'0')+' / 05',77,31);
    for(var i=0;i<5;i++) {
      var hx=83+i*22;
      heart(ctx,hx,49,7.5,i<G.hearts?'#f49ca8':'#3b4b64');
      if(i<G.hearts) artOval(ctx,hx-2.6,45.7,1.8,.9,'rgba(255,231,223,.63)');
    }
    artHudCapsule(243,16,274,52);
    var pct=Math.max(0,Math.min(1,G.p.x/(G.lvl.worldW-120)));
    ctx.textAlign='left'; ctx.font='900 9px "Avenir Next", sans-serif'; ctx.fillStyle='#a9becb';
    ctx.fillText('TO THE FINISH',259,31);
    ctx.textAlign='right'; ctx.fillStyle='#d8f5e4'; ctx.fillText(Math.round(pct*100)+'%',500,31);
    ctx.fillStyle='#10243a'; rr(ctx,259,44,239,7,3.5); ctx.fill();
    var progress=ctx.createLinearGradient(259,0,498,0);
    progress.addColorStop(0,'#5bbca9'); progress.addColorStop(1,'#c9f1bd');
    ctx.fillStyle=progress; rr(ctx,259,44,Math.max(7,239*pct),7,3.5); ctx.fill();
    artOval(ctx,262+232*pct,47.5,4,4,'#d9ffe6');
    artHudCapsule(623,16,119,52);
    drawItem(ctx,'coin',645,43,12);
    ctx.textAlign='left'; ctx.font='900 8px "Avenir Next", sans-serif'; ctx.fillStyle='#a9becb';
    ctx.fillText('COINS',665,29); ctx.fillStyle='#ffdf9f';
    ctx.font='900 '+(save.coins>9999?'15':'20')+'px "Avenir Next", sans-serif';
    ctx.fillText(coinText(save.coins),665,47);
    var by=80;
    if(G.speedT>0) { boostBar(18,by,G.speedT,'#8ce0f2','SPEED BOOST'); by+=32; }
    if(G.jumpT>0) boostBar(18,by,G.jumpT,'#aaf0c4','HIGH JUMP');
    ctx.restore();
  }

  function boostBar(x,y,t,col,label) {
    ctx.save(); ctx.fillStyle='rgba(18,35,55,.9)'; rr(ctx,x,y,169,25,9); ctx.fill();
    ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.font='900 8px "Avenir Next", sans-serif';
    ctx.fillStyle=col; ctx.fillText(label,x+10,y+9);
    ctx.textAlign='right'; ctx.fillStyle='#dcefe9'; ctx.fillText(Math.ceil(t/60)+'s',x+158,y+9);
    ctx.fillStyle='#32465c'; rr(ctx,x+10,y+17,148,3,1.5); ctx.fill();
    ctx.fillStyle=col; rr(ctx,x+10,y+17,Math.max(3,148*Math.min(1,t/BOOST)),3,1.5); ctx.fill(); ctx.restore();
  }

  function drawItem(c,kind,x,y,r) {
    c.save(); var coin=kind==='coin';
    var palette={coin:['#fff0b6','#f6cb70','#b88637','#8d5f2c'],speed:['#d9faff','#83d7ed','#3b94ba','#275775'],
      jump:['#e0ffe3','#9de7be','#4eab91','#326f64'],heart:['#ffe0dc','#f5a1b1','#ce698e','#873f64'],
      star:['#f2e3ff','#c6aff0','#9976c7','#634982']};
    var p=palette[kind]||palette.coin;
    artGlow(c,x,y,r*1.95,coin?'rgba(255,213,122,.13)':'rgba(199,230,255,.1)');
    artOval(c,x,y+r*.18,r,r,p[3]);
    var rim=c.createLinearGradient(x-r,y-r,x+r,y+r);
    rim.addColorStop(0,p[0]); rim.addColorStop(.5,p[1]); rim.addColorStop(1,p[2]);
    artOval(c,x,y,r,r,rim);
    var face=c.createRadialGradient(x-r*.3,y-r*.35,r*.03,x,y,r*.85);
    face.addColorStop(0,p[0]); face.addColorStop(.55,p[1]); face.addColorStop(1,p[2]);
    artOval(c,x,y,r*.78,r*.78,face);
    c.strokeStyle='rgba(255,255,237,.48)'; c.lineWidth=r*.065;
    c.beginPath(); c.arc(x,y,r*.79,Math.PI*1.04,Math.PI*1.88); c.stroke();
    c.strokeStyle=p[3]; c.globalAlpha=.28;
    c.beginPath(); c.arc(x,y,r*.8,.12,Math.PI*.93); c.stroke(); c.globalAlpha=1;
    c.fillStyle=p[3]; c.textAlign='center'; c.textBaseline='middle';
    if(coin) {
      c.font='900 '+Math.round(r*1.08)+'px "Avenir Next", sans-serif';
      c.fillStyle=p[0]; c.fillText('H',x,y+r*.1); c.fillStyle=p[3]; c.fillText('H',x,y+.2);
    } else if(kind==='speed') {
      c.beginPath(); c.moveTo(x+r*.2,y-r*.56); c.lineTo(x-r*.37,y+r*.05);
      c.lineTo(x-r*.03,y+r*.05); c.lineTo(x-r*.2,y+r*.57);
      c.lineTo(x+r*.38,y-r*.1); c.lineTo(x+r*.05,y-r*.1); c.closePath(); c.fill();
    } else if(kind==='jump') {
      c.lineWidth=r*.2; c.strokeStyle=p[3]; c.lineCap='round'; c.lineJoin='round';
      c.beginPath(); c.moveTo(x,y+r*.42); c.lineTo(x,y-r*.4);
      c.moveTo(x-r*.35,y-r*.04); c.lineTo(x,y-r*.42); c.lineTo(x+r*.35,y-r*.04); c.stroke();
    } else if(kind==='heart') heart(c,x,y,r*.51,p[3]);
    else if(kind==='star') { star(c,x,y,5,r*.56,r*.26); c.fill(); }
    artOval(c,x-r*.43,y-r*.5,r*.17,r*.09,'rgba(255,255,250,.72)');
    c.restore();
  }

  function drawEnemy(en, c) {
    c=c||ctx;
    c.save(); var wob=Math.sin(en.t*.15)*.75,x=en.x,y=en.y+wob;
    artOval(c,x+14,en.y+28,16,3.3,'rgba(25,39,56,.2)');
    /* Soft toy horns are part of the existing enemy silhouette. */
    var horn=c.createLinearGradient(0,y-3,0,y+10);
    horn.addColorStop(0,'#f9c1ac'); horn.addColorStop(1,'#c85b7b');
    c.fillStyle=horn;
    c.beginPath(); c.moveTo(x+1,y+7); c.quadraticCurveTo(x-3,y-5,x+4,y-2);
    c.lineTo(x+11,y+5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(x+18,y+4); c.lineTo(x+25,y-2);
    c.quadraticCurveTo(x+31,y-4,x+28,y+9); c.closePath(); c.fill();
    artOval(c,x+6,y+27,5,2.5,'#9f476a'); artOval(c,x+23,y+27,5,2.5,'#9f476a');
    c.fillStyle='#a14f72'; rr(c,x-1,y+2,30,25,10); c.fill();
    var body=c.createRadialGradient(x+8,y+5,1,x+15,y+13,23);
    body.addColorStop(0,'#ffb5b5'); body.addColorStop(.5,'#ee819c'); body.addColorStop(1,'#b75079');
    c.fillStyle=body; rr(c,x-1,y,30,26,10); c.fill();
    c.strokeStyle='rgba(255,212,207,.34)'; c.lineWidth=.8;
    c.beginPath(); c.moveTo(x+3,y+6); c.quadraticCurveTo(x+9,y-1,x+20,y+2); c.stroke();
    artOval(c,x+8,y+11,5,5.8,'#fff4e7'); artOval(c,x+21,y+11,5,5.8,'#fff4e7');
    artOval(c,x+8+en.dir*1.3,y+11.8,2.7,3.6,'#253444');
    artOval(c,x+21+en.dir*1.3,y+11.8,2.7,3.6,'#253444');
    artOval(c,x+7+en.dir*1.3,y+10,1,1,'#fff9ec');
    artOval(c,x+20+en.dir*1.3,y+10,1,1,'#fff9ec');
    c.strokeStyle='#85415f'; c.lineWidth=1.7; c.lineCap='round';
    c.beginPath(); c.moveTo(x+4,y+4); c.lineTo(x+11,y+6);
    c.moveTo(x+18,y+6); c.lineTo(x+25,y+4); c.stroke();
    c.strokeStyle='#743d59'; c.lineWidth=1.3;
    c.beginPath(); c.moveTo(x+11,y+21); c.quadraticCurveTo(x+15,y+18,x+19,y+21); c.stroke();
    artOval(c,x+3,y+17.7,2.3,1.2,'rgba(247,189,168,.45)');
    artOval(c,x+26,y+17.7,2.3,1.2,'rgba(247,189,168,.45)'); c.restore();
  }

  function drawTitleScene() {
    ctx.save(); ctx.translate(-G.cam,0); drawSkyline(); ctx.restore();
    ctx.save();
    artPlatform({x:-50,y:452,w:204,h:16});
    artPlatform({x:616,y:405,w:191,h:16});
    artPlatform({x:506,y:524,w:142,h:16});
    var t=Date.now()*.002;
    drawItem(ctx,'coin',93,415+Math.sin(t)*3,13);
    drawItem(ctx,'star',691,367+Math.sin(t+1)*3,13);
    ctx.restore();
  }
