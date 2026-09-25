(function(root) {
  'use strict';
  function createEngine(c) {
    var items = {};
    c.items.forEach(function(i) { items[i.id] = i; });
    function fresh(now) { return {version:c.version,coins:c.economy.startCoins,bank:0,xp:0,expansion:0,objects:[],collection:[],combos:[],goals:[],stories:{},nextId:1,last:now,revision:0,night:false,totalCollected:0}; }
    function level(s) { var n=1,need=c.economy.baseLevelXp,x=s.xp; while(n<c.economy.maxGardenLevel && x>=need){x-=need;n++;need+=c.economy.stepLevelXp;} return {value:n,current:x,need:need}; }
    function slots(s) { return c.expansions[s.expansion].slots; }
    function hours(s) { var h=8,l=level(s).value;c.offline.forEach(function(x){if(l>=x.level)h=x.hours;});return h; }
    function shape(o) { var i=items[o.item];return o.rotated?{w:i.h,h:i.w}:{w:i.w,h:i.h}; }
    function cells(o) { if(o.pos<0)return [];var d=shape(o),a=[];for(var y=0;y<d.h;y++)for(var x=0;x<d.w;x++)a.push(o.pos+y*3+x);return a; }
    function location(o) { var p=c.layout.anchors[o.pos%12]||[20,50];return {x:Number.isFinite(o.x)?o.x:p[0],y:Number.isFinite(o.y)?o.y:p[1],area:Math.floor(o.pos/12)}; }
    function validLook(item,look){var i=items[item];return !!i&&(!look||((look.size===undefined||Number.isInteger(look.size)&&look.size>=0&&look.size<c.visualSizes.length)&&(look.variant===undefined||Number.isInteger(look.variant)&&look.variant>=0&&look.variant<(i.variants?i.variants.length:1))));}
    function footprint(item,rotated,look) { var i=items[item],p=i.groundFootprint||c.layout.footprints[i.w*i.h-1],scale=look&&look.size!==undefined?c.visualSizes[look.size].scale:1,v=i.variants&&i.variants[look&&look.variant||0];scale*=v?v.ground:1;scale*=c.layout.freeEstate&&!i.groundFootprint?(i.groundScale||1):1;return {rx:p[0]*scale*(rotated&&i.w!==i.h ? 0.85 : 1),ry:p[1]*scale*(rotated&&i.w!==i.h ? 1.18 : 1)}; }
    function capacity(s,area){return Math.max(0,Math.min(12,slots(s)-area*12))*(c.layout.capacityMultiplier||1);}
    function inside(x,y,poly) { var yes=false;for(var i=0,j=poly.length-1;i<poly.length;j=i++){var a=poly[i],b=poly[j];if(((a[1]>y)!==(b[1]>y))&&(x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]))yes=!yes;}return yes; }
    function usedCapacity(s,area,exclude){return s.objects.reduce(function(n,o){var i=items[o.item];return n+(o.pos>=0&&Math.floor(o.pos/12)===area&&o.uid!==exclude?i.w*i.h:0);},0);}
    function legacyCanLand(s,item,area,x,y,rotated,exclude,look){
      if(!validLook(item,look)||!Number.isInteger(area)||area<0||area>3||!Number.isFinite(x)||!Number.isFinite(y))return false;
      var i=items[item],f=footprint(item,rotated,look),cap=capacity(s,area);
      if(usedCapacity(s,area,exclude)+i.w*i.h>cap)return false;
      var zones=c.layout.areaZones?c.layout.areaZones[area]:c.layout.zones;
      if(!zones.some(function(poly){return [[x,y],[x-f.rx,y],[x+f.rx,y],[x,y-f.ry],[x,y+f.ry],[x-f.rx*.7,y-f.ry*.7],[x+f.rx*.7,y-f.ry*.7],[x-f.rx*.7,y+f.ry*.7],[x+f.rx*.7,y+f.ry*.7]].every(function(p){return inside(p[0],p[1],poly);});}))return false;
      return !s.objects.some(function(o){if(o.pos<0||o.uid===exclude||Math.floor(o.pos/12)!==area)return false;var p=location(o),g=footprint(o.item,o.rotated,o);return Math.pow((x-p.x)/(f.rx+g.rx+1),2)+Math.pow((y-p.y)/(f.ry+g.ry+1),2)<1;});
    }
    function landReason(s,item,area,x,y,rotated,exclude,look){
      if(!c.layout.freeEstate)return legacyCanLand(s,item,area,x,y,rotated,exclude,look)?null:'noSpace';
      if(!validLook(item,look)||!Number.isInteger(area)||area<0||area>3||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>100||y<0||y>100)return 'outside';
      var f=footprint(item,rotated,look),gx=x+area%2*100,gy=y+Math.floor(area/2)*100;
      if(gx-f.rx<3||gx+f.rx>197||gy-f.ry<3||gy+f.ry>197)return 'outside';
      var used=s.objects.reduce(function(n,o){return n+(o.pos>=0&&(o.map||0)===(s.map||0)&&o.uid!==exclude?items[o.item].w*items[o.item].h:0);},0);
      if(used+items[item].w*items[item].h>slots(s)*(c.layout.capacityMultiplier||1))return 'capacityFull';
      var hit=s.objects.some(function(o){if(o.pos<0||o.uid===exclude||(o.map||0)!==(s.map||0))return false;var p=location(o),g=footprint(o.item,o.rotated,o),ox=p.x+p.area%2*100,oy=p.y+Math.floor(p.area/2)*100;return Math.pow((gx-ox)/(f.rx+g.rx),2)+Math.pow((gy-oy)/(f.ry+g.ry),2)<1;});
      if(lakeNew(s)){var terrain=lakeObjectReason(item,area,x,y,rotated,look);if(terrain)return terrain;}if(hit)return 'collision';if(['bridge','waterside','boat','laketea','lotus'].indexOf(item)>=0&&!nearWater(s,area,x,y,exclude))return 'waterNeeded';return null;
    }
    function canLand(s,item,area,x,y,rotated,exclude,look){return !landReason(s,item,area,x,y,rotated,exclude,look);}
    function suggest(s,item,area,rotated,exclude,skip,look){
      var candidates=c.layout.anchors.slice();for(var y=14;y<=88;y+=4)for(var x=14;x<=86;x+=4)candidates.push([x+(Math.floor(y)%3),y]);
      var valid=candidates.filter(function(p){return canLand(s,item,area,p[0],p[1],rotated,exclude,look);});if(!valid.length)return null;
      var inCourt=s.objects.filter(function(o){return o.pos>=0&&(o.map||0)===(s.map||0)&&o.uid!==exclude&&Math.floor(o.pos/12)===area;});
      var related=inCourt.filter(function(o){return c.combos.some(function(r){return r.items.indexOf(item)>=0&&r.items.indexOf(o.item)>=0&&item!==o.item&&r.items.every(function(id){return id===item||inCourt.some(function(n){return n.item===id;});});});});
      if(related.length)valid.sort(function(a,b){function score(p){return Math.min.apply(null,related.map(function(o){var l=location(o);return Math.pow(p[0]-l.x,2)+2*Math.pow(p[1]-l.y,2);}));}return score(a)-score(b);});
      var p=valid[(skip||0)%valid.length];return {x:p[0],y:p[1],area:area};
    }
    function storyState(s,id){return (s.stories&&s.stories[id])||[];}
    function storyReady(s,story){var done=storyState(s,story.id),ep=story.episodes[done.length];return !!ep&&ep.need.every(function(id){return s.collection.indexOf(id)>=0;})&&(!ep.minItemLevel||s.objects.some(function(o){return o.item===ep.need[0]&&o.level>=ep.minItemLevel;}));}
    function validPlace(s,item,pos,rotated,exclude) {
      if(!items[item]||!Number.isInteger(pos)||pos<0||pos>=slots(s))return false;
      var o={item:item,pos:pos,rotated:!!rotated},d=shape(o),local=pos%12;
      if(local%3+d.w>3||Math.floor(local/3)+d.h>4)return false;
      var used={};s.objects.forEach(function(p){if(p.uid!==exclude)cells(p).forEach(function(n){used[n]=true;});});
      return cells(o).every(function(n){return n<slots(s)&&!used[n];});
    }
    function adjacent(a,b) {
      if((a.map||0)!==(b.map||0)||a.pos<0||b.pos<0||(!c.layout.freeEstate&&Math.floor(a.pos/12)!==Math.floor(b.pos/12)))return false;
      if(Number.isFinite(a.x)||Number.isFinite(b.x)){var ap=location(a),bp=location(b);if(c.layout.freeEstate){ap.x+=ap.area%2*100;ap.y+=Math.floor(ap.area/2)*100;bp.x+=bp.area%2*100;bp.y+=Math.floor(bp.area/2)*100;}var af=footprint(a.item,a.rotated,a),bf=footprint(b.item,b.rotated,b);return Math.pow((ap.x-bp.x)/(af.rx+bf.rx+c.layout.near),2)+Math.pow((ap.y-bp.y)/(af.ry+bf.ry+c.layout.near),2)<=1;}
      var ac=cells(a),bc=cells(b);return ac.some(function(x){return bc.some(function(y){return Math.abs(x-y)===3||(Math.floor(x/3)===Math.floor(y/3)&&Math.abs(x-y)===1);});});
    }
    function combinations(s) {
      var bonuses={},active=[];
      c.combos.forEach(function(rule){
        var candidates=s.objects.filter(function(o){return o.pos>=0&&rule.items.indexOf(o.item)>=0;}),seen={};
        candidates.forEach(function(start){
          if(seen[start.uid])return;var group=[],queue=[start];seen[start.uid]=true;
          while(queue.length){var at=queue.shift();group.push(at);candidates.forEach(function(o){if(!seen[o.uid]&&adjacent(at,o)){seen[o.uid]=true;queue.push(o);}});}
          if(rule.items.every(function(id){return group.some(function(o){return o.item===id;});})){
            active.push({id:rule.id,uids:group.map(function(o){return o.uid;})});group.forEach(function(o){bonuses[o.uid]=Math.max(bonuses[o.uid]||0,rule.bonus);});
          }
        });
      });return {bonuses:bonuses,active:active};
    }
    function baseRate(o) { var i=items[o.item];return (i.income===undefined?c.tiers[i.tier-1].income:i.income)*(1+c.economy.levelGain*(o.level-1)); }
    function rate(s) { var b=combinations(s).bonuses;return s.objects.reduce(function(sum,o){return sum+(o.pos<0?0:baseRate(o)*(1+(b[o.uid]||0)));},0); }
    function advance(s,now) {
      if(!Number.isFinite(now)||now<s.last)return {amount:0,seconds:0,backward:true};
      var elapsed=now-s.last,limit=hours(s)*3600000,r=rate(s),cap=r*hours(s)*60;
      var amount=Math.max(0,Math.min(cap-s.bank,Math.min(elapsed,limit)/60000*r));
      s.bank=Math.min(c.economy.maxCoins,s.bank+amount);s.last=now;
      return {amount:amount,seconds:elapsed/1000,capped:elapsed>limit,backward:false};
    }
    function addXp(s,n) { s.xp=Math.min(1000000,s.xp+n); }
    function discover(s) { combinations(s).active.forEach(function(a){if(s.combos.indexOf(a.id)<0){s.combos.push(a.id);addXp(s,c.economy.comboXp);}}); }
    function price(id) { return items[id].price===undefined?c.tiers[items[id].tier-1].price:items[id].price; }
    function upgradeCost(o) { return Math.ceil(price(o.item)*c.economy.upgradeFactor*Math.pow(c.economy.upgradeGrowth,o.level-1)); }
    function goalValue(s,g) {
      if(g.kind==='placed')return s.objects.filter(function(o){return o.pos>=0;}).length;
      if(g.kind==='maxLevel')return s.objects.reduce(function(v,o){return Math.max(v,o.level);},0);
      if(g.kind==='combos')return s.combos.length;
      if(g.kind==='collection')return s.collection.length;
      if(g.kind==='slots')return slots(s);
      if(g.kind==='rate')return rate(s);
      if(g.kind==='tier')return s.collection.reduce(function(v,id){return Math.max(v,items[id].tier);},0);
      return 0;
    }
    function mapIds(s){return s.maps||[0];}
    function itemUnlocked(s,i){return !i.unlockMap||mapIds(s).indexOf(i.unlockMap)>=0;}
    function world(p){return {x:(p.x+p.area%2*100)/2,y:c.layout.world.top+(p.y+Math.floor(p.area/2)*100)*c.layout.world.band/100};}
    function nearWater(s,area,x,y,exclude){
      var p=world({area:area,x:x,y:y});
      if(lakeNew(s)&&p.x>=shoreline(p.y)-8)return true;if((s.map||0)===1&&!lakeNew(s)&&(p.x>88||p.y>87))return true;
      if(s.objects.some(function(o){if(o.pos<0||o.uid===exclude||(o.map||0)!==(s.map||0)||['pond','stream'].indexOf(o.item)<0)return false;var q=world(location(o));return Math.hypot(p.x-q.x,p.y-q.y)<16;}))return true;
      return (s.ground||[]).some(function(g){return (g.map||0)===(s.map||0)&&g.kind==='water'&&g.points.some(function(q){return Math.hypot(p.x-q[0],p.y-q[1])<6;});});
    }

    function lakeNew(s){return (s.map||0)===1&&s.lakeEdition===7;}
    function shoreline(y){var a=c.lakeScene.shore;if(y<=a[0][1])return a[0][0];for(var k=1;k<a.length;k++)if(y<=a[k][1])return a[k-1][0]+(a[k][0]-a[k-1][0])*(y-a[k-1][1])/(a[k][1]-a[k-1][1]);return a[a.length-1][0];}
    function lakePointReason(p,waterItem){if(c.lakeScene.fixedZones.some(function(poly){return inside(p.x,p.y,poly);}))return 'lakeLandmark';var d=c.lakeScene.dock,r=c.lakeScene.dockRadius;if(Math.pow((p.x-d[0])/r[0],2)+Math.pow((p.y-d[1])/r[1],2)<1)return 'lakeDock';if(p.x>=shoreline(p.y)-1&&!waterItem)return 'lakeWater';return null;}
    function lakeObjectReason(item,area,x,y,rotated,look){var p=world({area:area,x:x,y:y}),f=footprint(item,rotated,look),water=['lotus','boat'].indexOf(item)>=0;var pts=[[0,0],[-1,0],[1,0],[0,-1],[0,1],[-.7,-.7],[.7,-.7],[-.7,.7],[.7,.7]];for(var k=0;k<pts.length;k++){var reason=lakePointReason({x:p.x+pts[k][0]*f.rx/2,y:p.y+pts[k][1]*f.ry*c.layout.world.band/100},water);if(reason)return reason;}return null;}
    function lakeGroundHit(g){for(var k=1;k<g.points.length;k++){var a=g.points[k-1],b=g.points[k],n=Math.ceil(Math.hypot(a[0]-b[0],a[1]-b[1])*2)+1;for(var j=0;j<=n;j++)if(lakePointReason({x:a[0]+(b[0]-a[0])*j/n,y:a[1]+(b[1]-a[1])*j/n},false))return true;}return false;}
    function lakeConflicts(s){return {objects:s.objects.filter(function(o){if(o.pos<0||(o.map||0)!==1)return false;var p=location(o);return !!lakeObjectReason(o.item,p.area,p.x,p.y,o.rotated,o);}).map(function(o){return o.uid;}),ground:(s.ground||[]).some(function(g){return (g.map||0)===1&&lakeGroundHit(g);})};}
    function harborState(s){return s.harbor||{step:0,mistake:false,repaired:false,route:'',bonus:false,gift:false,guest:''};}
    function repairHarbor(s,h,route){h.repaired=true;h.route=route;h.step=c.harbor.steps.length;addXp(s,c.harbor.xp);if(!h.mistake){s.coins=Math.min(c.economy.maxCoins,s.coins+c.harbor.bonus);h.bonus=true;}}
    function harborAction(s,a,now){
      if(a.type==='lakeEdition'){if(mapIds(s).indexOf(1)<0||[6,7].indexOf(a.edition)<0)return {ok:false,error:'harborLocked'};if(a.edition===7){var conflicts=lakeConflicts(s);if(conflicts.objects.length||conflicts.ground)return {ok:false,error:conflicts.ground?'lakeGroundConflict':'lakeWater'};}s.lakeEdition=a.edition;s.revision++;return {ok:true};}
      if(a.type.indexOf('harbor')!==0)return null;
      if((s.map||0)!==1||mapIds(s).indexOf(1)<0)return {ok:false,error:'harborLocked'};
      var h=harborState(s),spec=c.harbor;
      if(a.type==='harborPay'){if(h.repaired)return {ok:false,error:'harborDone'};if(s.coins<spec.cost)return {ok:false,error:'noMoney'};s.coins-=spec.cost;repairHarbor(s,h,'paid');}
      else if(a.type==='harborStep'){if(h.repaired||a.step!==h.step||!Number.isInteger(a.answer)||a.answer<0||a.answer>1)return {ok:false,error:'harborDone'};if((s.found||[]).indexOf('rope')<0)return {ok:false,error:'harborRope'};if(a.answer!==spec.steps[h.step].answer){h.mistake=true;s.harbor=h;s.revision++;return {ok:true,miss:true};}h.step++;if(h.step===spec.steps.length)repairHarbor(s,h,'manual');}
      else if(a.type==='harborBonus'){if(!h.repaired||h.bonus)return {ok:false,error:'harborDone'};h.bonus=true;s.coins=Math.min(c.economy.maxCoins,s.coins+spec.bonus);}
      else if(a.type==='harborGift'){if(!h.repaired||h.gift)return {ok:false,error:'harborDone'};if(s.objects.length>=240)return {ok:false,error:'harborGiftFull'};s.objects.push({uid:s.nextId++,item:'lantern',gift:'harbor',level:1,pos:-1,rotated:false});if(s.collection.indexOf('lantern')<0)s.collection.push('lantern');h.gift=true;}
      else if(a.type==='harborGuest'){if(!h.repaired||h.guest||['shelter','ferry'].indexOf(a.choice)<0)return {ok:false,error:'harborDone'};if(a.choice==='shelter'){if(s.coins<spec.guestCost)return {ok:false,error:'noMoney'};s.coins-=spec.guestCost;}else{if(a.answer!==spec.guestAnswer)return {ok:false,error:'harborGuestWrong'};s.coins=Math.min(c.economy.maxCoins,s.coins+spec.guestReward);}h.guest=a.choice;addXp(s,25);}
      else return {ok:false,error:'harborDone'};
      s.harbor=h;s.revision++;return {ok:true};
    }
    function questValue(s,q){var r=q.require,objects=s.objects.filter(function(o){return o.pos>=0&&(o.map||0)===q.map;});if(r.kind==='placed')return objects.length;if(r.kind==='care')return s.careCount||0;if(r.kind==='find')return c.finds.filter(function(f){return f.map===q.map&&(s.found||[]).indexOf(f.id)>=0;}).length;if(r.kind==='path')return (s.ground||[]).filter(function(g){return (g.map||0)===q.map&&g.kind==='path';}).length;if(r.kind==='special')return objects.some(function(o){return o.item===r.target;})?1:0;return 0;}
    function questReady(s,q){return mapIds(s).indexOf(q.map)>=0&&!(s.quests||{})[q.id]&&(q.stage===0||!!(s.quests||{})[q.arc+(q.stage-1)])&&questValue(s,q)>=(q.require.kind==='special'?1:q.require.target);}
    function careEligible(s,o,now){return !!o&&o.pos>=0&&(o.map||0)===(s.map||0)&&(items[o.item].plantRow!==undefined||['lotus','osmanthus'].indexOf(o.item)>=0)&&now>=((s.cared||{})[o.uid]||0)+c.care.cooldown;}
    function blueprint(s,id,area,x,y,now){var plan=c.blueprints.find(function(b){return b.id===id;});if(!plan)return {ok:false,error:'blueprintInvalid'};var probe=JSON.parse(JSON.stringify(s)),parts=[],cost=0;for(var k=0;k<plan.parts.length;k++){var piece=plan.parts[k],gx=x+area%2*100+piece.x,gy=y+Math.floor(area/2)*100+piece.y,a=(gx>=100?1:0)+(gy>=100?2:0),px=gx-a%2*100,py=gy-Math.floor(a/2)*100,own=probe.objects.find(function(o){return o.pos<0&&o.item===piece.item;}),action={type:own?'move':'buy',uid:own&&own.uid,item:piece.item,area:a,x:px,y:py,rotated:false};var result=act(probe,action,now);parts.push({item:piece.item,area:a,x:px,y:py,owned:!!own});if(!own)cost+=price(piece.item);if(!result.ok)return {ok:false,error:result.error,parts:parts,cost:cost};}return {ok:true,state:probe,parts:parts,cost:cost};}
    function extraAction(s,a,now){
      var harborResult=harborAction(s,a,now);if(harborResult)return harborResult;
      if(a.type==='find'){var f=c.finds.find(function(f){return f.id===a.id;});if(!f||f.map!==(s.map||0)||(s.found||[]).indexOf(a.id)>=0)return {ok:false,error:'findDone'};if(!s.found)s.found=[];s.found.push(a.id);s.coins=Math.min(c.economy.maxCoins,s.coins+f.coins);addXp(s,10);s.revision++;return {ok:true};}
      if(a.type==='unlockMap'){var m=c.maps.find(function(m){return m.id===a.id;});if(!m)return {ok:false,error:'mapLocked'};if(mapIds(s).indexOf(a.id)>=0)return {ok:false,error:'mapAlready'};if(level(s).value<m.level)return {ok:false,error:'lockedTier'};if(s.coins<m.price)return {ok:false,error:'noMoney'};s.maps=mapIds(s).concat([a.id]);if(a.id===1)s.lakeEdition=7;s.coins-=m.price;addXp(s,50);s.revision++;return {ok:true};}
      if(a.type==='visitMap'){if(mapIds(s).indexOf(a.id)<0)return {ok:false,error:'mapLocked'};s.map=a.id;s.revision++;return {ok:true};}
      if(a.type==='starter'){if(s.starter)return {ok:false,error:'starterClaimed'};if(s.objects.length>236)return {ok:false,error:'inventoryFull'};['manor','bamboo','orchid','lantern'].forEach(function(id){s.objects.push({uid:s.nextId++,item:id,level:1,pos:-1,rotated:false});if(s.collection.indexOf(id)<0)s.collection.push(id);});s.starter=true;addXp(s,30);s.revision++;return {ok:true};}
      if(a.type==='care'){var o=s.objects.find(function(o){return o.uid===a.uid;});if(!careEligible(s,o,now))return {ok:false,error:'careWait'};if(!Array.isArray(a.answers)||!c.care.steps.every(function(step,k){return a.answers[k]===step.answer;}))return {ok:false,error:'careOnly'};if(!s.cared)s.cared={};s.cared[o.uid]=now;s.careCount=(s.careCount||0)+1;var reward=Math.min(c.care.maxReward,c.care.baseReward+Math.floor(baseRate(o)*3));s.coins=Math.min(c.economy.maxCoins,s.coins+reward);addXp(s,8);s.revision++;return {ok:true,reward:reward};}
      if(a.type==='quest'){var q=c.quests.find(function(q){return q.id===a.id;});if(!q||!questReady(s,q))return {ok:false,error:'questLocked'};if(!q.options.some(function(o){return o.id===a.choice;}))return {ok:false,error:'questLocked'};if(!s.quests)s.quests={};s.quests[q.id]={choice:a.choice,at:now};s.coins=Math.min(c.economy.maxCoins,s.coins+q.coins);addXp(s,q.xp);s.revision++;return {ok:true};}
      if(a.type==='blueprint'){var b=blueprint(s,a.id,a.area,a.x,a.y,now);if(!b.ok)return {ok:false,error:b.error};Object.keys(b.state).forEach(function(k){s[k]=b.state[k];});return {ok:true};}
      return null;
    }
    function act(s,a,now) {
      advance(s,now);var o=s.objects.find(function(x){return x.uid===a.uid;}),i=items[a.item],cost;
      if((a.type==='buy'||a.type==='move')&&!validLook(a.item||(o&&o.item),a))return {ok:false,error:'badAppearance'};
      var extra=extraAction(s,a,now);if(extra)return extra;
      if(a.type==='buy') {
        if(s.objects.length>=240)return {ok:false,error:'inventoryFull'};
        if(!i)return {ok:false,error:'noSpace'};
        if(!itemUnlocked(s,i))return {ok:false,error:'mapLocked'};if(level(s).value<c.tiers[i.tier-1].level)return {ok:false,error:'lockedTier'};
        cost=price(i.id);if(s.coins<cost)return {ok:false,error:'noMoney'};
        var free=Object.prototype.hasOwnProperty.call(a,'x');
        if(free?!canLand(s,i.id,a.area,a.x,a.y,a.rotated,undefined,a):!validPlace(s,i.id,a.pos,a.rotated))return {ok:false,error:'noSpace'};
        if(i.id==='manor'&&s.collection.indexOf('manor')>=0)return {ok:false,error:'starterClaimed'};var added={uid:s.nextId++,item:i.id,level:1,pos:free?a.area*12:a.pos,rotated:!!a.rotated};if(free){added.x=a.x;added.y=a.y;if(a.variant!==undefined)added.variant=a.variant;if(a.size!==undefined)added.size=a.size;}
        if(s.map)added.map=s.map;s.coins-=cost;s.objects.push(added);
        if(s.collection.indexOf(i.id)<0){s.collection.push(i.id);addXp(s,i.tier*c.economy.uniqueXp);}
      } else if(a.type==='move') {
        var free=Object.prototype.hasOwnProperty.call(a,'x');
        if(!o||(free?!canLand(s,o.item,a.area,a.x,a.y,a.rotated,o.uid,{variant:a.variant===undefined?o.variant:a.variant,size:a.size===undefined?o.size:a.size}):!validPlace(s,o.item,a.pos,a.rotated,o.uid)))return {ok:false,error:'noSpace'};
        o.map=s.map||0;o.pos=free?a.area*12:a.pos;o.rotated=!!a.rotated;if(free){o.x=a.x;o.y=a.y;if(a.variant!==undefined)o.variant=a.variant;if(a.size!==undefined)o.size=a.size;}else{delete o.x;delete o.y;}
      } else if(a.type==='store') { if(!o)return {ok:false,error:'noSpace'};o.pos=-1;
      } else if(a.type==='upgrade') {
        if(!o||o.level>=c.economy.maxLevel)return {ok:false,error:'max'};cost=upgradeCost(o);if(s.coins<cost)return {ok:false,error:'noMoney'};
        s.coins-=cost;o.level++;addXp(s,items[o.item].tier*c.economy.upgradeXp);
      } else if(a.type==='collect') {var money=Math.floor(s.bank);s.bank-=money;s.coins=Math.min(c.economy.maxCoins,s.coins+money);s.totalCollected=Math.min(c.economy.maxCoins,s.totalCollected+money);
      } else if(a.type==='expand') {
        var ex=c.expansions[s.expansion+1];if(!ex)return {ok:false,error:'full'};
        if(level(s).value<ex.level)return {ok:false,error:'lockedTier'};if(s.coins<ex.price)return {ok:false,error:'noMoney'};s.coins-=ex.price;s.expansion++;
      } else if(a.type==='goal') {
        var g=c.goals.find(function(x){return x.id===a.id;});if(!g||s.goals.indexOf(g.id)>=0||goalValue(s,g)<g.target)return {ok:false,error:'notReady'};
        s.goals.push(g.id);s.coins=Math.min(c.economy.maxCoins,s.coins+g.coins);addXp(s,g.xp);
      } else if(a.type==='story') {
        var story=c.stories.find(function(t){return t.id===a.id;}),done=story?storyState(s,a.id):[];
        if(!story||done.length!==a.stage)return {ok:false,error:'storyDuplicate'};
        if(!storyReady(s,story))return {ok:false,error:'storyLocked'};
        var choice=story.episodes[done.length].choices.find(function(t){return t.id===a.choice;});if(!choice)return {ok:false,error:'storyLocked'};
        if(!s.stories)s.stories={};s.stories[a.id]=done.concat([{choice:a.choice,at:now}]);
      } else if(a.type==='ground') {
        if(!c.groundTools.some(function(t){return t.id===a.kind;})||!Array.isArray(a.points)||a.points.length<2||a.points.length>120||!a.points.every(function(p){return Array.isArray(p)&&p.length===2&&p.every(function(v){return Number.isFinite(v)&&v>=0&&v<=100;});}))return {ok:false,error:'outside'};
        if((s.ground||[]).filter(function(g){return (g.map||0)===(s.map||0);}).length>=80)return {ok:false,error:'groundFull'};
        if(lakeNew(s)&&lakeGroundHit({points:a.points}))return {ok:false,error:'lakeGround'};if(!s.ground)s.ground=[];s.ground.push({map:s.map||0,kind:a.kind,points:a.points.map(function(p){return p.slice();})});
      } else if(a.type==='clearGround'){s.ground=(s.ground||[]).filter(function(g){return (g.map||0)!==(s.map||0);});
      } else if(a.type==='night') {s.night=!s.night;
      } else return {ok:false,error:'noSpace'};
      discover(s);s.revision++;return {ok:true};
    }
    function restore(raw,now) {
      if(!raw)return {state:fresh(now),fresh:true};
      try {
        var s=JSON.parse(raw),num=function(v,min,max){return typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;};
        var old=s.version===1;
        if((s.version!==c.version&&!old)||!num(s.coins,0,c.economy.maxCoins)||!num(s.bank,0,c.economy.maxCoins)||!num(s.xp,0,1000000)||!Number.isInteger(s.expansion)||s.expansion<0||s.expansion>=c.expansions.length||!num(s.last,0,8640000000000000)||!num(s.revision,0,1e12)||!Number.isInteger(s.nextId)||s.nextId<1||!num(s.totalCollected,0,c.economy.maxCoins)||!Array.isArray(s.objects)||s.objects.length>240)throw Error('invalid');
        [['collection',c.items],['combos',c.combos],['goals',c.goals]].forEach(function(pair){var arr=s[pair[0]];if(!Array.isArray(arr)||arr.length>pair[1].length||new Set(arr).size!==arr.length||!arr.every(function(id){return pair[1].some(function(x){return x.id===id;});}))throw Error('invalid');});
        var probe=fresh(now);probe.expansion=s.expansion;var ids={};
        s.objects.forEach(function(o){if(!validLook(o.item,o)||!Number.isInteger(o.uid)||o.uid<1||o.uid>=s.nextId||ids[o.uid]||!Number.isInteger(o.level)||o.level<1||o.level>c.economy.maxLevel||typeof o.rotated!=='boolean'||!Number.isInteger(o.pos)||o.pos< -1||s.collection.indexOf(o.item)<0)throw Error('invalid');
          var xy=Object.prototype.hasOwnProperty.call(o,'x');if(xy&&(!num(o.x,0,100)||!num(o.y,0,100)))throw Error('invalid');
          if(o.pos>=0&&xy&&probe.objects.some(function(q){return q.pos>=0&&(q.map||0)===(o.map||0)&&q.pos===o.pos&&q.x===o.x&&q.y===o.y;}))throw Error('invalid');ids[o.uid]=true;if(o.pos>=0&&(xy?(c.layout.freeEstate?o.pos>=48:!canLand(probe,o.item,Math.floor(o.pos/12),o.x,o.y,o.rotated,undefined,o)):!validPlace(probe,o.item,o.pos,o.rotated)))throw Error('invalid');probe.objects.push(o);
        });
        if(!s.stories&&old)s.stories={};if(!s.stories||typeof s.stories!=='object'||Array.isArray(s.stories))throw Error('invalid');
        Object.keys(s.stories).forEach(function(id){var t=c.stories.find(function(t){return t.id===id;}),v=s.stories[id];if(!t||!Array.isArray(v)||v.length>3)throw Error('invalid');v.forEach(function(r,k){if(!r||!num(r.at,0,8640000000000000)||!t.episodes[k].choices.some(function(ch){return ch.id===r.choice;}))throw Error('invalid');});});
        var moved=0;if(old){advance(s,now);var migrating=s.objects.slice();s.objects=[];migrating.forEach(function(o){if(o.pos>=0){var p=suggest(s,o.item,Math.floor(o.pos/12),o.rotated);if(p){o.pos=p.area*12;o.x=p.x;o.y=p.y;}else{o.pos=-1;moved++;}}s.objects.push(o);});s.version=c.version;}
        if(s.ground!==undefined&&(!Array.isArray(s.ground)||s.ground.length>240||!s.ground.every(function(g){return g&&c.groundTools.some(function(t){return t.id===g.kind;})&&Array.isArray(g.points)&&g.points.length>=2&&g.points.length<=120&&g.points.every(function(p){return Array.isArray(p)&&p.length===2&&p.every(function(v){return num(v,0,100);});});})))throw Error('invalid');
        if(s.found!==undefined&&(!Array.isArray(s.found)||s.found.length>c.finds.length||new Set(s.found).size!==s.found.length||!s.found.every(function(id){return c.finds.some(function(f){return f.id===id&&mapIds(s).indexOf(f.map)>=0;});})))throw Error('found');
        if(s.maps!==undefined&&(!Array.isArray(s.maps)||!s.maps.includes(0)||s.maps.length>c.maps.length||new Set(s.maps).size!==s.maps.length||!s.maps.every(function(id){return c.maps.some(function(m){return m.id===id;});})))throw Error('maps');
        if(mapIds(s).indexOf(s.map||0)<0||s.objects.some(function(o){return mapIds(s).indexOf(o.map||0)<0;})||(s.ground||[]).some(function(g){return mapIds(s).indexOf(g.map||0)<0;}))throw Error('map');
        if(s.careCount!==undefined&&!num(s.careCount,0,10000000))throw Error('care');
        if(s.cared!==undefined&&(typeof s.cared!=='object'||s.cared===null||Array.isArray(s.cared)||Object.keys(s.cared).length>240||!Object.keys(s.cared).every(function(uid){return s.objects.some(function(o){return String(o.uid)===uid;})&&num(s.cared[uid],0,8640000000000000);})))throw Error('care');
        if(s.quests!==undefined&&(typeof s.quests!=='object'||s.quests===null||Array.isArray(s.quests)||!Object.keys(s.quests).every(function(id){var q=c.quests.find(function(q){return q.id===id;}),v=s.quests[id];return q&&v&&num(v.at,0,8640000000000000)&&q.options.some(function(o){return o.id===v.choice;})&&(q.stage===0||s.quests[q.arc+(q.stage-1)]);})))throw Error('quest');

        if(s.lakeEdition!==undefined&&([6,7].indexOf(s.lakeEdition)<0||mapIds(s).indexOf(1)<0))throw Error('lakeEdition');
        if(s.harbor!==undefined){var h=s.harbor;if(!h||Array.isArray(h)||!Number.isInteger(h.step)||h.step<0||h.step>c.harbor.steps.length||['mistake','repaired','bonus','gift'].some(function(k){return typeof h[k]!=='boolean';})||['','paid','manual'].indexOf(h.route)<0||['','shelter','ferry'].indexOf(h.guest)<0||mapIds(s).indexOf(1)<0||h.repaired!==(h.step===c.harbor.steps.length)||h.repaired!==(h.route!=='')||(!h.repaired&&(h.bonus||h.gift||h.guest)))throw Error('harbor');}
        var gifts=s.objects.filter(function(o){return o.gift!==undefined;});if(gifts.length>1||gifts.some(function(o){return o.gift!=='harbor'||o.item!=='lantern';})||(gifts.length&&(!s.harbor||!s.harbor.gift))||(s.harbor&&s.harbor.gift&&!gifts.length))throw Error('gift');
        s.night=!!s.night;return {state:s,fresh:false,migrated:old,stored:moved};
      }catch(e){return {state:fresh(now),error:true,fresh:false};}
    }
    return {lakeNew:lakeNew,shoreline:shoreline,lakeConflicts:lakeConflicts,harborState:harborState,mapIds:mapIds,itemUnlocked:itemUnlocked,questValue:questValue,questReady:questReady,careEligible:careEligible,blueprint:blueprint,nearWater:nearWater,fresh:fresh,level:level,capacity:capacity,slots:slots,hours:hours,shape:shape,cells:cells,validPlace:validPlace,adjacent:adjacent,combinations:combinations,baseRate:baseRate,rate:rate,advance:advance,price:price,upgradeCost:upgradeCost,goalValue:goalValue,act:act,restore:restore,items:items,location:location,footprint:footprint,usedCapacity:usedCapacity,canLand:canLand,landReason:landReason,suggest:suggest,storyState:storyState,storyReady:storyReady};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=createEngine;else root.createGardenEngine=createEngine;
})(typeof window!=='undefined'?window:this);
