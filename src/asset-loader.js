  var assetsStarted=false, assetsNotifying=false;
  function characterReady(id){
    var art=CHARACTER_ART[id];
    return !!(art&&art.status==='ready'&&art.image&&art.image.naturalWidth);
  }
  function refreshAssetUI(){
    var ready=characterReady(save.skin), failed=CHARACTER_ART[save.skin].status==='error';
    var play=document.getElementById('btnPlay'), status=document.getElementById('assetStatus');
    play.disabled=!ready;play.setAttribute('aria-busy',String(!ready&&!failed));
    if(status){status.textContent=ready?'':failed?'Your hero could not load. Retry or choose another character.':'Loading your hero…';status.hidden=ready;}
    var retry=document.getElementById('btnRetryAssets');if(retry)retry.hidden=!failed;
  }
  function announceAssetChange(){
    refreshAssetUI();
    if(G.mode==='shop'&&!assetsNotifying){assetsNotifying=true;try{buildShop();}finally{assetsNotifying=false;}}
  }
  function loadCharacter(id,retry){
    var art=CHARACTER_ART[id];
    if(!art)return Promise.resolve(false);
    if(characterReady(id))return Promise.resolve(true);
    if(art.status==='loading')return art.promise;
    if(art.status==='error'&&!retry)return Promise.resolve(false);
    art.status='loading';
    art.promise=new Promise(function(resolve){
      var img=new Image(),settled=false;
      art.image=img;img.decoding='async';img.fetchPriority=id===save.skin?'high':'low';
      var timeout=setTimeout(function(){finish(false);img.src='';},12000);
      function finish(ok){
        if(settled)return;settled=true;clearTimeout(timeout);img.onload=null;img.onerror=null;art.status=ok?'ready':'error';
        if(ok)Array.prototype.forEach.call(document.querySelectorAll('img[data-character]'),function(node){
          if(node.dataset.character===id){node.src=ASSET_SRC[id];node.dataset.ready='true';}
        });
        announceAssetChange();resolve(ok);
      }
      img.onload=function(){finish(!!img.naturalWidth);};img.onerror=function(){finish(false);};img.src=ASSET_SRC[id];
    });
    refreshAssetUI();return art.promise;
  }
  function startAssetLoading(){
    if(assetsStarted)return;assetsStarted=true;document.getElementById('btnPlay').disabled=true;
    var retry=document.getElementById('btnRetryAssets');if(retry)retry.onclick=function(){loadCharacter(save.skin,true);};
    // Load the playable hero first; optional portraits never block the game.
    loadCharacter(save.skin).then(function(){Object.keys(CHARACTER_ART).forEach(function(id){if(id!==save.skin)loadCharacter(id);});});
  }
  function fitCanvas(){
    var renderScale=Math.min(2,Math.max(1,(window.devicePixelRatio||1)*cv.getBoundingClientRect().width/W));
    var width=Math.round(W*renderScale),height=Math.round(H*renderScale);
    if(cv.width!==width||cv.height!==height){cv.width=width;cv.height=height;ctx.setTransform(width/W,0,0,height/H,0,0);}
    if(typeof requestSceneDraw==='function')requestSceneDraw();
  }
  fitCanvas();window.addEventListener('resize',fitCanvas);
