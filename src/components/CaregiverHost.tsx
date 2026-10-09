import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import { useSession } from '../providers/SessionProvider';
import { CaregiverService, incidentActive } from '../services/CaregiverService';
import { enableCaregiverNotifications } from '../services/CaregiverNotifications';
import { CareChatService } from '../services/CareChatService';
import { CareCallService } from '../services/CareCallService';
/** Avisos que abre este anfitrión: los de familiares (avisos y vinculación), el chat y las llamadas con el cuidador/a. */
const CARE_ROUTES = new Set(['/caregiver', '/caregiver-chat', '/caregiver-call']);
export function CaregiverHost(){
 const {session}=useSession(); const router=useRouter();
 const uid=session?.userId;
 useEffect(()=>{
  if(!uid||session?.mode==='demo'||Platform.OS==='web')return;
  let stopped=false,busy=false,tracked:string|null=null;
  let watcher:Location.LocationSubscription|null=null;
  const stopWatch=()=>{watcher?.remove();watcher=null;tracked=null;};
  const navigate=(n:Notifications.Notification)=>{
   const data=n.request.content.data as {route?:unknown;linkId?:unknown;callId?:unknown}|undefined;
   // «X te está llamando»: a la pantalla de la llamada (si ya no suena, dirá «Llamada perdida»).
   if(data?.route==='/caregiver-call'&&typeof data.linkId==='string'&&typeof data.callId==='string'){
    if(!CareCallService.isScreenOpen())router.push({pathname:'/caregiver-call',params:{link:data.linkId,call:data.callId,incoming:'1'}} as Href);
   }
   // «X te ha escrito»: directamente a esa conversación.
   else if(data?.route==='/caregiver-chat'&&typeof data.linkId==='string'&&data.linkId)router.push({pathname:'/caregiver-chat',params:{link:data.linkId}} as Href);
   else if(typeof data?.route==='string'&&CARE_ROUTES.has(data.route))router.push('/caregiver' as Href);
  };
  const tap=Notifications.addNotificationResponseReceivedListener(r=>navigate(r.notification));
  // Con la app abierta, un mensaje nuevo actualiza enseguida los «sin leer» del botón central.
  const received=Notifications.addNotificationReceivedListener(n=>{
   const kind=n.request.content.data?.kind;
   if(kind==='care_chat')void CareChatService.refreshSummary(0);
   // Llamada con la app abierta: se abre enseguida la pantalla para contestar.
   if(kind==='care_call')CareCallService.requestIncomingCheck();
  });
  // Solo los avisos de familiares y del chat: los de «Mis pastillas» los abre PillReminderHost.
  void Notifications.getLastNotificationResponseAsync().then(r=>{const route=r?.notification.request.content.data?.route;if(!stopped&&r&&typeof route==='string'&&CARE_ROUTES.has(route)){navigate(r.notification);void Notifications.clearLastNotificationResponseAsync().catch(()=>undefined);}}).catch(()=>undefined);
  void enableCaregiverNotifications(false).catch(()=>undefined);
  const poll=async()=>{
   if(stopped||busy||AppState.currentState!=='active')return;busy=true;
   try {
    const snapshot=await CaregiverService.snapshot();
    if(stopped)return;
    const own=snapshot.incidents.filter(i=>i.patient_id===uid&&incidentActive(i)).sort((a,b)=>b.created_at.localeCompare(a.created_at))[0];
    if(!own||!own.shareLocation){stopWatch();return;}
    if(tracked===own.id)return;
    stopWatch();
    if((await Location.getForegroundPermissionsAsync()).status!=='granted'||stopped)return;
    tracked=own.id;
    const subscription=await Location.watchPositionAsync({accuracy:Location.Accuracy.High,timeInterval:10000,distanceInterval:10},position=>{
     if(stopped||tracked!==own.id)return;
     void CaregiverService.location(own.id,position.coords.latitude,position.coords.longitude,position.coords.accuracy).catch(()=>undefined);
    });
    if(stopped||tracked!==own.id)subscription.remove();else watcher=subscription;
   }catch{ /* private dashboard shows retry; never claims location is live */ }
   finally{busy=false;}
  };
  const state=AppState.addEventListener('change',s=>{if(s==='active')void poll();else stopWatch();});
  void poll();const interval=setInterval(()=>void poll(),10000);
  return()=>{stopped=true;clearInterval(interval);state.remove();tap.remove();received.remove();stopWatch();};
 },[uid,session?.mode,router]);
 return null;
}
