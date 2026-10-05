import {BOARD_PAGE_SIZE,type BoardKind,type BoardPage,type BoardRow} from '../shared/leaderboard';
import {createPets,type Pet} from '../shared/pets';
import {defaultAppearance,validAppearance,copyAppearance,decodeAppearance,type Appearance} from '../shared/appearance';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,chmodSync} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID,randomBytes,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {isAllowedName,randomName} from '../shared/names';
import {normalizeUsername} from '../shared/usernames';
import type {Player,Point} from '../shared/types';

export type Account={id:string;username:string;displayName:string;x:number;z:number;kills:number;deaths:number;appearance:Appearance|null};
type AccountRow=Omit<Account,'appearance'>&{appearance_json:string|null;salt:string;password_hash:string};
export class AccountError extends Error {constructor(public code:string,message:string){super(message);}}
const columns='id,name AS username,display_name AS displayName,x,z,kills,deaths,appearance_json';
const hashToken=(token:string)=>createHash('sha256').update(token).digest('hex');
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
const checkPassword=(value:unknown):value is string=>typeof value==='string'&&value.length>=6&&value.length<=128;

export class AccountStore {
 readonly db:DatabaseSync;
 constructor(path=':memory:'){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true,mode:0o700});
  this.db=new DatabaseSync(path);
  if(path!==':memory:')chmodSync(path,0o600);
  try{
   this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS accounts (
     id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, display_name TEXT NOT NULL DEFAULT '', appearance_json TEXT,
     salt TEXT NOT NULL, password_hash TEXT NOT NULL,
     token_hash TEXT UNIQUE, token_expires INTEGER NOT NULL DEFAULT 0,
     x REAL NOT NULL, z REAL NOT NULL, kills INTEGER NOT NULL DEFAULT 0 CHECK(kills>=0), deaths INTEGER NOT NULL DEFAULT 0 CHECK(deaths>=0), updated_at INTEGER NOT NULL
    ) STRICT;`);
   this.migrateDisplayNames();
   this.db.exec(`CREATE TABLE IF NOT EXISTS campus_pets(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES accounts(id),x REAL NOT NULL,z REAL NOT NULL,home_x REAL NOT NULL,home_z REAL NOT NULL) STRICT;`);
  }catch(error){this.db.close();throw error;}
 }
 private migrateDisplayNames(){
  const version=Number(this.db.prepare('PRAGMA user_version').get()!.user_version);
  if(version>3)throw Error('Account database schema is newer than this server supports');
  // Keep the legacy unique name column as the private login username. All old
  // credentials, IDs, tokens and gameplay records remain byte-for-byte intact.
  this.db.exec('BEGIN IMMEDIATE');
  try{
   if(!this.db.prepare('PRAGMA table_info(accounts)').all().some(row=>row.name==='display_name'))this.db.exec("ALTER TABLE accounts ADD COLUMN display_name TEXT NOT NULL DEFAULT ''");
   if(!this.db.prepare('PRAGMA table_info(accounts)').all().some(row=>row.name==='appearance_json'))this.db.exec('ALTER TABLE accounts ADD COLUMN appearance_json TEXT');
   const update=this.db.prepare('UPDATE accounts SET display_name=? WHERE id=?');
   for(const row of this.db.prepare('SELECT id,name,display_name FROM accounts').all()){
    if(isAllowedName(row.display_name)&&row.display_name!==row.name)continue;
    let displayName=randomName();while(displayName===row.name)displayName=randomName();
    update.run(displayName,row.id);
   }
   this.db.exec('PRAGMA user_version=3; COMMIT');
  }catch(error){this.db.exec('ROLLBACK');throw error;}
 }
 private account(row:AccountRow):Account{
  const {id,username,displayName,x,z,kills,deaths}=row;
  return {id,username,displayName,x,z,kills,deaths,appearance:decodeAppearance(row.appearance_json)};
 }
 resolveAppearance(id:string,fallbackCoat:number):Appearance{
  const row=this.db.prepare('SELECT appearance_json FROM accounts WHERE id=?').get(id);
  if(!row)throw Error('Account missing while resolving appearance');
  const saved=decodeAppearance(row.appearance_json as string|null);if(saved)return saved;
  const appearance=defaultAppearance(fallbackCoat);
  this.db.prepare('UPDATE accounts SET appearance_json=? WHERE id=? AND appearance_json IS NULL').run(JSON.stringify(appearance),id);
  return appearance;
 }
 private find(username:string){return this.db.prepare(`SELECT ${columns},salt,password_hash FROM accounts WHERE name=?`).get(username) as AccountRow|undefined;}
 async register(value:unknown,displayName:unknown,password:unknown,spawn:Point,appearanceValue:unknown=defaultAppearance()):Promise<Account>{
  const username=normalizeUsername(value);
  if(!username)throw new AccountError('username','用户名需为 3–32 个字，支持字母、汉字、数字和 _ . -，不含空格。');
  if(!isAllowedName(displayName))throw new AccountError('displayName','请从候选字组合显示名字，避开不合适的组合。');
  if(displayName===username)throw new AccountError('displayName','显示名字不能与登录用户名相同，请换一个组合。');
  if(!validAppearance(appearanceValue))throw new AccountError('appearance','请选择有效的角色外观组合。');
  const appearance=copyAppearance(appearanceValue);
  if(!checkPassword(password))throw new AccountError('password','密码需要 6–128 个字符。');
  if(this.find(username))throw new AccountError('duplicate','这个用户名已注册，请换一个用户名或登录。');
  const salt=randomBytes(16).toString('hex'),hash=(await derive(password,salt)).toString('hex'),id=randomUUID();
  try{this.db.prepare('INSERT INTO accounts(id,name,display_name,appearance_json,salt,password_hash,x,z,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,username,displayName,JSON.stringify(appearance),salt,hash,spawn.x,spawn.z,Date.now());}
  catch(error){if(this.find(username))throw new AccountError('duplicate','这个用户名已注册，请换一个用户名或登录。');throw error;}
  return {id,username,displayName,...spawn,kills:0,deaths:0,appearance};
 }
 async login(value:unknown,password:unknown):Promise<Account>{
  const username=normalizeUsername(value);
  if(!username||!checkPassword(password))throw new AccountError('credentials','用户名或密码不正确。');
  const row=this.find(username),key=await derive(password,row?.salt||'unregistered-account');
  if(!row||!timingSafeEqual(key,Buffer.from(row.password_hash,'hex')))throw new AccountError('credentials','用户名或密码不正确。');
  // Password hashing yields to the event loop; use the latest committed save.
  return this.account(this.find(username)!);
 }
 issueToken(accountId:string){const token=randomBytes(32).toString('hex');this.db.prepare('UPDATE accounts SET token_hash=?,token_expires=? WHERE id=?').run(hashToken(token),Date.now()+24*60*60*1000,accountId);return token;}
 resume(token:unknown):Account{
  if(typeof token!=='string'||!/^[a-f0-9]{64}$/.test(token))throw new AccountError('expired','登录已过期，请重新登录。');
  const row=this.db.prepare(`SELECT ${columns} FROM accounts WHERE token_hash=? AND token_expires>?`).get(hashToken(token),Date.now()) as AccountRow|undefined;
  if(!row)throw new AccountError('expired','登录已过期，请重新登录。');return this.account(row);
 }
 save(players:Pick<Player,'id'|'x'|'z'|'kills'|'deaths'>[]){
  if(!players.length)return;
  const update=this.db.prepare('UPDATE accounts SET x=?,z=?,kills=?,deaths=?,updated_at=? WHERE id=?');
  this.db.exec('BEGIN IMMEDIATE');
  try{for(const p of players)update.run(p.x,p.z,p.kills,p.deaths,Date.now(),p.id);this.db.exec('COMMIT');}
  catch(error){this.db.exec('ROLLBACK');throw error;}
 }
 leaderboard(kind:BoardKind,page:number,id:string):BoardPage{
  const metric=kind==='kills'?'kills':'deaths';
  const total=Number(this.db.prepare(`SELECT COUNT(*) AS n FROM accounts WHERE ${metric}>0`).get()!.n);
  page=Math.min(Math.max(0,Math.floor(page)),Math.max(0,Math.ceil(total/BOARD_PAGE_SIZE)-1));
  const rows=this.db.prepare(`SELECT id,display_name AS name,kills,deaths,rank FROM (SELECT id,display_name,kills,deaths,RANK() OVER(ORDER BY ${metric} DESC) AS rank FROM accounts WHERE ${metric}>0) ORDER BY ${metric} DESC,display_name,id LIMIT ? OFFSET ?`).all(BOARD_PAGE_SIZE,page*BOARD_PAGE_SIZE) as BoardRow[];
  const mine=this.db.prepare('SELECT id,display_name AS name,kills,deaths FROM accounts WHERE id=?').get(id) as Omit<BoardRow,'rank'>;
  const score=mine[metric],rank=score>0?1+Number(this.db.prepare(`SELECT COUNT(*) AS n FROM accounts WHERE ${metric}>?`).get(score)!.n):null;
  return {kind,page,pageSize:BOARD_PAGE_SIZE,total,rows,me:{...mine,rank},time:Date.now()};
 }
 loadPets():Pet[]{return createPets().map(p=>{const r=this.db.prepare("SELECT owner_id,x,z,home_x,home_z FROM campus_pets WHERE id=?").get(p.id);return r?{...p,ownerId:r.owner_id as string|null,x:Number(r.x),z:Number(r.z),homeX:Number(r.home_x),homeZ:Number(r.home_z)}:p;});}
 savePets(pets:Pet[]){this.db.exec("BEGIN IMMEDIATE");try{const q=this.db.prepare("INSERT INTO campus_pets(id,owner_id,x,z,home_x,home_z) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET owner_id=excluded.owner_id,x=excluded.x,z=excluded.z,home_x=excluded.home_x,home_z=excluded.home_z");for(const p of pets)q.run(p.id,p.ownerId,p.x,p.z,p.homeX,p.homeZ);this.db.exec("COMMIT");}catch(e){this.db.exec("ROLLBACK");throw e;}}
 close(){this.db.close();}
}
