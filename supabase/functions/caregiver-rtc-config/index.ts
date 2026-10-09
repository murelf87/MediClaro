import { handler, admin, json, fail } from '../_shared/common.ts';
// Credenciales temporales para las llamadas de voz por internet entre paciente y cuidador/a:
//  · durante un aviso de emergencia (incidentId), como hasta ahora;
//  · o desde el chat, en cualquier momento (linkId): la vinculación debe estar aceptada y la persona cuidada con Premium.
// Siempre con la sesión de quien llama (su JWT): solo se comprueba lo que esa persona puede ver.
Deno.serve(handler({bucket:'caregiver-rtc',maxPerMinute:10},async(req,user,body)=>{
 const jwt=req.headers.get('Authorization')!;
 const rpc=(name:string)=>fetch(Deno.env.get('SUPABASE_URL')+'/rest/v1/rpc/'+name,{
  method:'POST',headers:{Authorization:jwt,apikey:Deno.env.get('SUPABASE_ANON_KEY')!,'Content-Type':'application/json'},
  body:JSON.stringify({p_action:name==='care_chat_action'?'list':'snapshot',p_payload:{}}),
 });
 if(typeof body?.linkId==='string'&&body.linkId){
  const response=await rpc('care_chat_action');
  if(!response.ok)return fail('No se ha podido comprobar la conversación.',403);
  const list=await response.json();
  const conversation=list?.conversations?.find((c:any)=>c?.linkId===body.linkId&&c?.canSend===true);
  if(!conversation)return fail('Esta conversación no permite llamadas ahora mismo.',403);
 }else{
  const response=await rpc('caregiver_action');
  if(!response.ok)return fail('No se ha podido comprobar el aviso.',403);
  const snapshot=await response.json();
  const incident=snapshot.incidents?.find((i:any)=>i.id===body.incidentId&&i.state==='active'&&Date.parse(i.expires_at)>Date.now());
  if(!incident)return fail('El aviso no está activo o no tienes acceso.',403);
 }
 const urls=(Deno.env.get('CAREGIVER_TURN_URLS')??'').split(',').map(s=>s.trim()).filter(s=>/^turns?:[^\s]+$/.test(s));
 const secret=Deno.env.get('CAREGIVER_TURN_SHARED_SECRET');
 if(!urls.length||!secret){
  return json({
   iceServers:[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}],
   expiresAt:Math.floor(Date.now()/1000)+1800,
   relayMode:'stun-only',
   warning:'Conexión directa de prueba: puede fallar en algunas redes móviles o routers. TURN mejora la fiabilidad.'
  });
 }
 const expires=Math.floor(Date.now()/1000)+1800;
 const username=expires+':'+user.id;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-1'},false,['sign']);
 const bytes=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(username)));
 const credential=btoa(String.fromCharCode(...bytes));
 return json({iceServers:[{urls,username,credential}],expiresAt:expires,relayMode:'turn'});
}));
