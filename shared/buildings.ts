import type {Building} from './types';

export function buildingName(b:Pick<Building,'name'|'codes'>){
 return b.name+(b.codes?.length?`（${b.codes.join(' / ')}）`:'');
}

// Keep public building numbers separate from renderer IDs such as res-10 / F18.
export function normalizeSearch(value:string){
 return value.normalize('NFKC').toUpperCase().replace(/[\s·（）()、/\-]/g,'');
}
