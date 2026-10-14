import {test} from 'node:test';import assert from 'node:assert/strict';
import {trafficPenetration} from '../shared/traffic-geometry';
import {createVehicles,vehicleBody,vehicleBlocked,vehicleStaticBlocked,stepVehicle} from '../shared/vehicles';
import {createShuttles,stepShuttle,stepShuttleTraffic,shuttleBody,SHUTTLE,shuttlePose,SHUTTLE_ROUTE_LENGTH} from '../shared/shuttle';
const movingBus=()=>({...createShuttles(0)[0],dwellUntil:0});
const carAhead=(bus:ReturnType<typeof movingBus>,n=5)=>({...createVehicles()[0],x:bus.x+Math.sin(bus.yaw)*n,z:bus.z+Math.cos(bus.yaw)*n,yaw:bus.yaw,driverId:'driver',speed:0});
test('real oriented bodies remove phantom roadside collisions and allow a touching car to retreat',()=>{
 const bus=movingBus(),car={...carAhead(bus,0),x:bus.x+Math.cos(bus.yaw)*3,z:bus.z-Math.sin(bus.yaw)*3};assert.equal(vehicleStaticBlocked(car),false);assert.equal(vehicleBlocked(car,[],[],[shuttleBody(bus)]),false);assert.equal(stepShuttle(bus,.05,100,[car]).blocked,false);
 const touching=carAhead(bus,5);assert.ok(trafficPenetration(vehicleBody(touching),shuttleBody(bus))>0);const away=stepVehicle(touching,{throttle:1,steer:0,brake:false},.1,[],[],[shuttleBody(bus)]);assert.ok(Math.hypot(away.x-bus.x,away.z-bus.z)>5);const toward=stepVehicle(touching,{throttle:-1,steer:0,brake:false},.1,[],[],[shuttleBody(bus)]);assert.equal(toward.x,touching.x);assert.equal(toward.z,touching.z);
 const a={id:'a',x:0,z:0,yaw:.4,width:2,length:4.4},b={id:'b',x:2,z:1,yaw:-.7,width:2.5,length:7.8};assert.equal(trafficPenetration(a,b),trafficPenetration(b,a));
});
test('a blocked bus pushes parked or driven cars clear, preserves seat identity and resumes its route',()=>{
 for(const driverId of [null,'driver'])for(const angle of [0,Math.PI/2]){let bus=movingBus();bus.passengerIds=['rider'];const initial=bus.distance,car={...carAhead(bus),driverId,yaw:bus.yaw+angle},cars=[car],origin={...car};
  assert.equal(stepShuttleTraffic(bus,.05,100,cars,[],[bus]).blocked,true);assert.deepEqual(car,origin,'No immediate jump before the yielding timeout');
  for(let i=3;i<=200;i++){bus=stepShuttleTraffic(bus,.05,i*50,cars,[],[bus]);assert.equal(vehicleStaticBlocked(car),false);assert.equal(car.driverId,driverId);assert.deepEqual(bus.passengerIds,['rider']);}
  assert.ok(bus.distance-initial>30);assert.equal(bus.blocked,false);assert.ok(Math.hypot(car.x-origin.x,car.z-origin.z)>1);assert.equal(car.speed,0);
  const driven=stepVehicle(car,{throttle:1,steer:0,brake:false},.1,cars,[],[shuttleBody(bus)]);assert.ok(Math.hypot(driven.x-car.x,driven.z-car.z)>0,'Displaced car remains drivable');
 }
});
test('several touching cars and both buses do not mutually gridlock; pedestrian and dwell rules remain',()=>{
 let bus=movingBus();const initial=bus.distance,cars=createVehicles().map((c,i)=>({...c,...carAhead(bus,5+i*5),id:c.id,driverId:null}));for(let i=1;i<=600;i++){bus=stepShuttleTraffic(bus,.05,i*50,cars,[],[bus]);assert.ok(cars.every(c=>!vehicleStaticBlocked(c)));}assert.ok(bus.distance-initial>100);assert.equal(bus.blocked,false);
 const front={...bus,dwellUntil:0},rear={...front,id:'rear',...shuttlePose(front.distance-9),distance:front.distance-9};let a=front,b=rear;for(let i=1;i<=200;i++){a=stepShuttleTraffic(a,.05,40000+i*50,[],[],[a,b]);b=stepShuttleTraffic(b,.05,40000+i*50,[],[],[a,b]);}assert.ok(a.distance-front.distance>50);assert.ok(b.distance-rear.distance>50);
 const stopped=movingBus(),car=carAhead(stopped),before={...car};const pedestrian={x:stopped.x+Math.sin(stopped.yaw)*2,z:stopped.z+Math.cos(stopped.yaw)*2};let yielding=stopped;for(let i=1;i<200;i++)yielding=stepShuttleTraffic(yielding,.05,i*50,[car],[pedestrian],[yielding]);assert.deepEqual(car,before);assert.equal(yielding.distance,stopped.distance);assert.equal(yielding.blocked,true);
 const dwell={...stopped,dwellUntil:20000};assert.deepEqual(stepShuttleTraffic(dwell,.05,10000,[car]).distance,dwell.distance);assert.deepEqual(car,before);
});
test('representative tight corners recover only onto a fully safe nearby position within bounded time',()=>{
 let checked=0;for(let d=0;d<SHUTTLE_ROUTE_LENGTH;d+=90){const pose=shuttlePose(d),template=movingBus(),car={...carAhead({...template,...pose}),yaw:pose.yaw+Math.PI/2};if(vehicleStaticBlocked(car))continue;
  let bus={...template,...pose,distance:d};const cars=[car],start=d;for(let i=1;i<=260;i++)bus=stepShuttleTraffic(bus,.05,i*50,cars,[],[bus]);assert.equal(vehicleStaticBlocked(car),false);assert.ok(bus.distance!==start,JSON.stringify({d,bus,car}));checked++;
 }assert.ok(checked>20);
});

test('a car boxed in by safe pedestrian spacing is relocated after the recovery timeout without ejecting its driver',()=>{
 let bus=movingBus();const car=carAhead(bus),original={...car},person={x:car.x+Math.sin(car.yaw)*2.8,z:car.z+Math.cos(car.yaw)*2.8};assert.equal(vehicleBlocked(car,[],[person]),true);const cars=[car];
 for(let i=1;i<=100;i++)bus=stepShuttleTraffic(bus,.05,i*50,cars,[person],[bus]);assert.deepEqual(car,original,'No early teleport');
 for(let i=101;i<=170;i++)bus=stepShuttleTraffic(bus,.05,i*50,cars,[person],[bus]);assert.ok(Math.hypot(car.x-original.x,car.z-original.z)>3);assert.equal(vehicleStaticBlocked(car),false);assert.equal(vehicleBlocked(car,[],[person],[shuttleBody(bus)]),false);assert.equal(car.driverId,original.driverId);assert.equal(car.id,original.id);assert.equal(car.speed,0);
});
