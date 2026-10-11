import {appearanceEditor} from './appearance';
import {NAME_PARTS,isAllowedName,randomName} from '../shared/names';
import {normalizeUsername} from '../shared/usernames';
import type {JoinRequest} from '../shared/types';
const $=<E extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as E;
const storageKey='westlake-account-session';
type Session={token:string;username:string;displayName:string;color:number};

export function accountEntry(competitive=false){
 let mode:'login'|'register'='login';const editor=appearanceEditor();
 const username=$<HTMLInputElement>('username'),displayName=$<HTMLInputElement>('display-name'),password=$<HTMLInputElement>('password'),submit=$<HTMLButtonElement>('enter-campus');
 const selects=NAME_PARTS.map((chars,i)=>{const select=$<HTMLSelectElement>('name-part-'+i);for(const char of chars){const option=document.createElement('option');option.value=option.textContent=char;select.append(option);}return select;});
 const updateDisplayName=()=>{
  if(mode!=='register')return;
  displayName.value=selects.map(s=>s.value).join('');
  const allowed=isAllowedName(displayName.value),same=displayName.value===normalizeUsername(username.value);
  $('name-rule').textContent=!allowed?'这个组合暂不可用，请更换候选字':same?'显示名字不要与登录用户名相同，请换一个组合':'其他玩家只会看到这个名字 · 显示名字可以重复';
  submit.disabled=!allowed||same;
 };
 const choose=(value:string)=>{selects.forEach((s,i)=>s.value=value[i]);updateDisplayName();};
 selects.forEach(s=>s.onchange=updateDisplayName);$('random-name').onclick=()=>choose(randomName());username.oninput=updateDisplayName;
 function setMode(value:'login'|'register'){
  mode=value;editor.show(value==='register');$('appearance-coat-controls').hidden=value!=='register';username.placeholder=value==='login'?'输入登录用户名':'自己取一个登录用户名';
  password.autocomplete=value==='register'?'new-password':'current-password';$('display-name-group').hidden=value!=='register';displayName.disabled=value!=='register';
  $('auth-login').setAttribute('aria-selected',String(value==='login'));$('auth-register').setAttribute('aria-selected',String(value==='register'));
  submit.innerHTML=(competitive?(value==='login'?'登录并进入竞技':'注册并进入竞技'):(value==='login'?'登录并继续漫游':'注册并进入校园'))+' <span>↗</span>';
  $('join-note').textContent=value==='login'?(competitive?'沿用角色外观 · 本场独立记分':'恢复角色外观、位置与记录 · 原三字用户名仍可登录'):'用户名仅用于登录 · 角色头顶显示选字名字';$('entry-error').textContent='';submit.disabled=false;
  if(value==='register')choose(randomName());
 }
 $('auth-login').onclick=()=>setMode('login');$('auth-register').onclick=()=>setMode('register');setMode('login');
 function stored():Session|undefined {
  try{
   const v=JSON.parse(sessionStorage.getItem(storageKey)||'null');
   // Older sessions stored their former login/display name under name.
   if(v&&typeof v.token==='string'&&Number.isInteger(v.color)){
    const ownUsername=typeof v.username==='string'?v.username:v.name;
    if(typeof ownUsername==='string')return{token:v.token,username:ownUsername,displayName:typeof v.displayName==='string'?v.displayName:'',color:v.color};
   }
  }catch{}
  return undefined;
 }
 for(const id of ['auth-login','auth-register'])$(id).removeAttribute('disabled');
 const previous=stored();if(previous)username.value=previous.username;
 return {
  previous,
  setCoat:editor.setCoat,
  request:(color:number):JoinRequest=>mode==='register'?{mode,username:username.value,displayName:displayName.value,password:password.value,color,appearance:editor.value(color)}:{mode,username:username.value,password:password.value,color},
  accepted:(token:string,ownUsername:string,publicName:string,color:number)=>{editor.show(false);password.value='';username.value=ownUsername;try{sessionStorage.setItem(storageKey,JSON.stringify({token,username:ownUsername,displayName:publicName,color}));}catch{}},
  clear:()=>{try{sessionStorage.removeItem(storageKey);}catch{}},
  loggedOut:()=>{setMode('login');password.value='';},
 };
}
