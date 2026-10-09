import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, AppText, Card, EmergencyCallButton, ErrorState, InfoBanner, LoadingState, PrimaryButton, Screen, SecondaryButton } from '../../components';
import { useSession } from '../../hooks';
import { EmergencyService, EmergencySession } from '../../services';
import { callNumberOrExplain, EMERGENCY_HREF, useOfficialCall, usePreparedEmergency } from './parts';
export default function EmergencyNotifyScreen() {
 const router=useRouter();const params=useLocalSearchParams<{auto?:string|string[]}>();
 const automatic=(Array.isArray(params.auto)?params.auto[0]:params.auto)==='1';
 const {session:auth}=useSession();const demo=auth?.mode==='demo';
 const {prepared,error,retry}=usePreparedEmergency();
 const {callOfficial,callingOfficial}=useOfficialCall();
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[failure,setFailure]=useState('');
 const attempt=useRef<string|null>(null),sending=useRef(false),started=useRef(false),alive=useRef(true);
 useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
 const send=useCallback(async()=>{
  if(!prepared||sending.current)return;
  if(demo){setNotice('Modo demostración: no se ha enviado ningún aviso real.');return;}
  sending.current=true;setBusy(true);setFailure('');
  try{
   const result=await EmergencyService.contactCaregiverAutomatically(prepared);
   attempt.current=result.attemptId;
   if(alive.current){
    setNotice('Aviso enviado. MediClaro abre ahora el chat e inicia la llamada por internet a tu cuidador/a.');
    router.replace({pathname:'/caregiver',params:{incident:result.attemptId,autocall:'1'}});
   }
  }catch(e){if(alive.current)setFailure((e as Error).message);}
  finally{sending.current=false;if(alive.current)setBusy(false);}
 },[prepared,demo,router]);
 useEffect(()=>{
  if(!automatic||!prepared||started.current)return;
  const timer=setTimeout(()=>{started.current=true;void send();},1200);
  return()=>clearTimeout(timer);
 },[automatic,prepared,send]);
 useEffect(()=>{
  let cancelled=false;
  const poll=async()=>{
   if(!attempt.current||AppState.currentState!=='active')return;
   try{
    const status=await EmergencyService.getCaregiverContactStatus(attempt.current);
    if(!cancelled&&status.acknowledged){
     EmergencySession.caregiverNotified();
     setNotice('Tu cuidador ha confirmado que te está atendiendo.');
    }
   }catch{/* Keep the last confirmed state. */}
  };
  const interval=setInterval(()=>void poll(),5000);
  return()=>{cancelled=true;clearInterval(interval);};
 },[]);
 const caregiver=prepared?.profile.caregiver;
 return <Screen header={<AppHeader title="Avisar a mi cuidador" fallbackHref={EMERGENCY_HREF.main} />}
  footer={<EmergencyCallButton onPress={()=>void callOfficial()} loading={callingOfficial} />} testID="emergency-notify">
  {!prepared?(error?<ErrorState title="No hemos podido preparar el aviso" message={error} onRetry={()=>void retry()} />:<LoadingState message="Preparando el aviso…" />):<View style={{gap:16}}>
   <InfoBanner title="Chat privado durante este aviso" message="Tu cuidador vinculado podrá abrir el aviso en MediClaro, hablar contigo y decidir si llama al 112. Necesita conexión y tener las notificaciones activadas." />
   {notice?<InfoBanner title={notice} />:null}
   {failure?<InfoBanner tone="danger" title="No se ha podido registrar el aviso" message={failure} />:null}
   <PrimaryButton label={attempt.current?'Reintentar aviso y llamada':'Avisar y llamar a mi cuidador/a'} icon="call-outline" loading={busy} onPress={()=>void send()} testID="notify-send" />
   <SecondaryButton label="Abrir el chat del aviso" onPress={()=>router.push('/caregiver')} />
   <SecondaryButton label="Vincular cuidador y activar notificaciones" onPress={()=>router.push('/caregiver')} />
   <Card style={{gap:12}}>
    <AppText>Solo se comparte la información que has autorizado en tu perfil de emergencia. La ubicación muestra cuándo se actualizó por última vez.</AppText>
    <SecondaryButton label="Revisar permisos para compartir" onPress={()=>router.push(EMERGENCY_HREF.sharing)} />
   </Card>
   {caregiver?.phone.trim()?<SecondaryButton label={'Llamar a '+caregiver.name} onPress={()=>void callNumberOrExplain(caregiver.phone,caregiver.phone)} testID="notify-call" />:null}
   <AppText>Una notificación enviada no confirma que alguien te esté atendiendo. Si necesitas ayuda urgente, puedes llamar al 112 con el botón de abajo.</AppText>
  </View>}
 </Screen>;
}
