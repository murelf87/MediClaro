import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('.env.qacheck','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
const client=createClient(env.EXPO_PUBLIC_SUPABASE_URL,env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const {error}=await client.auth.signInAnonymously();if(error)throw new Error(error.message);
for(const content of [['me falta el aire'],['me encontraba mal','ya estoy bien'],['dolor de pecho','ahora estoy mejor'],['ya estoy bien pero no puedo respirar']]){
 const {data,error}=await client.functions.invoke('chat',{body:{messages:content.map(text=>({role:'user',content:text}))}});
 console.log(JSON.stringify({case:content.at(-1),httpError:error?.message??null,emergency:data?.emergency??false,reply:data?.reply??null}));
 if(error)process.exitCode=1;
}
await client.auth.signOut();
