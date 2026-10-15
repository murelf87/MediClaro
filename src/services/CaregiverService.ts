import { supabase } from '../lib/supabase';
export interface CareLink { id:string;patientId:string;caregiverId:string|null;patientName:string;caregiverName:string|null;accepted:boolean }
export interface CareMessage { id:string;sender_id:string;content:string;created_at:string;response_due_at:string|null;responded_at:string|null;escalated_at:string|null }
export interface CareIncident { id:string;patient_id:string;summary:string;state:'active'|'closed';created_at:string;expires_at:string;latitude:number|null;longitude:number|null;accuracy:number|null;location_at:string|null;shareLocation:boolean;notificationState:string;messages:CareMessage[];members:Array<{receivedAt:string|null;acknowledgedAt:string|null;caregiverName:string}> }
export interface CareSnapshot { role:'patient'|'caregiver';links:CareLink[];incidents:CareIncident[] }
export interface CarePairRequest { linkId:string;patientName:string;status:'pending'|'accepted' }
export interface CarePairStatus { premium:boolean;code:string|null;role:'patient'|'caregiver' }
export async function careAction<T>(action:string,payload:Record<string,unknown>={}):Promise<T> {
 const {data,error}=await supabase.rpc('caregiver_action',{p_action:action,p_payload:payload});
 if(error)throw new Error(careError(error.message));
 return data as T;
}
export async function carePairAction<T>(action:string,payload:Record<string,unknown>={}):Promise<T> {
 const {data,error}=await supabase.rpc('care_pairing_action',{p_action:action,p_payload:payload});
 if(error)throw new Error(careError(error.message));
 return data as T;
}
export function careError(message:string):string {
 const errors:Record<string,string>={
 NO_LINKED_CAREGIVER:'No tienes un cuidador vinculado que haya aceptado la invitación.',
 CONTACT_CONSENT_REQUIRED:'Activa el permiso para avisar a tu cuidador en el perfil de emergencia.',
 INVALID_INVITE:'La invitación no es válida, ya fue utilizada o ha caducado.',
 INVALID_CODE:'Ese código de 6 números no corresponde a un paciente Premium activo.',
 INVALID_REQUEST:'La solicitud ya no está disponible o ha caducado.',
 SELF_LINK:'No puedes vincular tu propio perfil como cuidador.',
 PREMIUM_REQUIRED:'El paciente debe tener MediClaro Premium activo para gestionar cuidadores.',
 INCIDENT_CLOSED:'El incidente está cerrado. Este chat ya no admite mensajes.',
 NOT_ALLOWED:'No tienes acceso a este aviso.', RATE_LIMIT:'Espera un momento antes de reintentarlo.',
 };
 return Object.entries(errors).find(([key])=>message.includes(key))?.[1] ?? 'No se ha podido completar la operación. Comprueba tu conexión y reintenta.';
}
export function locationFresh(locationAt:string|null,now=Date.now()):boolean {
 return !!locationAt && Number.isFinite(Date.parse(locationAt)) && now-Date.parse(locationAt)>=0 && now-Date.parse(locationAt)<60000;
}
export function incidentActive(i:Pick<CareIncident,'state'|'expires_at'>,now=Date.now()):boolean {
 return i.state==='active' && Date.parse(i.expires_at)>now;
}
/** Última situación de cuidado conocida (para el botón central de la barra inferior: si hay un aviso activo). */
let lastSnapshot:CareSnapshot|null=null;
const snapshotListeners=new Set<()=>void>();
export function subscribeCareSnapshot(listener:()=>void):()=>void { snapshotListeners.add(listener); return ()=>{snapshotListeners.delete(listener);}; }
export function getLastCareSnapshot():CareSnapshot|null { return lastSnapshot; }
function rememberSnapshot(s:CareSnapshot|null):void { lastSnapshot=s; snapshotListeners.forEach(l=>l()); }
export const CaregiverService={
 snapshot:async()=>{
  const snapshot=await careAction<CareSnapshot>('snapshot').then(s=>{rememberSnapshot(s);return s;});
  // El rol cuidador existe mientras haya al menos una vinculación aceptada activa.
  // Si la última vinculación se revoca, vuelve automáticamente a perfil paciente/básico
  // (Premium, si existe, sigue dependiendo exclusivamente de la suscripción).
  if(snapshot.role==='caregiver'&&!snapshot.links.some(l=>l.accepted&&!!l.caregiverId)){
   await careAction('role',{role:'patient'}).catch(()=>undefined);
   return {...snapshot,role:'patient' as const};
  }
  return snapshot;
 },
 role:(role:'patient'|'caregiver')=>careAction('role',{role}),
 invite:(name:string)=>careAction<{code:string;expiresAt:string}>('invite',{name}),
 accept:(code:string,name:string)=>careAction('accept',{code:code.trim(),name}),
 revoke:(linkId:string)=>careAction('revoke',{linkId}),
 pairingStatus:()=>carePairAction<CarePairStatus>('status'),
 patientCode:()=>carePairAction<{code:string}>('my_code'),
 rotatePatientCode:()=>carePairAction<{code:string}>('rotate_code'),
 requestByCode:(code:string,name:string)=>carePairAction<CarePairRequest>('request',{code:code.trim(),name:name.trim()}),
 approvePairing:(linkId:string)=>carePairAction<{accepted:true;caregiverName:string|null}>('approve',{linkId}),
 rejectPairing:(linkId:string)=>carePairAction<{rejected:true}>('reject',{linkId}),
 disconnect:(linkId:string)=>carePairAction<{disconnected:true}>('disconnect',{linkId}),
 start:(clientKey:string,summary:string)=>careAction<{incidentId:string;queued:boolean}>('start',{clientKey,summary}),
 received:(incidentId:string)=>careAction('received',{incidentId}),
 acknowledge:(incidentId:string)=>careAction('ack',{incidentId}),
 message:(incidentId:string,content:string,clientKey:string,checkIn=false)=>careAction('message',{incidentId,content,clientKey,checkIn}),
 close:(incidentId:string)=>careAction('close',{incidentId}),
 location:(incidentId:string,latitude:number,longitude:number,accuracy:number|null)=>careAction('location',{incidentId,latitude,longitude,accuracy}),
};
