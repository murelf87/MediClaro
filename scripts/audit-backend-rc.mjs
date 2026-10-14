import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(fs.readFileSync('.env.qacheck','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
const client = createClient(env.EXPO_PUBLIC_SUPABASE_URL,env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:auth,error} = await client.auth.signInAnonymously();
if(error) throw new Error('QA anonymous session: '+error.message);
const user=auth.user.id;
console.log('REAL_BACKEND_SESSION=OK');
for(const table of ['saved_medications','scans']) {
 const r=await client.from(table).select('*').limit(1);
 console.log(table+' SELECT: '+(r.error?JSON.stringify({code:r.error.code,message:r.error.message}):'OK'));
}
const row={user_id:user,nregistro:'rc-audit-test',nombre:'RC audit temporary',favorito:false};
let r=await client.from('saved_medications').upsert(row,{onConflict:'user_id,nregistro'});
console.log('SAVE: '+(r.error?JSON.stringify(r.error):'OK'));
r=await client.from('saved_medications').update({favorito:true}).eq('user_id',user).eq('nregistro',row.nregistro).select('favorito');
console.log('FAVORITE: '+(r.error?JSON.stringify(r.error):JSON.stringify(r.data)));
r=await client.from('saved_medications').delete().eq('user_id',user).eq('nregistro',row.nregistro);
console.log('CLEANUP: '+(r.error?JSON.stringify(r.error):'OK'));
await client.auth.signOut();
