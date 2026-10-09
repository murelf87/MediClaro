import { admin, json } from '../_shared/common.ts';
import { careCallPushPayload, careChatPushPayload, caregiverPushPayload, caregiverLinkPushPayload, isExpoToken, medicationAlertPushPayload, sameSecret } from '../_shared/caregiverPush.ts';

async function sendJobs(table:string,jobs:any[],payload:(token:string,job:any)=>unknown){
 let processed=0;
 for(const job of jobs??[]){
  const tokens=(job.tokens??[]).filter(isExpoToken);
  if(!tokens.length){
   await admin.from(table).update({sent_at:new Date().toISOString(),provider_state:'no_registered_device'}).eq('id',job.id);
   continue;
  }
  try{
   const res=await fetch('https://exp.host/--/api/v2/push/send',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(tokens.map((t:string)=>payload(t,job))),
    signal:AbortSignal.timeout(10000),
   });
   if(!res.ok)throw new Error('Provider HTTP error');
   const response=await res.json();
   const tickets=Array.isArray(response.data)?response.data:[response.data];
   if(tickets.length!==tokens.length||tickets.some((t:any)=>!t))throw new Error('Invalid tickets');
   const retry=tickets.some((t:any)=>t.status==='error'&&t.details?.error!=='DeviceNotRegistered');
   for(let i=0;i<tickets.length;i++){
    if(tickets[i]?.details?.error==='DeviceNotRegistered')
     await admin.from('care_devices').update({enabled:false}).eq('token',tokens[i]);
   }
   const accepted=tickets.filter((t:any)=>t.status==='ok'&&typeof t.id==='string').map((t:any)=>t.id);
   await admin.from(table).update({
    sent_at:retry?null:new Date().toISOString(),
    provider_state:accepted.length?'provider_accepted':retry?'provider_retry':'provider_rejected',
    ticket_ids:accepted,
   }).eq('id',job.id);
   processed++;
  }catch{
   await admin.from(table).update({provider_state:job.attempts>=5?'provider_failed':'provider_retry'}).eq('id',job.id);
  }
 }
 return processed;
}

async function updateReceipts(table:string){
 const {data:awaiting}=await admin.from(table).select('id,ticket_ids').eq('provider_state','provider_accepted').limit(40);
 for(const job of awaiting??[]){
  if(!Array.isArray(job.ticket_ids)||!job.ticket_ids.length)continue;
  try{
   const res=await fetch('https://exp.host/--/api/v2/push/getReceipts',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({ids:job.ticket_ids}),
    signal:AbortSignal.timeout(5000),
   });
   if(!res.ok)continue;
   const {data}=await res.json();
   const receipts=job.ticket_ids.map((id:string)=>data?.[id]).filter(Boolean);
   if(receipts.length!==job.ticket_ids.length)continue;
   await admin.from(table).update({
    provider_state:receipts.every((r:any)=>r.status==='ok')?'provider_delivered':'provider_receipt_error',
   }).eq('id',job.id);
  }catch{ /* later scheduler tick retries receipt lookup */ }
 }
}

Deno.serve(async req=>{
 if(req.method!=='POST')return new Response('Method not allowed',{status:405});
 const {data:key,error:keyError}=await admin.rpc('care_worker_key');
 if(keyError||typeof key!=='string'||!await sameSecret(req.headers.get('x-care-key')??'',key))
  return new Response('Unauthorized',{status:401});

 const [{data:jobs,error},{data:linkJobs,error:linkError}]=await Promise.all([
  admin.rpc('care_claim_jobs'),
  admin.rpc('care_claim_link_jobs'),
 ]);
 if(error||linkError)return new Response('Dispatch unavailable',{status:503});

 let processed=0;
 processed+=await sendJobs('care_push_jobs',jobs??[],(t,job)=>caregiverPushPayload(t,job.incident_id,job.kind));
 processed+=await sendJobs('care_link_push_jobs',linkJobs??[],(t,job)=>caregiverLinkPushPayload(t,job.kind,job.patientName,job.caregiverName));
 // «Mis pastillas»: tomas sin confirmar (opcional). Si la migración aún no está aplicada, no afecta a lo demás.
 const {data:medicationJobs,error:medicationError}=await admin.rpc('medication_claim_alert_jobs');
 if(medicationError)console.warn('medication alerts unavailable',medicationError.message);
 else processed+=await sendJobs('medication_alert_jobs',medicationJobs??[],(t,job)=>medicationAlertPushPayload(t,job.patientName,job.scheduledTime));
 // Chat con el cuidador/a (opcional): «X te ha escrito», sin el texto. Si la migración aún no está, no afecta a lo demás.
 const {data:chatJobs,error:chatError}=await admin.rpc('care_chat_claim_push_jobs');
 if(chatError)console.warn('care chat pushes unavailable',chatError.message);
 else processed+=await sendJobs('care_chat_push_jobs',chatJobs??[],(t,job)=>careChatPushPayload(t,job.senderName,job.unread,job.link_id));
 // Llamadas de voz del chat (opcional): «X te está llamando».
 const {data:callJobs,error:callError}=await admin.rpc('care_call_claim_push_jobs');
 if(callError)console.warn('care call pushes unavailable',callError.message);
 else processed+=await sendJobs('care_call_push_jobs',callJobs??[],(t,job)=>careCallPushPayload(t,job.callerName,job.link_id,job.call_id));

 await Promise.all([
  updateReceipts('care_push_jobs'),
  updateReceipts('care_link_push_jobs'),
  medicationError?Promise.resolve():updateReceipts('medication_alert_jobs'),
  chatError?Promise.resolve():updateReceipts('care_chat_push_jobs'),
  callError?Promise.resolve():updateReceipts('care_call_push_jobs'),
 ]);
 return json({processed});
});
