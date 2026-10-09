import fs from 'node:fs';
import { createHash } from 'node:crypto';
const env=Object.fromEntries(fs.readFileSync('.env.qacheck','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
for(const voice of ['Sulafat','Achird']){
 const r=await fetch(env.EXPO_PUBLIC_SUPABASE_URL+'/functions/v1/tts-preview',{method:'POST',headers:{apikey:env.EXPO_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({text:'Hola. Soy la voz de MediClaro. Te acompañaré con una lectura clara, natural y tranquila.',voice,purpose:'preview'}),signal:AbortSignal.timeout(65000)});
 const d=await r.json();
 const b=Buffer.from(d.audioBase64??'','base64');
 console.log(JSON.stringify({voice,status:r.status,error:d.code,returnedVoice:d.voice,model:d.model,bytes:b.length,header:b.subarray(0,4).toString(),sha256:b.length?createHash('sha256').update(b).digest('hex'):null}));
 if(!r.ok||b.subarray(0,4).toString()!=='RIFF')process.exitCode=1;
}
