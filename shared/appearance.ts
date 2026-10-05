import {COLORS} from './config';
export const APPEARANCE_OPTIONS=Object.freeze({
 skin:[{name:'浅瓷',color:'#f4d6bc'},{name:'暖杏',color:'#e8c8a5'},{name:'小麦',color:'#cda27c'},{name:'暖棕',color:'#a77552'},{name:'深棕',color:'#754b34'}],
 hair:[{name:'经典短发'},{name:'偏分短发'},{name:'蓬松卷发'},{name:'齐肩发'},{name:'发髻'}],
 hairColor:[{name:'墨黑',color:'#3d3730'},{name:'栗棕',color:'#78533c'},{name:'蜜金',color:'#b48848'},{name:'银灰',color:'#adb0b2'},{name:'莓紫',color:'#7c536d'},{name:'海蓝',color:'#416d84'}],
 outfit:[{name:'经典外套'},{name:'连帽卫衣'},{name:'学院夹克'},{name:'衬衫'}],
 coat:COLORS.map((color,i)=>({color,name:['松绿','暖橙','雾蓝','莓紫','岩灰','麦黄'][i]})),
 pants:[{name:'岩灰',color:'#43494b'},{name:'海军蓝',color:'#354f69'},{name:'米白',color:'#d6ccad'},{name:'深棕',color:'#665144'},{name:'浅蓝',color:'#7e9cb2'}],
 accessory:[{name:'无配饰'},{name:'圆框眼镜'},{name:'棒球帽'},{name:'围巾'},{name:'双肩包'}],
});
export type Appearance={skin:number;hair:number;hairColor:number;outfit:number;coat:number;pants:number;accessory:number};
export const appearanceKeys=Object.keys(APPEARANCE_OPTIONS) as (keyof Appearance)[];
export const defaultAppearance=(coat=0):Appearance=>({skin:1,hair:0,hairColor:0,outfit:0,coat:Number.isInteger(coat)&&coat>=0&&coat<COLORS.length?coat:0,pants:0,accessory:0});
export function validAppearance(value:unknown):value is Appearance{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).length===appearanceKeys.length&&Object.keys(v).every(k=>appearanceKeys.includes(k as keyof Appearance))&&appearanceKeys.every(k=>Number.isInteger(v[k])&&Number(v[k])>=0&&Number(v[k])<APPEARANCE_OPTIONS[k].length);
}
export const copyAppearance=(v:Appearance):Appearance=>({skin:v.skin,hair:v.hair,hairColor:v.hairColor,outfit:v.outfit,coat:v.coat,pants:v.pants,accessory:v.accessory});
export function decodeAppearance(raw:string|null):Appearance|null{
 if(raw===null)return null;
 let value:unknown;try{value=JSON.parse(raw);}catch{throw Error('Stored appearance is not valid JSON');}
 if(!validAppearance(value))throw Error('Stored appearance is outside supported options');
 return copyAppearance(value);
}
export function randomAppearance():Appearance{
 const result=defaultAppearance();for(const key of appearanceKeys)result[key]=Math.floor(Math.random()*APPEARANCE_OPTIONS[key].length);return result;
}
