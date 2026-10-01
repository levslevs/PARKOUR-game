  var shopReturnMode='menu', shopReturnFocus=null, lastPanelMode=null;
  function focusGameElement(el){
    if(el && !el.hidden && !el.disabled) el.focus({preventScroll:true});
  }
  function openCharacterShop(){
    if(G.mode==='shop') return;
    shopReturnMode=G.mode;
    shopReturnFocus=document.activeElement;
    if(G.mode==='play') pauseGame();
    G.mode='shop';
    document.getElementById('shopStatus').textContent='';
    document.getElementById('btnCloseShop').textContent=shopReturnMode==='play'?'Back to paused game':shopReturnMode==='win'?'Back to your victory':shopReturnMode==='clear'?'Back to round complete':'Back to menu';
    buildShop();showPanels();
  }
  function closeGamePanel(){
    if(G.mode==='shop'){
      var previous=shopReturnMode;
      G.mode=previous;
      showPanels();
      if(previous==='play') focusGameElement(document.getElementById('btnResume'));
      else if(shopReturnFocus && shopReturnFocus.isConnected) focusGameElement(shopReturnFocus);
      return;
    }
    goToMenu();
  }
  function goToMenu(){
    releaseControls();resetFrameClock();
    userPaused=false;G.mode='menu';G.lvl=null;
    shopReturnMode='menu';shopReturnFocus=null;
    showPanels();
  }
  function shopMessage(message){document.getElementById('shopStatus').textContent=message;}
  function buildShop() {
    var grid=document.getElementById('shopGrid'), focused=document.activeElement;
    var focusedId=focused && focused.dataset ? focused.dataset.skin : null;
    var scroller=grid.parentElement, scrollTop=scroller?scroller.scrollTop:0;
    grid.innerHTML='';
    SKINS.forEach(function(s) {
      var owned=save.owned.indexOf(s.id)>=0, on=save.skin===s.id;
      var a=CHARACTER_ART[s.id], ready=a.status==='ready' && a.image, failed=a.status==='error';
      var needed=Math.max(0,s.price-save.coins);
      var b=document.createElement('button');b.type='button';b.dataset.skin=s.id;
      b.className='skin'+(owned?' owned':'')+(on?' on':'')+(!owned&&!needed?' affordable':'');
      b.setAttribute('aria-pressed',String(on));
      var action=!ready?(failed?'Retry image':'Loading image'):on?'Selected':owned?'Choose character':'Unlock · ✦ '+s.price;
      var label=!ready?s.name+', '+action:on?s.name+', selected':owned?'Choose '+s.name:'Unlock '+s.name+' for '+s.price+' coins';
      b.setAttribute('aria-label',label+(!owned&&needed?', need '+needed+' more coins':''));
      if(!ready&&!failed) b.setAttribute('aria-disabled','true');
      var preview=document.createElement('span');preview.className='skin-preview';
      var c=document.createElement('canvas'); c.width=240; c.height=180;c.setAttribute('aria-hidden','true');
      if(ready){
        var crop=a.crop, sw=crop[2]-crop[0], sh=crop[3]-crop[1];
        var size=Math.min(155/sw,157/sh), cc=c.getContext('2d');
        cc.imageSmoothingQuality='high';
        cc.drawImage(a.image,crop[0],crop[1],sw,sh,120-sw*size/2,166-sh*size,sw*size,sh*size);
      }
      preview.appendChild(c);
      if(!ready){var status=document.createElement('span');status.className='skin-image-status';status.textContent=failed?'Image unavailable':'Loading…';preview.appendChild(status);}
      var tag=document.createElement('span'); tag.className='skin-tag'; tag.textContent=s.bonus?'BONUS SKIN':'CORE CREW';
      var nm=document.createElement('span'); nm.className='nm'; nm.textContent=s.name;
      var desc=document.createElement('span'); desc.className='skin-desc'; desc.textContent=s.description;
      var pr=document.createElement('span'); pr.className='pr';pr.textContent=on&&ready?'✓ Selected':action;
      var hint=document.createElement('span');hint.className='skin-cost-hint';hint.textContent=owned?'Already yours':needed?'Need '+needed+' more coins':'Ready to unlock';
      b.appendChild(tag);b.appendChild(preview);b.appendChild(nm);b.appendChild(desc);b.appendChild(pr);b.appendChild(hint);
      b.onclick=function() {
        if(a.status!=='ready'){
          if(a.status==='error'){
            shopMessage('Loading '+s.name+' again…');
            var retry=loadCharacter(s.id,true);buildShop();
            retry.then(function(ok){if(G.mode==='shop'){shopMessage(ok?s.name+' is ready.':'Still unable to load '+s.name+'. Try again when connected.');buildShop();}});
          }else shopMessage(s.name+' is still loading. You can choose another character.');
          return;
        }
        if(save.owned.indexOf(s.id)>=0) { save.skin=s.id;playSound('select');shopMessage(s.name+' selected.'); }
        else if(save.coins>=s.price) { save.coins-=s.price;save.owned.push(s.id);save.skin=s.id;playSound('unlock');shopMessage(s.name+' unlocked and selected. '+save.coins+' coins left.'); }
        else {shopMessage('Collect '+(s.price-save.coins)+' more coins to unlock '+s.name+'.');playSound('no');return;}
        store();paintCoinTotals();refreshAssetUI();buildShop();
      };
      grid.appendChild(b);
      if(focusedId===s.id) focusGameElement(b);
    });
    if(scroller) scroller.scrollTop=scrollTop;
  }

  function buildLegend() {
    var box=document.getElementById('legend');
    if(box.childNodes.length) return;
    ['coin','speed','jump','heart','star'].forEach(function(k) {
      var row=document.createElement('div'); row.className='leg';
      var c=document.createElement('canvas'); c.width=84; c.height=84;
      drawItem(c.getContext('2d'),k,42,40,27); c.setAttribute('aria-hidden','true');
      var txt=document.createElement('span');
      var title=document.createElement('b'); title.textContent=ITEMS[k].label;
      var desc=document.createElement('span'); desc.textContent=ITEMS[k].help;
      txt.appendChild(title); txt.appendChild(desc);
      row.appendChild(c); row.appendChild(txt); box.appendChild(row);
    });
    var row=document.createElement('div'); row.className='leg';
    var enemy=document.createElement('canvas'); enemy.width=84; enemy.height=84;
    var ec=enemy.getContext('2d'); ec.scale(2,2); drawEnemy({x:7,y:7,w:28,h:28,dir:1,t:0},ec);
    enemy.setAttribute('aria-hidden','true');
    var txt=document.createElement('span'); txt.innerHTML='<b>Enemy</b><span>Land on its head to bop it.</span>';
    row.appendChild(enemy); row.appendChild(txt); box.appendChild(row);
  }

  function showPanels() {
    for(var k in P) P[k].hidden=(G.mode!==k);
    pads.hidden=(G.mode!=='play');
    document.getElementById('stage').dataset.mode=G.mode;
    document.getElementById('game').setAttribute('aria-hidden',String(G.mode!=='play'));
    paintCoinTotals();
    if(lastPanelMode!==G.mode){
      var focusId={menu:'btnPlay',help:'helpTitle',shop:'shopTitle',play:'game',clear:'btnNext',over:'btnRetry',win:'btnShop2'}[G.mode];
      var target=document.getElementById(focusId);
      if(G.mode==='menu' && target.disabled) target=document.getElementById('btnShop');
      focusGameElement(target);lastPanelMode=G.mode;
    }
  }
  document.getElementById('btnWalletShop').onclick=openCharacterShop;
  document.getElementById('btnPauseShop').onclick=openCharacterShop;
  document.getElementById('btnPauseMenu').onclick=goToMenu;
  var homeLink=document.querySelector('.brand');
  if(homeLink) homeLink.onclick=function(e){e.preventDefault();goToMenu();};

  var soundEnabled=false, audioContext=null;
  try { soundEnabled=localStorage.getItem('parkourEnemiesSound')==='on'; } catch(e) {}
  function playSound(kind) {
    if(!soundEnabled) return;
    try {
      if(!audioContext) audioContext=new (window.AudioContext||window.webkitAudioContext)();
      if(audioContext.state==='suspended') audioContext.resume();
      var notes={coin:[880,1175],star:[784,988,1318],jump:[290,580],bop:[180,105],hurt:[185,130,95],
        select:[550,740],unlock:[523,659,784,1047],no:[155],clear:[659,784,988,1318],boost:[392,784,1175]};
      var ns=notes[kind]||notes.select, now=audioContext.currentTime;
      ns.forEach(function(freq,i) {
        var osc=audioContext.createOscillator(), gain=audioContext.createGain(), t=now+i*.065;
        osc.type=(kind==='bop'||kind==='hurt')?'triangle':'sine'; osc.frequency.setValueAtTime(freq,t);
        gain.gain.setValueAtTime(0,t); gain.gain.linearRampToValueAtTime(.09,t+.008);
        gain.gain.exponentialRampToValueAtTime(.0001,t+.16);
        osc.connect(gain); gain.connect(audioContext.destination); osc.start(t); osc.stop(t+.17);
      });
    } catch(e) {}
  }
  function paintSoundButton() {
    var b=document.getElementById('btnSound');
    if(!b) return;
    b.textContent=soundEnabled?'♫ Sound on':'♫ Sound off'; b.setAttribute('aria-pressed',String(soundEnabled));
    var gameSound=document.getElementById('btnGameSound');
    if(gameSound){gameSound.textContent=soundEnabled?'♫ On':'♫ Off';gameSound.setAttribute('aria-pressed',String(soundEnabled));}
  }
  var soundButton=document.getElementById('btnSound');
  if(soundButton) soundButton.onclick=function() {
    soundEnabled=!soundEnabled;
    try {localStorage.setItem('parkourEnemiesSound',soundEnabled?'on':'off');} catch(e) {}
    paintSoundButton(); playSound('select');
    if(!gameInputBlocked()) cv.focus({preventScroll:true});
  };
  paintSoundButton();
  var fullButton=document.getElementById('btnFullscreen');
  if(fullButton) {
    if(!document.documentElement.requestFullscreen) fullButton.hidden=true;
    fullButton.onclick=function() {
      var change=document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();
      if(change && change.catch) change.catch(function(){});
      if(!gameInputBlocked()) cv.focus({preventScroll:true});
    };
    document.addEventListener('fullscreenchange',function() {
      fullButton.setAttribute('aria-pressed',String(!!document.fullscreenElement));
      fullButton.textContent=document.fullscreenElement?'↙ Exit fullscreen':'↗ Fullscreen';
    });
  }
  // Cosmetic audio observes existing events without changing their results.
  var originalGrab=grab;
  grab=function(it){originalGrab(it);playSound(it.kind==='coin'?'coin':it.kind==='star'?'star':'boost');};
  var originalPop=pop;
  pop=function(x,y,txt,col){originalPop(x,y,txt,col);if(txt==='BOP!')playSound('bop');else if(txt==='OUCH')playSound('hurt');};
  var originalFinishRound=finishRound;
  finishRound=function(){originalFinishRound();playSound('clear');};
  var originalUpdate=update;
  update=function(){var previousVy=G.p.vy;originalUpdate();if(G.mode==='play'&&G.p.vy<previousVy-5&&G.p.vy<-11)playSound('jump');};
