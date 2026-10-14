import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import * as Crypto from 'expo-crypto';
import { AppText, PrimaryButton, SecondaryButton } from './index';
import { supabase } from '../lib/supabase';
import { IS_EXPO_GO } from '../utils/runtime';

interface Call {id:string;caller_id:string;recipient_id:string;state:'ringing'|'answered';offer:string;answer:string|null}
export function CaregiverAudioCall({incidentId,uid,recipients,autoStartRecipientId}:{incidentId:string;uid:string;recipients:Array<{id:string;name:string}>;autoStartRecipientId?:string|null}){
 const [call,setCall]=useState<Call|null>(null),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const peer=useRef<any>(null),stream=useRef<any>(null),activeId=useRef<string|null>(null),mounted=useRef(true),pending=useRef(false),autoStarted=useRef(false);
 const rpc=useCallback(async(action:string,payload:Record<string,unknown>={})=>{
  const {data,error}=await supabase.rpc('caregiver_call',{p_action:action,p_payload:{incidentId,...payload}});
  if(error)throw new Error(error.message.includes('CALL_BUSY')?'Ya hay una llamada en este aviso.':'No se ha podido completar la llamada. Comprueba la conexión.');
  return data as Call|null;
 },[incidentId]);
 const release=useCallback(()=>{
  peer.current?.close();peer.current=null;
  stream.current?.getTracks().forEach((t:any)=>t.stop());stream.current=null;
 },[]);
 const end=useCallback(async()=>{
  const id=activeId.current;activeId.current=null;release();
  if(id)await rpc('end',{callId:id}).catch(()=>undefined);
  if(mounted.current){setCall(null);setStatus('Llamada finalizada.');}
 },[release,rpc]);
 useEffect(()=>{
  mounted.current=true;let polling=false;
  const poll=async()=>{
   if(polling||AppState.currentState!=='active')return;polling=true;
   try{
    const latest=await rpc('snapshot');
    if(!mounted.current)return;
    setCall(latest);
    if(!latest&&activeId.current&&!pending.current){activeId.current=null;release();setStatus('La llamada ha terminado o no ha sido aceptada.');}
    if(latest?.caller_id===uid&&latest.answer&&peer.current&&!peer.current.remoteDescription){
     const {RTCSessionDescription}=await import('react-native-webrtc');
     await peer.current.setRemoteDescription(new RTCSessionDescription({type:'answer',sdp:latest.answer}));
    }
   }catch(e){if(mounted.current)setStatus((e as Error).message);}
   finally{polling=false;}
  };
  void poll();const interval=setInterval(()=>void poll(),3000);
  const app=AppState.addEventListener('change',state=>{if(state!=='active')void end();else void poll();});
  return()=>{mounted.current=false;clearInterval(interval);app.remove();void end();};
 },[rpc,uid,release,end]);
 const connect=async(incoming:Call|null,recipientId?:string)=>{
  if(pending.current)return;pending.current=true;setBusy(true);setStatus('');
  try{
   if(Platform.OS==='web')throw new Error('Las llamadas de audio necesitan la app instalada en el móvil.');
   if(IS_EXPO_GO)throw new Error('Las llamadas de audio por internet funcionan en la app MediClaro instalada. En la vista previa de Expo Go no están disponibles; el chat y la ubicación sí.');
   const {data:config,error:configError}=await supabase.functions.invoke('caregiver-rtc-config',{body:{incidentId}});
   if(configError||!config?.iceServers?.length)throw new Error('No se puede iniciar el audio: la conexión para llamadas todavía no está disponible.');
   const rtc=await import('react-native-webrtc');
   const media=await rtc.mediaDevices.getUserMedia({audio:true,video:false});
   if(!mounted.current){media.getTracks().forEach(t=>t.stop());return;}
   stream.current=media;
   const pc=new rtc.RTCPeerConnection(config);peer.current=pc;
   media.getTracks().forEach(t=>pc.addTrack(t,media));
   pc.onconnectionstatechange=()=>{
    if(!mounted.current)return;
    if(pc.connectionState==='connected')setStatus('Audio conectado.');
    else if(pc.connectionState==='failed'){void end().then(()=>{if(mounted.current)setStatus('No se ha podido conectar el audio.');});}
   };
   activeId.current=incoming?.id??Crypto.randomUUID();
   if(incoming)await pc.setRemoteDescription(new rtc.RTCSessionDescription({type:'offer',sdp:incoming.offer}));
   const description=incoming?await pc.createAnswer():await pc.createOffer({});
   await pc.setLocalDescription(description);
   await new Promise<void>((resolve,reject)=>{
    if(pc.iceGatheringState==='complete'){resolve();return;}
    const timeout=setTimeout(()=>{pc.onicegatheringstatechange=null;reject(new Error('No se ha podido preparar la conexión de audio.'));},15000);
    const listener=()=>{if(pc.iceGatheringState==='complete'){clearTimeout(timeout);pc.onicegatheringstatechange=null;resolve();}};
    pc.onicegatheringstatechange=listener;
   });
   if(!mounted.current)throw new Error('Pantalla cerrada.');
   const result=await rpc(incoming?'answer':'offer',{callId:activeId.current,recipientId,sdp:pc.localDescription?.sdp});
   if(mounted.current){setCall(result);setStatus(incoming?'Conectando audio…':'Esperando a que acepte la llamada…');}
  }catch(e){
   await end();
   if(mounted.current)setStatus((e as Error).message||'No se ha podido iniciar la llamada.');
  }finally{pending.current=false;if(mounted.current)setBusy(false);}
 };
 useEffect(()=>{
  if(!autoStartRecipientId||autoStarted.current||call||activeId.current||pending.current)return;
  if(!recipients.some(r=>r.id===autoStartRecipientId))return;
  autoStarted.current=true;
  setStatus('Iniciando llamada automática al cuidador…');
  void connect(null,autoStartRecipientId);
  // connect usa el incidente y destinatario actuales; autoStarted evita dobles llamadas.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[autoStartRecipientId,call,recipients]);
 return <View style={{gap:10}}>
  <AppText variant="bodyStrong">Llamada de audio por internet</AppText>
  {status?<AppText accessibilityRole="alert">{status}</AppText>:null}
  {call?.recipient_id===uid&&call.state==='ringing'?<>
   <PrimaryButton label="Aceptar llamada de audio" loading={busy} onPress={()=>void connect(call)} />
   <SecondaryButton label="Rechazar llamada" onPress={()=>{activeId.current=call.id;void end();}} />
  </>:call||activeId.current?<SecondaryButton label="Colgar llamada" onPress={()=>void end()} />:
   recipients.map(r=><SecondaryButton key={r.id} label={'Llamar por internet a '+r.name} disabled={busy} onPress={()=>void connect(null,r.id)} />)}
  <AppText>Necesita internet y permiso del micrófono. En esta versión, ambas personas deben mantener MediClaro abierta durante la llamada.</AppText>
 </View>;
}
