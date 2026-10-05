// Login usernames are private; public display names use shared/names.ts.
export function normalizeUsername(value:unknown):string|undefined {
 if(typeof value!=='string')return undefined;
 const username=value.normalize('NFKC').trim().toLowerCase();
 return username.length>=3&&username.length<=32&&/^[\p{L}\p{N}_.-]+$/u.test(username)&&/[\p{L}\p{N}]/u.test(username)?username:undefined;
}
