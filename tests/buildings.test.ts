import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {campus} from '../shared/world';
import {buildingName} from '../shared/buildings';
import {searchDestinations} from '../shared/destinations';

test('public building directory has unique codes, source provenance and corrected identities',()=>{
 const directory=JSON.parse(readFileSync('data/building-directory.json','utf8'));
 assert.equal(directory.buildings.length,campus.buildings.length);const codes=new Set<string>();
 for(const entry of directory.buildings){const building=campus.buildings.find(b=>b.id===entry.id)!;assert.ok(building);assert.equal(building.name,entry.name);assert.deepEqual(building.codes,entry.codes);for(const code of entry.codes){assert.match(code,/^[A-Z]\d+$/);assert.ok(!codes.has(code),'duplicate code '+code);codes.add(code);assert.ok(entry.sources.length||entry.mapSources.length);}for(const source of entry.sources)assert.ok(directory.sources[source]?.url.startsWith('https://'));}
 for(const [query,id]of Object.entries({C1:'res-21',C8:'res-22',C10:'res-16',C13:'res-15',F1:'res-10',F2:'res-12',F3:'res-11',F6:'map-F6',F7:'map-F7',F16:'north-canteen',F17:'faculty-1',C17:'canteen-west',C18:'F18',E6:'E6-E7',E8:'E8-E9',E14:'research',E11:'animal'}))assert.equal(searchDestinations(query)[0]?.id,id,query);
 assert.equal(searchDestinations('E6')[0].name,'生命科学楼（E6 / E7）');assert.equal(searchDestinations('E8')[0].name,'基础医学楼（E8 / E9）');assert.equal(buildingName(campus.buildings.find(b=>b.id==='library')!),'图书中心（E12）');
});

test('search accepts names, synonyms and normalized exact codes without prefix or renderer-ID confusion',()=>{
 for(const query of ['C1','c1','c 1','Ｃ１',' C １ '])assert.deepEqual(searchDestinations(query).map(d=>d.id),['res-21']);
 for(const query of ['F1','f１','Ｆ １'])assert.deepEqual(searchDestinations(query).map(d=>d.id),['res-10']);
 for(const query of ['F18','res-10','C999','不存在的大楼'])assert.equal(searchDestinations(query).length,0,query);
 assert.equal(searchDestinations('图书馆')[0].id,'library');assert.equal(searchDestinations('科研中心')[0].id,'research');assert.equal(searchDestinations('教师公寓').length,6);assert.ok(searchDestinations('食堂').length>=5);
});
