import {DatabaseSync} from 'node:sqlite';
import {scryptSync,createHash} from 'node:crypto';

// Fixture for the exact pre-separation account schema, not the current store.
export function createLegacyAccount(path:string,password:string){
 const db=new DatabaseSync(path),username='云风禾',id='legacy-stable-account',salt='1234567890abcdef1234567890abcdef',token='a'.repeat(64);
 db.exec(`CREATE TABLE accounts (
  id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, salt TEXT NOT NULL, password_hash TEXT NOT NULL,
  token_hash TEXT UNIQUE, token_expires INTEGER NOT NULL DEFAULT 0,
  x REAL NOT NULL, z REAL NOT NULL, kills INTEGER NOT NULL DEFAULT 0 CHECK(kills>=0), deaths INTEGER NOT NULL DEFAULT 0 CHECK(deaths>=0), updated_at INTEGER NOT NULL
 ) STRICT;`);
 const passwordHash=scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
 db.prepare('INSERT INTO accounts VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,username,salt,passwordHash,createHash('sha256').update(token).digest('hex'),Date.now()+86400000,3,2,7,4,123456789);
 const before=db.prepare('SELECT * FROM accounts').get()!;db.close();
 return {id,username,token,before};
}
