import fs from 'node:fs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('.env.qacheck','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')];}));
const make=()=>createClient(env.EXPO_PUBLIC_SUPABASE_URL,env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}});
const patient=make(),caregiver=make(),stranger=make(),anon=make();
let checks=0;
const ok=(v,label)=>{assert(v,label);checks++;console.log('PASS '+label);};
const action=async(c,a,p={})=>{const r=await c.rpc('caregiver_action',{p_action:a,p_payload:p});if(r.error)throw Error(r.error.message);return r.data;};
const denied=async(c,a,p,label)=>{const r=await c.rpc('caregiver_action',{p_action:a,p_payload:p});ok(!!r.error,label);};
for(const c of [patient,caregiver,stranger]){const r=await c.auth.signInAnonymously();assert(!r.error,r.error?.message);}
const uid=(await patient.auth.getUser()).data.user.id;
let incidentId,linkId;
try{
 await denied(anon,'snapshot',{},'Unauthenticated RPC blocked');
 for(const c of [patient,caregiver,stranger]){const r=await c.rpc('care_worker_key');ok(!!r.error,'Worker secret inaccessible');}
 const worker=await fetch(env.EXPO_PUBLIC_SUPABASE_URL+'/functions/v1/caregiver-dispatch',{method:'POST',headers:{'Content-Type':'application/json','x-care-key':'invalid'},body:'{}'});
 ok(worker.status===401,'Dispatch rejects invalid secret');
 const profile=await patient.from('emergency_profiles').upsert({user_id:uid,full_name:'QA paciente',consent_notify_contact:true,consent_share_location:true,consent_share_conversation:true});
 assert(!profile.error,profile.error?.message);
 await denied(patient,'start',{clientKey:randomUUID(),summary:'QA malestar'},'No caregiver blocks incident');
 const invite=await action(patient,'invite',{name:'QA paciente'});linkId=invite.code;
 await denied(patient,'accept',{code:linkId,name:'QA self'},'Self linking blocked');
 await action(caregiver,'accept',{code:linkId,name:'QA cuidador'});
 await denied(stranger,'accept',{code:linkId,name:'QA tercero'},'Invite reuse blocked');
 ok((await action(caregiver,'snapshot')).incidents.length===0,'No chat before incident');
 const key=randomUUID();
 const started=await action(patient,'start',{clientKey:key,summary:'QA: me encuentro mal'});incidentId=started.incidentId;
 ok((await action(patient,'start',{clientKey:key,summary:'QA repeat'})).incidentId===incidentId,'Incident retries idempotent');
 ok((await action(stranger,'snapshot')).incidents.length===0,'Stranger cannot see incident');
 await denied(stranger,'message',{incidentId,content:'QA',clientKey:randomUUID()},'Stranger chat blocked');
 const direct=await caregiver.from('care_messages').select('*');ok(!!direct.error,'Direct table reads blocked');
 const view=await action(caregiver,'snapshot');ok(view.incidents.some(i=>i.id===incidentId),'Linked caregiver sees incident');
 await action(caregiver,'received',{incidentId});
 let i=(await action(patient,'snapshot')).incidents.find(i=>i.id===incidentId);
 ok(i.members.some(m=>m.receivedAt)&&!i.members.some(m=>m.acknowledgedAt),'Opening does not confirm attending');
 await action(caregiver,'ack',{incidentId});
 i=(await action(patient,'snapshot')).incidents.find(i=>i.id===incidentId);
 ok(i.members.some(m=>m.acknowledgedAt),'Caregiver attending explicitly recorded');
 await denied(caregiver,'location',{incidentId,latitude:40,longitude:-3,accuracy:10},'Caregiver cannot spoof patient GPS');
 await action(patient,'location',{incidentId,latitude:40,longitude:-3,accuracy:10});
 i=(await action(caregiver,'snapshot')).incidents.find(i=>i.id===incidentId);
 ok(i.latitude===40&&i.location_at,'Authorized GPS visible');
 const messageKey=randomUUID();
 for(let n=0;n<2;n++)await action(caregiver,'message',{incidentId,content:'QA: ¿Puedes responder?',clientKey:messageKey,checkIn:true});
 i=(await action(patient,'snapshot')).incidents.find(i=>i.id===incidentId);
 ok(i.messages.length===1&&i.messages[0].response_due_at,'Check-in idempotent with server deadline');
 await action(patient,'message',{incidentId,content:'QA: aquí estoy',clientKey:randomUUID()});
 i=(await action(caregiver,'snapshot')).incidents.find(i=>i.id===incidentId);
 ok(!!i.messages.find(m=>m.client_key===messageKey).responded_at,'Patient reply cancels deadline');
 const callRpc=async(c,a,p={})=>c.rpc('caregiver_call',{p_action:a,p_payload:{incidentId,...p}});
 const callId=randomUUID(),offer='v=0\r\ns=QA signaling only\r\n';
 let cr=await callRpc(caregiver,'offer',{callId,recipientId:uid,sdp:offer});assert(!cr.error,cr.error?.message);
 ok(cr.data.state==='ringing','Audio offer never auto-accepts');
 cr=await callRpc(stranger,'snapshot');ok(!!cr.error,'Stranger cannot read audio signaling');
 cr=await callRpc(caregiver,'answer',{callId,sdp:offer});ok(!!cr.error,'Caller cannot accept for patient');
 cr=await callRpc(patient,'answer',{callId,sdp:offer});assert(!cr.error,cr.error?.message);
 ok(cr.data.state==='answered','Only recipient accepts audio');
 cr=await callRpc(patient,'end',{callId});assert(!cr.error,cr.error?.message);
 ok((await callRpc(caregiver,'snapshot')).data===null,'Ended audio removes SDP');
 const rtc=await patient.functions.invoke('caregiver-rtc-config',{body:{incidentId}});
 ok(!!rtc.error&&rtc.error.context?.status===503,'Missing TURN is an explicit blocker');
 await patient.from('emergency_profiles').update({consent_share_location:false}).eq('user_id',uid);
 i=(await action(caregiver,'snapshot')).incidents.find(i=>i.id===incidentId);
 ok(i.latitude===null&&i.longitude===null&&!i.shareLocation,'GPS consent revocation immediately hides coordinates');
 await patient.from('emergency_profiles').update({consent_share_location:true}).eq('user_id',uid);
 const unanswered=randomUUID();
 await action(caregiver,'message',{incidentId,content:'QA: segunda comprobación',clientKey:unanswered,checkIn:true});
 console.log('Waiting for production scheduler deadline (up to 150s).');
 let escalated=false;
 for(let n=0;n<15;n++){
  await new Promise(r=>setTimeout(r,10000));
  i=(await action(patient,'snapshot')).incidents.find(i=>i.id===incidentId);
  if(i.messages.find(m=>m.client_key===unanswered)?.escalated_at){escalated=true;break;}
 }
 ok(escalated,'Production scheduler escalates unanswered check-in');
 await action(patient,'close',{incidentId});
 await denied(caregiver,'message',{incidentId,content:'QA after close',clientKey:randomUUID()},'Closed chat rejects messages');
 i=(await action(caregiver,'snapshot')).incidents.find(i=>i.id===incidentId);
 ok(i.state==='closed'&&i.latitude===null,'Closing removes location');
 await action(patient,'revoke',{linkId});
 ok(!(await action(caregiver,'snapshot')).incidents.some(i=>i.id===incidentId),'Revoked caregiver loses access');
 console.log(JSON.stringify({checks,status:'PASS'}));
}finally{
 if(incidentId)await action(patient,'close',{incidentId}).catch(()=>{});
 if(linkId)await action(patient,'revoke',{linkId}).catch(()=>{});
 for(const c of [patient,caregiver,stranger])await c.auth.signOut();
}
