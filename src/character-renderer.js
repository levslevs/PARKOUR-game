  /* Real Soft 3D art, anchored to the original 28 x 32 collision box. */
  function drawGuy(c, x, y, w, h, s, face) {
    var a = CHARACTER_ART[s.id] || CHARACTER_ART.blue;
    if (!a || !a.image.complete || !a.image.naturalWidth) return;
    var b = a.crop, sw = b[2]-b[0], sh = b[3]-b[1];
    var scale = h/(a.footY-a.bodyTop);
    c.save(); c.imageSmoothingEnabled = true; c.imageSmoothingQuality = 'high';
    // Keep shirt lettering readable in either direction; motion supplies the lean.
    c.drawImage(a.image,b[0],b[1],sw,sh,
      x+w/2-(a.anchorX-b[0])*scale,y+h-sh*scale,sw*scale,sh*scale);
    c.restore();
  }

  function drawPlayer() {
    var p=G.p;
    if(p.inv>0 && Math.floor(p.inv/4)%2===0) return;
    ctx.save();
    if(p.onGround) artOval(ctx,p.x+p.w/2,p.y+p.h+1,18,3,'rgba(18,47,57,.23)');
    if(G.speedT>0) {
      for(var i=3;i>0;i--) {
        ctx.globalAlpha=.045*(4-i);
        drawGuy(ctx,p.x-p.face*i*11,p.y,p.w,p.h,skinById(save.skin),p.face);
      }
      ctx.globalAlpha=1;
    }
    var squash=p.onGround?Math.sin(p.anim)*1.3:0;
    var lean=p.onGround?Math.sin(p.anim*.5)*.028:Math.max(-.055,Math.min(.055,p.vx*.012));
    ctx.translate(p.x+p.w/2,p.y+p.h); ctx.rotate(lean);
    drawGuy(ctx,-p.w/2,-p.h-squash,p.w,p.h+squash,skinById(save.skin),p.face);
    ctx.restore();
    if(G.jumpT>0) {
      ctx.save(); ctx.strokeStyle='rgba(166,251,211,.8)'; ctx.lineWidth=1.4;
      ctx.beginPath(); ctx.ellipse(p.x+p.w/2,p.y+p.h+3,21,5,0,0,Math.PI*2); ctx.stroke();
      artSparkle(ctx,p.x-5,p.y+p.h*.5+Math.sin(Date.now()*.005)*6,2.3,'#cbffe1');
      ctx.restore();
    }
  }
