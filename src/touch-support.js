  var inputOwners={left:new Set(),right:new Set(),jump:new Set()},padResetters;
  function setInput(action,owner,down){
    var owners=inputOwners[action],wasHeld=owners.size>0;
    if(down)owners.add(owner);else owners.delete(owner);
    keys[action]=owners.size>0;
    if(action==='jump'&&down&&!wasHeld&&keys.jump)keys.jumpTap=true;
  }
  function key(e,down){
    var k=e.key,action=(k==='ArrowLeft'||k==='a'||k==='A')?'left':
      (k==='ArrowRight'||k==='d'||k==='D')?'right':
      (k===' '||k==='ArrowUp'||k==='w'||k==='W')?'jump':null;
    if(!action)return;
    var owner='key:'+(e.code||String(k).toLowerCase());
    var target=e.target,interactive=target&&/^(BUTTON|A|INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
    // Space/Enter on interface buttons retain native browser activation.
    if(down&&(gameInputBlocked()||interactive||e.metaKey||e.ctrlKey||e.altKey))return;
    if(down&&e.repeat&&!inputOwners[action].has(owner))return;
    var held=inputOwners[action].has(owner);
    setInput(action,owner,down);
    if(!interactive&&!gameInputBlocked()&&(down||held))e.preventDefault();
  }
  function bindPad(el,on,off){
    var pointers=new Set(),action=el.id==='padL'?'left':el.id==='padR'?'right':'jump';
    if(!padResetters)padResetters=[];
    function reset(){pointers.forEach(function(id){setInput(action,'pointer:'+id,false);});pointers.clear();el.classList.remove('pressed');}
    padResetters.push(reset);el.tabIndex=-1;
    el.addEventListener('pointerdown',function(e){
      e.preventDefault();if(gameInputBlocked()||(e.pointerType==='mouse'&&e.button!==0))return;
      pointers.add(e.pointerId);setInput(action,'pointer:'+e.pointerId,true);
      if(el.setPointerCapture)try{el.setPointerCapture(e.pointerId);}catch(ignore){}
      el.classList.add('pressed');
    });
    function release(e){
      e.preventDefault();if(!pointers.has(e.pointerId))return;
      pointers.delete(e.pointerId);setInput(action,'pointer:'+e.pointerId,false);
      if(!pointers.size)el.classList.remove('pressed');
    }
    ['pointerup','pointercancel','lostpointercapture'].forEach(function(type){el.addEventListener(type,release);});
    el.addEventListener('contextmenu',function(e){e.preventDefault();});
  }

  var orientationBlocked=false,userPaused=false,frameTime=null,frameRemainder=0,sceneDirty=true;
  function requestSceneDraw(){sceneDirty=true;}
  function gameInputBlocked(){return G.mode!=='play'||orientationBlocked||userPaused||document.hidden;}
  function resetFrameClock(){frameTime=null;frameRemainder=0;sceneDirty=true;if(typeof resetRenderState==='function')resetRenderState();}
  function releaseControls(){
    Object.keys(inputOwners).forEach(function(action){inputOwners[action].clear();});
    keys.left=false;keys.right=false;keys.jump=false;keys.jumpTap=false;G.p.jumpBuffer=0;
    if(padResetters)padResetters.forEach(function(reset){reset();});
  }
  function refreshTouchUI(){
    var playing=G.mode==='play',paused=playing&&userPaused&&!orientationBlocked;
    document.getElementById('gameTools').hidden=!playing;document.getElementById('gameTools').inert=paused;
    document.getElementById('pauseScreen').hidden=!paused;
    document.getElementById('pads').hidden=!playing||userPaused||orientationBlocked;
    document.body.classList.toggle('is-playing',playing);
    document.getElementById('btnPause').setAttribute('aria-pressed',String(userPaused));sceneDirty=true;
  }
  function pauseGame(){
    if(G.mode==='play')userPaused=true;
    releaseControls();resetFrameClock();refreshTouchUI();
    if(G.mode==='play'&&!orientationBlocked&&!document.hidden)document.getElementById('btnResume').focus({preventScroll:true});
  }
  function resumeGame(){
    if(orientationBlocked||document.hidden||G.mode!=='play')return;
    userPaused=false;releaseControls();resetFrameClock();refreshTouchUI();cv.focus({preventScroll:true});
  }
  function checkOrientation(){
    var touch=(navigator.maxTouchPoints||0)>0||window.matchMedia('(pointer: coarse)').matches;
    var screenSize=window.screen,shortEdge=screenSize&&screenSize.width&&screenSize.height?
      Math.min(screenSize.width,screenSize.height):Math.min(window.innerWidth,window.innerHeight);
    var phone=/iPhone|iPod|Android.+Mobile/i.test(navigator.userAgent||'')||shortEdge<600;
    var blocked=touch&&phone&&window.innerHeight>window.innerWidth;
    if(blocked!==orientationBlocked){orientationBlocked=blocked;if(G.mode==='play')userPaused=true;releaseControls();resetFrameClock();}
    document.getElementById('rotateScreen').hidden=!blocked;document.getElementById('wrap').inert=blocked;
    document.body.classList.toggle('needs-rotation',blocked);refreshTouchUI();
    if(!blocked&&G.mode==='play'&&userPaused)document.getElementById('btnResume').focus({preventScroll:true});
  }
  function advanceClock(time){
    if(frameTime===null){frameTime=time;return;}
    var elapsed=Math.max(0,Math.min(100,time-frameTime));frameTime=time;
    if(gameInputBlocked()){frameRemainder=0;return;}
    frameRemainder+=elapsed;var step=1000/60;
    while(frameRemainder+0.00001>=step){
      if(typeof captureRenderState==='function')captureRenderState();update();frameRemainder-=step;
      if(gameInputBlocked()){frameRemainder=0;break;}
    }
  }
  function loop(time){
    advanceClock(typeof time==='number'?time:performance.now());
    if(!document.hidden&&(sceneDirty||!gameInputBlocked())){
      if(typeof renderFrame==='function')renderFrame(gameInputBlocked()?1:frameRemainder/(1000/60));else draw();sceneDirty=false;
    }
    requestAnimationFrame(loop);
  }
  var touchOriginalShowPanels=showPanels;
  showPanels=function(){touchOriginalShowPanels();if(G.mode!=='play')releaseControls();refreshTouchUI();fitCanvas();};
  var touchOriginalStartRound=startRound;
  startRound=function(round){userPaused=false;releaseControls();resetFrameClock();touchOriginalStartRound(round);checkOrientation();if(!orientationBlocked)cv.focus({preventScroll:true});};
  var touchOriginalUpdate=update;
  update=function(){if(!gameInputBlocked())touchOriginalUpdate();};
  cv.tabIndex=0;
  document.getElementById('btnPause').onclick=pauseGame;document.getElementById('btnResume').onclick=resumeGame;
  document.getElementById('btnGameSound').onclick=function(){document.getElementById('btnSound').click();};
  window.addEventListener('resize',checkOrientation);window.addEventListener('blur',pauseGame);
  document.addEventListener('visibilitychange',function(){if(document.hidden)pauseGame();else requestSceneDraw();});
  checkOrientation();

  window.addEventListener('parkourPause',pauseGame);
  if(window.parkourNative){
    document.documentElement.classList.add('native-app');
    document.getElementById('btnFullscreen').hidden=true;
    var aboutButton=document.getElementById('btnAbout');
    aboutButton.hidden=false;
    aboutButton.onclick=function(){window.webkit.messageHandlers.parkour.postMessage({action:'about'});};
  }
