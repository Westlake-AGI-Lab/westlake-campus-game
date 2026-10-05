import policy from '../data/name-policy.json' with {type:'json'};
// Registration uses one shared finite vocabulary and substring filter.
export const NAME_PARTS=Object.freeze(policy.parts.map(chars=>Object.freeze(chars)));
export const NAME_BLOCKLIST=Object.freeze(policy.blocked);
export function isAllowedName(value:unknown):value is string {
 return typeof value==='string'&&value.length===3&&NAME_PARTS.every((chars,i)=>chars.includes(value[i]))&&!NAME_BLOCKLIST.some(word=>value.includes(word));
}
export const APPROVED_NAMES=Object.freeze(NAME_PARTS[0].flatMap(a=>NAME_PARTS[1].flatMap(b=>NAME_PARTS[2].map(c=>a+b+c))).filter(isAllowedName));
export function randomName(){return APPROVED_NAMES[Math.floor(Math.random()*APPROVED_NAMES.length)];}
