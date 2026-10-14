import type { AssistantMessage } from '../types';
export interface CaregiverSignal { clientKey:string; summary:string; emergency:boolean }
export function currentCaregiverSignal(messages:AssistantMessage[]):CaregiverSignal|null {
 const latest=messages.at(-1);
 if(!latest)return null;
 const user=latest.role==='user'?latest:messages.slice(0,-1).reverse().find(m=>m.role==='user');
 if(!user)return null;
 const normalized=user.text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const reported=/(?:^|[.!?]\s*)(?:ahora\s+)?(?:yo\s+)?(?:me encuentro mal|me siento mal|estoy mal|no me encuentro bien|no me siento bien|me estoy mareando)(?:\b)/.test(normalized);
 const emergency=latest.role==='assistant'&&!!latest.emergency;
 if(!reported&&!emergency)return null;
 return {clientKey:'assistant-'+user.id,summary:('El paciente comunica: '+user.text).slice(0,2000),emergency};
}
export function notificationDescription(state:string):string {
 const descriptions:Record<string,string>={
 pending:'Aviso pendiente de envío.',
 no_registered_device:'El cuidador no tiene un móvil registrado para recibir notificaciones.',
 provider_accepted:'El proveedor ha aceptado la notificación; aún no confirma recepción.',
 provider_delivered:'El proveedor confirma el envío al dispositivo; no confirma que alguien lo haya leído.',
 provider_retry:'No se ha podido enviar la notificación. Se está reintentando.',
 provider_failed:'No se ha podido enviar la notificación.',
 provider_rejected:'El proveedor ha rechazado la notificación.',
 provider_receipt_error:'El proveedor no ha confirmado la entrega.',
 cancelled:'Notificación cancelada al terminar el aviso o revocar el vínculo.',
 };
 return descriptions[state]??'Entrega de la notificación sin confirmar.';
}
