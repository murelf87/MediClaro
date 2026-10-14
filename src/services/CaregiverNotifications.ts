import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { careAction } from './CaregiverService';
import { CareChatService } from './CareChatService';
import { localStore } from '../api/storage';

const OFF_KEY='mediclaro_care_push_off_v1';
/** Si la persona apagó los avisos a propósito, la app no los vuelve a activar sola. */
export async function pushTurnedOffByUser():Promise<boolean>{return (await localStore.getJSON<boolean>(OFF_KEY,false))===true;}
export type PushState='on'|'off'|'blocked'|'unsupported';
/** Estado real: permiso del sistema + si la persona lo apagó. «blocked» = hay que permitirlo en Ajustes del móvil. */
export async function caregiverPushState():Promise<PushState>{
 if(Platform.OS==='web')return 'unsupported';
 const p=await Notifications.getPermissionsAsync();
 if(p.status!=='granted')return p.canAskAgain===false||p.status==='denied'?'blocked':'off';
 return (await pushTurnedOffByUser())?'off':'on';
}
/** Interruptor ON: pide permiso si hace falta y registra este móvil. */
export async function turnOnCaregiverPush():Promise<string>{
 await localStore.remove(OFF_KEY);  // Primero, desbloquear (si estaba apagado)
 const message=await enableCaregiverNotifications(true);  // Luego, habilitar
 return message;
}
/** Interruptor OFF: este móvil deja de recibir avisos de familiares, chat y llamadas. */
export async function turnOffCaregiverPush():Promise<void>{
 await careAction('disable_devices');
 await localStore.setJSON(OFF_KEY,true);
}
Notifications.setNotificationHandler({handleNotification:async(n)=>{
 // «Mis pastillas» con la app abierta: se abre la pantalla del aviso (PillReminderHost), que hace sonar la alarma y
 // después lo lee en voz alta; el teléfono no pone su sonido ni un banner encima (se oiría todo a la vez).
 const dose=n.request.content.data?.kind==='dose';
 // Chat: si la persona ya está viendo esa conversación, el mensaje aparece en pantalla y sobra el aviso.
 const data=n.request.content.data as {kind?:unknown;linkId?:unknown}|undefined;
 const chatOpen=data?.kind==='care_chat'&&CareChatService.isActiveConversation(data.linkId);
 // Llamada con la app abierta: suena y se ve la pantalla de la llamada (CareCallHost); el banner sobraría.
 const callOpen=data?.kind==='care_call';
 const quiet=dose||chatOpen||callOpen;
 return {shouldPlaySound:!quiet,shouldSetBadge:false,shouldShowBanner:!quiet,shouldShowList:!chatOpen};
}});
export async function enableCaregiverNotifications(request=false):Promise<string> {
 if(Platform.OS==='web')throw new Error('Los avisos push necesitan la aplicación instalada en tu móvil.');
 if(Platform.OS==='android')await Notifications.setNotificationChannelAsync('caregiver-alerts',{
  name:'Avisos de familiares',importance:Notifications.AndroidImportance.MAX,
  vibrationPattern:[0,400,200,400],sound:'default',lockscreenVisibility:Notifications.AndroidNotificationVisibility.PRIVATE,
 });
 let permission=await Notifications.getPermissionsAsync();
 if(permission.status!=='granted' && request)permission=await Notifications.requestPermissionsAsync({ios:{allowAlert:true,allowSound:true,allowBadge:false}});
 if(permission.status!=='granted')throw new Error('Permite las notificaciones de MediClaro en los ajustes de tu teléfono.');
 const projectId=Constants.easConfig?.projectId??Constants.expoConfig?.extra?.eas?.projectId;
 if(!projectId)throw new Error('No se ha configurado el proyecto de notificaciones.');
 const {data:token}=await Notifications.getExpoPushTokenAsync({projectId});
 await careAction('device',{token,enabled:true});
 return 'Dispositivo registrado. La recepción y el sonido deben comprobarse en este móvil.';
}
export async function testCaregiverSound():Promise<void>{
 await Notifications.scheduleNotificationAsync({content:{title:'MediClaro: prueba de aviso',body:'Prueba local de sonido y vibración. No es un aviso real.',sound:'default'},trigger:null});
}
export async function disableCaregiverNotifications():Promise<void> {await careAction('disable_devices');}
