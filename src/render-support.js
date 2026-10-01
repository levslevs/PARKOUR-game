  /* Presentation interpolates fixed simulation steps; collision state is restored after every draw. */
  var renderPrevious = null, renderViewY = 0;

  function renderCameraTarget(p) { return Math.min(0, p.y - 150); }
  function followRenderCamera(from, p) {
    // The upper guard includes the tallest hat and the fixed HUD.
    return Math.min(0, from + (renderCameraTarget(p) - from) * 0.16, p.y - 108);
  }
  function renderStateIsContinuous() {
    return renderPrevious && renderPrevious.level === G.lvl && renderPrevious.player === G.p &&
      Math.abs(G.p.x - renderPrevious.x) < 80 && Math.abs(G.p.y - renderPrevious.y) < 80;
  }
  function currentRenderCamera() {
    return renderStateIsContinuous() ? followRenderCamera(renderPrevious.camY, G.p) : renderCameraTarget(G.p);
  }
  function snapshotRenderState(camY) {
    return {
      level:G.lvl, player:G.p, x:G.p.x, y:G.p.y, anim:G.p.anim, cam:G.cam, camY:camY,
      enemies:G.lvl ? G.lvl.enemies.map(function(en) { return {x:en.x,y:en.y,t:en.t,alive:en.alive}; }) : [],
      items:G.lvl ? G.lvl.items.map(function(it) { return {t:it.t}; }) : []
    };
  }
  function resetRenderState(snapCamera) {
    renderPrevious = snapshotRenderState(snapCamera ? renderCameraTarget(G.p) : currentRenderCamera());
  }
  function captureRenderState() {
    renderPrevious = snapshotRenderState(currentRenderCamera());
  }
  function renderMix(a, b, alpha) { return a + (b-a)*alpha; }
  function renderFrame(alpha) {
    alpha = Math.max(0,Math.min(1,typeof alpha === 'number' && isFinite(alpha) ? alpha : 1));
    if(!renderStateIsContinuous()) resetRenderState(true);
    var previous=renderPrevious, player=G.p, level=G.lvl, camera=G.cam, previousViewY=renderViewY;
    var cameraY=currentRenderCamera();
    try {
      G.p=Object.assign({},player,{
        x:renderMix(previous.x,player.x,alpha), y:renderMix(previous.y,player.y,alpha),
        anim:renderMix(previous.anim,player.anim,alpha)
      });
      G.cam=renderMix(previous.cam,camera,alpha);
      renderViewY=renderMix(previous.camY,cameraY,alpha);
      if(level) G.lvl=Object.assign({},level,{
        enemies:level.enemies.map(function(en,i) {
          var from=previous.enemies[i];
          return from && from.alive === en.alive ? Object.assign({},en,{
            x:renderMix(from.x,en.x,alpha), y:renderMix(from.y,en.y,alpha), t:renderMix(from.t,en.t,alpha)
          }) : en;
        }),
        items:level.items.map(function(it,i) {
          var from=previous.items[i];
          return from ? Object.assign({},it,{t:renderMix(from.t,it.t,alpha)}) : it;
        })
      });
      draw();
    } finally {
      G.p=player; G.lvl=level; G.cam=camera; renderViewY=previousViewY;
    }
  }
