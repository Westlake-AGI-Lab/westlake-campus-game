import {test} from 'node:test';
import assert from 'node:assert/strict';
import {atmosphereAt,DAY_MS,WEATHER_MS} from '../shared/atmosphere';
import {CAT_PATHS,catPose,LAB_POINT} from '../shared/wildlife';
import {blocked} from '../shared/world';
test('server clock cycles through daylight/night and three deterministic weather states',()=>{
 assert.equal(atmosphereAt(0).night,true);assert.equal(atmosphereAt(DAY_MS/2).daylight,1);assert.equal(atmosphereAt(DAY_MS/24*23).night,true);
 assert.deepEqual(atmosphereAt(1000),atmosphereAt(1000+DAY_MS*3));assert.deepEqual(new Set(Array.from({length:6},(_,i)=>atmosphereAt(i*WEATHER_MS).weather)),new Set(['clear','cloudy','rain']));
 assert.ok(Number.isFinite(atmosphereAt(NaN).hour));
});
test('ambient cats stay on safe loops, stop continuously for rest, and laboratory destination is reachable',()=>{
 assert.equal(CAT_PATHS.length,4);assert.equal(blocked(LAB_POINT),false);
 for(let i=0;i<4;i++){for(let t=0;t<135000;t+=137)assert.equal(blocked(catPose(t,i).point),false);const t=(27-i*17)*1000,a=catPose(t-1,i),b=catPose(t+1,i);assert.ok(Math.hypot(a.point.x-b.point.x,a.point.z-b.point.z)<.01);assert.equal(catPose(t+5000,i).rest,true);assert.deepEqual(catPose(t+5000,i).point,catPose(t+10000,i).point);}
});
