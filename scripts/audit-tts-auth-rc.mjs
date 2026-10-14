import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('.env.qacheck','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
const c=createClient(env.EXPO_PUBLIC_SUPABASE_URL,env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data,error}=await c.auth.signInAnonymously();
if(error) throw new Error(error.message);
try {
 const r=await fetch(env.EXPO_PUBLIC_SUPABASE_URL+'/functions/v1/tts',{method:'POST',headers:{apikey:env.EXPO_PUBLIC_SUPABASE_ANON_KEY,Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},body:JSON.stringify({text:'Prueba de autorización.',voice:'Sulafat',purpose:'assistant'})});
 const b=await r.json();
 console.log(JSON.stringify({check:'free-session-premium-gate',status:r.status,code:b.code,message:b.message??b.error}));
 if(r.status!==402) process.exitCode=1;
} finally { await c.auth.signOut(); }
