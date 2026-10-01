  function buildLevel(round) {
    // Each tuple is [gap before island, top, width, patrol, special pickup].
    // Long descents open into recovery decks; climbs leave a clear jump arc.
    var plans = [
      [[0,438,260],[80,410,220],[90,365,200],[100,395,300,1],
       [115,438,260,1,'heart'],[100,388,220],[110,345,280,1],[105,390,320]],
      [[0,438,260],[85,380,210],[95,315,260,1],
       [75,438,400,1,'heart'],[110,368,230],[105,310,260,1],
       [75,438,420,0,'speed'],[110,378,260,1],[115,405,320]],
      [[0,438,280],[110,378,220],[125,425,280,1,'speed'],
       [110,355,200],[130,410,320,1],[110,340,260,1],
       [75,438,400,1,'heart'],[115,368,260,1],[125,410,320]],
      [[0,438,280],[130,403,260,1,'speed'],[115,338,230],
       [135,383,340,1],[110,313,260,1],
       [75,438,420,1,'heart'],[115,368,240],[130,403,320,1],[135,360,340]],
      [[0,438,280],[110,378,220],[110,313,260,1],
       [75,438,400,1],[115,368,230],[105,298,240,1],
       [135,358,320,1,'speed'],[120,418,280,0,'heart'],
       [110,348,260,1],[130,398,340]]
    ];
    // An upper detour sits over the beginning of a broad catch island.
    // Its far end stays well behind that island's next takeoff zone.
    var forks = [[],[[2,218],[5,215]],[[5,220]],[[4,215]],[[2,218]]];
    var names = ['First steps','Skyward trails','Rolling islands','Long way round','The grand leap'];
    var spec=plans[Math.max(0,Math.min(4,round-1))], plats=[], items=[], enemies=[], mainPath=[], connections=[];
    var x=16;
    spec.forEach(function(s,i) {
      if(i) x+=spec[i-1][2]+s[0];
      var p={x:x,y:s[1],w:s[2],h:16,route:'main',mainIndex:i,start:i===0,goal:i===spec.length-1};
      mainPath.push(plats.length); plats.push(p);
      if(i) connections.push({from:i-1,to:i,route:'main'});
      if(i>0) items.push({kind:'coin',x:x+Math.min(88,p.w*.34),y:p.y-30,got:false,t:i*13});
      if(i>0 && !s[4] && !p.goal && i%2===0)
        items.push({kind:'coin',x:x+p.w*.55,y:p.y-30,got:false,t:i*13+20});
      if(s[4]) items.push({kind:s[4],x:x+p.w*.46,y:p.y-30,got:false,t:i*17});
      if(s[3]) {
        // The first 55% is a safe landing/run-up zone. Patrols guard the far side.
        var left=x+p.w*.58, right=x+p.w-40;
        enemies.push({x:(left+right)/2,y:p.y-28,w:28,h:28,minX:left,maxX:right,
          dir:i%2?1:-1,spd:(0.8+round*.18)*0.85,alive:true,t:i*11});
      }
    });
    forks[round-1].forEach(function(f) {
      var from=plats[f[0]], to=f[0]+1, b={x:from.x+from.w+85,y:f[1],w:170,h:16,
        route:'bonus',bonusFrom:f[0],bonusTo:to};
      var index=plats.length; plats.push(b);
      connections.push({from:f[0],to:index,route:'bonus'},{from:index,to:to,route:'bonus'});
      items.push({kind:'star',x:b.x+85,y:b.y-30,got:false,t:12});
      // The high-jump pickup is a deliberate reward, away from the required path.
      items.push({kind:'jump',x:b.x+135,y:b.y-30,got:false,t:35});
    });
    var goal=plats[mainPath[mainPath.length-1]];
    items.push({kind:'coin',x:goal.x+135,y:goal.y-30,got:false,t:20});
    return {plats:plats,items:items,enemies:enemies,mainPath:mainPath,connections:connections,
      name:names[round-1],goal:goal,door:{x:goal.x+goal.w-100,y:goal.y-52,w:36,h:52},
      worldW:goal.x+goal.w+80,start:{x:60,y:spec[0][1]-34}};
  }
