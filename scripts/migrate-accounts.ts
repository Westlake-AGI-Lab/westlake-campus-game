import {decodeAppearance} from '../shared/appearance';
import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {AccountStore} from '../server/accounts';
import {isAllowedName} from '../shared/names';

// Run with the game stopped. The explicit path prevents accidental creation of
// a new database when the operator intended to upgrade an existing one.
const path=process.argv[2];
if(!path||!existsSync(path))throw Error('Usage: node dist-server/migrate-accounts.js /absolute/path/to/existing/accounts.sqlite');
const databasePath=resolve(path),beforeDb=new DatabaseSync(databasePath,{readOnly:true});
const savedColumns=beforeDb.prepare('PRAGMA table_info(accounts)').all().map(row=>'\"'+String(row.name).replaceAll('\"','\"\"')+'\"').join(',');
const before=beforeDb.prepare(`SELECT ${savedColumns} FROM accounts ORDER BY id`).all();beforeDb.close();
const store=new AccountStore(databasePath);
try{
 const fingerprint=(rows:unknown)=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
 assert.equal(fingerprint(store.db.prepare(`SELECT ${savedColumns} FROM accounts ORDER BY id`).all()),fingerprint(before),'Migration changed existing identity, credentials or gameplay records');
 for(const row of store.db.prepare('SELECT name,display_name,appearance_json FROM accounts').all()){
  decodeAppearance(row.appearance_json as string|null);
  assert.ok(isAllowedName(row.display_name),'Migration produced an invalid display name');
  assert.notEqual(row.name,row.display_name,'Public name reveals the private username');
 }
 console.log(JSON.stringify({status:'PASS',schemaVersion:3,accounts:before.length,existingCredentialsAndRecords:'preserved',publicNames:'valid and distinct from login usernames',appearance:'schema ready; existing appearance preserved; legacy defaults set on authenticated join'}));
}finally{store.close();}
