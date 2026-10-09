import fs from 'node:fs';import {createHash} from 'node:crypto';
const env=Object.fromEntries(fs.readFileSync('.env.qacheck','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const text="Si MediClaro detecta una situación de malestar, puede avisar a tu cuidador o familiar vinculado, siempre que hayas autorizado esos avisos. Durante el aviso se abre un chat para que pueda hablar contigo y comprobar cómo estás. También puedes compartir tu ubicación actual si das permiso. Si no respondes al mensaje de comprobación, se envía otro aviso. Tu cuidador decide si necesita llamar al uno, uno, dos. Las llamadas autónomas al uno, uno, dos están desactivadas. Las llamadas de voz por Internet requieren que estén disponibles en ambos teléfonos. MediClaro no sustituye a los servicios de emergencia.";
for(const voice of ['Sulafat','Achird']){
 let last;
 for(let attempt=0;attempt<3;attempt++){
  try{
   const r=await fetch(env.EXPO_PUBLIC_SUPABASE_URL+'/functions/v1/tts-preview',{method:'POST',headers:{apikey:env.EXPO_PUBLIC_SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({text,voice,purpose:'preview'}),signal:AbortSignal.timeout(90000)});
   const d=await r.json();const b=Buffer.from(d.audioBase64??'','base64');
   if(!r.ok||d.voice!==voice||b.subarray(0,4).toString()!=='RIFF')throw new Error('TTS response '+r.status+' '+(d.code??'invalid audio'));
   fs.writeFileSync('assets/audio/tour-emergency-'+voice.toLowerCase()+'.wav',b);
   console.log(JSON.stringify({voice,model:d.model,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),source:'Google Gemini TTS'}));last=null;break;
  }catch(e){last=e;console.log('Retry '+voice+' '+(attempt+1)+': '+e.message);}
 }
 if(last)throw last;
}
