import {test} from 'node:test';import assert from 'node:assert/strict';import {campus,move,blocked,heightAt,validateInput,safeName} from '../shared/world';
import {CONFIG} from '../shared/config';
test('safe input and plain text name',()=>{for(const v of [{seq:1,x:NaN,z:0,run:false},{seq:1,x:Infinity,z:0,run:false},{seq:1,x:2,z:0,run:false},{seq:1,x:0,z:0,run:false,playerId:'victim'},{seq:-1,x:0,z:0,run:false}])assert.equal(validateInput(v),false);assert.equal(validateInput({seq:1,x:0,z:1,run:false}),true);assert.equal(safeName('<script>hi</script>\u0000').includes('<'),false);assert.equal(safeName(''),'校园访客');assert.equal(Array.from(safeName('abcdefghijklmnop')).length,12);});
test('spawn safe, all major objects linked to actual references',()=>{for(const p of campus.spawnPoints)assert.equal(blocked(p),false);assert.equal(campus.bridges.length,12);assert.ok(campus.buildings.length>60);for(const b of campus.buildings){assert.ok(b.sourceIds.includes('OFFICIAL-MAP')||b.sourceIds.some(id=>id.startsWith('OSM-')));assert.equal(b.confidence.dimensions,'estimated');}});
test('time cap and solid building / world border collision',()=>{let p=campus.spawnPoints[0];const q=move(p,{x:1,z:0,run:true},1e9);assert.ok(Math.hypot(q.x-p.x,q.z-p.z)<=CONFIG.runSpeed*.25+.001);const b=campus.meta.bounds;assert.equal(blocked({x:b.maxX+1,z:0}),true);for(const c of campus.colliders)assert.equal(blocked(c),true);});
test('all bridge decks support continuous walking along their curved centreline',()=>{
 for(const b of [...campus.bridges,...(campus.waterWalkways||[])]){let p=b.points[0],highest=0;
  for(const q of b.points.slice(1)){let attempts=0;const limit=Math.ceil(Math.hypot(q.x-p.x,q.z-p.z)/(.025*4.6))+30;while(Math.hypot(q.x-p.x,q.z-p.z)>.04){assert.ok(++attempts<limit,b.id+' walking stuck');const d=Math.hypot(q.x-p.x,q.z-p.z),next=move(p,{x:(q.x-p.x)/d,z:(q.z-p.z)/d,run:false},Math.min(.025,d/4.6));assert.ok(Math.hypot(next.x-p.x,next.z-p.z)>1e-6,b.id+' blocked');p=next;highest=Math.max(highest,heightAt(p));}}
  assert.ok(highest>b.rise*.9,b.id+' arch is not walkable');assert.ok(Math.hypot(p.x-b.points.at(-1)!.x,p.z-b.points.at(-1)!.z)<.05);
 }
});
