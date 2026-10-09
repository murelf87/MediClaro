import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Share, StyleSheet, TextInput, View, useWindowDimensions, type ScrollView } from 'react-native';
import * as Crypto from 'expo-crypto';
import { AppHeader, AppText, Avatar, Badge, Card, Icon, InfoBanner, PrimaryButton, SecondaryButton, Screen, TextButton } from '../../components';
import { useSession, useAppTheme, useEntitlement } from '../../hooks';
import {useRouter,useLocalSearchParams} from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import {ProfileChoice} from '../../components/ProfileChoice';
import {CareInviteScanner} from '../../components/CareInviteScanner';
import {parseCareInvite,parseCarePairCode,carePairQr} from '../../services/careInvite';
import { CaregiverService, incidentActive, locationFresh, type CareSnapshot } from '../../services/CaregiverService';
import { notificationDescription } from '../../services/CaregiverAlert';
import { enableCaregiverNotifications, testCaregiverSound } from '../../services/CaregiverNotifications';
import { callNumberOrExplain } from '../emergency/parts';
import { CaregiverAudioCall } from '../../components/CaregiverAudioCall';
import { confirmAsync, showAlert } from '../../utils/dialogs';
import { GuideIllustration } from '../../components/Guide';
import { CareHowItWorks } from './CareHowItWorks';
import { isDrillIncident, startCareDrill, type CareDrill } from '../../services/careDrill';
import { CareChatService } from '../../services/CareChatService';
import { useCareChatSummary } from '../../hooks/useCareChat';
import { ChatBubble, ChatComposer } from '../../components/CareChat';
import { CareChatCard, CareChatPlaceholder } from './CareChatCard';
import { chatTime } from '../../utils/chatTimeline';

/**
 * Cuidador y avisos: quién cuida de quién, el aviso activo y su chat, el chat del día a día, «Cómo funciona» con
 * dibujos y la voz grabada de MediClaro, Mis pastillas del familiar, la vinculación (código o QR), el simulacro y
 * los ajustes de este móvil.
 */
export default function CaregiverScreen(){
 const {session}=useSession();const theme=useAppTheme();
 const {width}=useWindowDimensions();
 const compact=width<390;
 const qrSize=Math.max(132,Math.min(180,width-96));
 const guideSize=compact?92:120;
 const router=useRouter(),entitlement=useEntitlement();
 const params=useLocalSearchParams<{code?:string|string[];invite?:string|string[];incident?:string|string[];autocall?:string|string[]}>();
 const [scanning,setScanning]=useState(false);
 const [data,setData]=useState<CareSnapshot|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const [name,setName]=useState(''),[code,setCode]=useState(''),[patientCode,setPatientCode]=useState('');
 const [selected,setSelected]=useState<string|null>(null),[draft,setDraft]=useState('');
 const [notice,setNotice]=useState('');
 // «Probar la emergencia completa»: simulacro local (nadie recibe nada); se muestra igual que un aviso real.
 const [drill,setDrill]=useState<CareDrill|null>(null);
 const [,setDrillVersion]=useState(0);
 const scrollRef=useRef<ScrollView|null>(null);
 // Chat del día a día con el cuidador/a (o con el familiar al que se cuida): una conversación por vinculación.
 const chatSummary=useCareChatSummary();
 const linkingY=useRef(0);
 useEffect(()=>{
  if(!drill)return undefined;
  const off=drill.subscribe(()=>setDrillVersion(v=>v+1));
  return()=>{off();};
 },[drill]);
 useEffect(()=>()=>{drill?.stop();},[drill]);
 const alive=useRef(true),readIds=useRef(new Set<string>()),requestKey=useRef<string|null>(null),loading=useRef(false);
 const uid=session?.userId;
 const userRef=useRef(uid);userRef.current=uid;
 const refresh=useCallback(async()=>{
  if(!uid||loading.current)return;loading.current=true;
  void CareChatService.refreshSummary(4000);
  try{const result=await CaregiverService.snapshot();if(alive.current&&userRef.current===uid){setData(result);setError('');}}
  catch(e){if(alive.current)setError((e as Error).message);}
  finally{loading.current=false;}
 },[uid]);
 useEffect(()=>{
  setData(null);setSelected(null);setDraft('');setPatientCode('');readIds.current.clear();
  alive.current=true;void refresh();
  const interval=setInterval(()=>{if(AppState.currentState==='active')void refresh();},5000);
  return()=>{alive.current=false;clearInterval(interval);};
 },[refresh,uid]);
 const run=async(fn:()=>Promise<unknown>)=>{
  if(busy)return;setBusy(true);setError('');
  try{await fn();await refresh();}catch(e){setError((e as Error).message);}finally{if(alive.current)setBusy(false);}
 };
 const activateNotifications=async()=>{
  const message=await enableCaregiverNotifications(true);
  setNotice(message);
  await showAlert('Avisos activados', message);
 };
 const realActive=data?.incidents.filter(i=>incidentActive(i)).sort((a,b)=>b.created_at.localeCompare(a.created_at))??[];
 const drillIncident=drill&&drill.incident().state==='active'?drill.incident():null;
 const active=drillIncident?[drillIncident,...realActive]:realActive;
 const requestedIncident=Array.isArray(params.incident)?params.incident[0]:params.incident;
 const autoCall=(Array.isArray(params.autocall)?params.autocall[0]:params.autocall)==='1';
 const incident=active.find(i=>i.id===selected)??active.find(i=>i.id===requestedIncident)??active[0];
 const caregiver=!!incident&&incident.patient_id!==uid;
 const inDrill=!!incident&&isDrillIncident(incident.id);
 // Conversaciones con las que se puede llamar durante este aviso (la nueva llamada tipo WhatsApp).
 const chatReady=CareChatService.isSummaryLoaded();
 const incidentCalls=incident&&!inDrill?chatSummary.conversations.filter(cv=>cv.canSend&&(caregiver?cv.otherId===incident.patient_id:cv.myRole==='patient')):[];
 const autoCalled=useRef<string|null>(null);
 useEffect(()=>{
  // «Avisar y llamar a mi cuidador/a»: con la llamada nueva disponible, se abre la pantalla de llamada una sola vez.
  if(!incident||caregiver||!autoCall||incident.id!==requestedIncident||!incidentCalls.length||autoCalled.current===incident.id)return;
  autoCalled.current=incident.id;
  router.push({pathname:'/caregiver-call',params:{link:incidentCalls[0].linkId}});
 },[incident?.id,caregiver,autoCall,requestedIncident,incidentCalls.length]);
 const caregiverProfile=data?.role==='caregiver';
 const linkedPatients=(data?.links??[]).filter(l=>l.accepted&&l.caregiverId===uid).map(l=>l.patientName).filter(Boolean);
 const patientLabel=linkedPatients.length===1?linkedPatients[0]:linkedPatients.length>1?linkedPatients.join(', '):'';
 const canCreatePatientQr=entitlement.isPremium;
 const caregiverOnboarding=caregiverProfile||!entitlement.isPremium;
 useEffect(()=>{
  if(requestedIncident&&active.some(i=>i.id===requestedIncident))setSelected(requestedIncident);
 },[requestedIncident,active.length]);
 useEffect(()=>{
  if(!incident||!caregiver||readIds.current.has(incident.id))return;
  if(isDrillIncident(incident.id)){drill?.received();return;}
  const id=incident.id;readIds.current.add(id);
  void CaregiverService.received(id).then(()=>refresh()).catch(()=>readIds.current.delete(id));
 },[incident?.id,caregiver,refresh]);
 const input=(value:string,onChange:(s:string)=>void,label:string,maxLength=2000)=>
  <TextInput accessibilityLabel={label} placeholder={label} value={value} onChangeText={onChange} maxLength={maxLength}
   autoCapitalize="sentences" style={[styles.input,{color:theme.colors.text,borderColor:theme.colors.textSecondary,fontSize:18}]} />;
 useEffect(()=>{
  const rawCode=Array.isArray(params.code)?params.code[0]:params.code;
  const rawInvite=Array.isArray(params.invite)?params.invite[0]:params.invite;
  const parsed=(rawCode?parseCarePairCode(rawCode):null)??(rawInvite?parseCarePairCode(rawInvite):null)??(rawInvite?parseCareInvite(rawInvite):null);
  if(parsed)setCode(parsed);
 },[params.code,params.invite]);
 useEffect(()=>{
  if(!uid||!entitlement.isPremium){setPatientCode('');return;}
  void CaregiverService.patientCode().then(v=>setPatientCode(v.code)).catch(()=>setPatientCode(''));
 },[uid,entitlement.isPremium]);
 const send=async(checkIn=false)=>{
  const text=draft.trim();if(!incident||!text)return;
  if(isDrillIncident(incident.id)){drill?.message(text,checkIn);setDraft('');return;}
  requestKey.current??=Crypto.randomUUID();
  await CaregiverService.message(incident.id,text,requestKey.current,checkIn);
  requestKey.current=null;setDraft('');
 };
 const confirmDisconnect=async(link:CareSnapshot['links'][number])=>{
  const patientOwns=link.patientId===uid;
  const person=patientOwns?(link.caregiverName??'este cuidador/a'):link.patientName;
  const ok=await confirmAsync({
   title:patientOwns?'¿Desvincular cuidador/a?':'¿Dejar de ser cuidador/a?',
   message:patientOwns
    ?`Vas a desvincular a ${person}. Dejará de recibir tus avisos, mensajes y datos compartidos. Esta acción requiere tu confirmación.`
    :`Vas a dejar de estar vinculado/a como cuidador/a de ${person}. Dejarás de recibir sus avisos y mensajes.`,
   confirmText:patientOwns?'Sí, desvincular':'Sí, desvincularme',
   cancelText:'Cancelar',
   destructive:true,
  });
  if(!ok)return;
  await run(async()=>{
   await CaregiverService.disconnect(link.id);
   setNotice(patientOwns
    ?`${person} ya no está vinculado/a como tu cuidador/a.`
    :`Ya no estás vinculado/a como cuidador/a de ${person}.`);
  });
 };
 const startDrill=()=>{
  if(drill||realActive.length)return;
  const asCaregiver=caregiverProfile;
  const caregiverName=(data?.links??[]).find(l=>l.accepted&&l.patientId===uid&&l.caregiverId)?.caregiverName;
  const next=startCareDrill({
   role:asCaregiver?'caregiver':'patient',
   me:uid??'yo',
   otherName:asCaregiver?(linkedPatients[0]||'Tu familiar'):(caregiverName||'tu cuidador/a'),
  });
  setDrill(next);setSelected(next.incident().id);setDraft('');requestKey.current=null;setNotice('');
  // El aviso (real o de prueba) aparece arriba del todo.
  setTimeout(()=>scrollRef.current?.scrollTo({y:0,animated:true}),350);
 };
 const endDrill=()=>{drill?.stop();setDrill(null);setSelected(null);setDraft('');setNotice('Simulacro terminado. No se ha avisado a nadie.');};
 if(!uid)return <Screen header={<AppHeader title="Cuidador y avisos" />}><ProfileChoice/></Screen>;
 const c=theme.colors;
 const myLinks=data?.links??[];
 const acceptedPatients=myLinks.filter(l=>l.accepted&&l.caregiverId===uid);
 const myCaregivers=myLinks.filter(l=>l.accepted&&l.patientId===uid&&l.caregiverId);
 const pendingRequests=myLinks.filter(l=>!l.accepted&&l.patientId===uid);
 const heroTitle=caregiverProfile
  ?(patientLabel?`Cuidas de ${patientLabel}`:'Perfil de cuidador/a')
  :canCreatePatientQr
   ?(myCaregivers.length?`${myCaregivers.map(l=>l.caregiverName??'Tu cuidador/a').join(', ')} te acompaña`:'Tu cuidador/a')
   :'¿Quieres ser cuidador/a?';
 const heroText=caregiverProfile
  ?(patientLabel?'Recibes sus avisos de emergencia y sus mensajes. Ser cuidador/a es gratis.':'Tu perfil está preparado. Vincúlate con el código de 6 números de tu familiar.')
  :canCreatePatientQr
   ?(myCaregivers.length?'Recibe tus avisos de emergencia y tus mensajes. Tú decides qué más compartes.':'Vincula gratis a una persona de confianza para que reciba tus avisos.')
   :'Es gratis y no necesitas pagar ni registrar un teléfono. Un paciente Premium te vincula con su código.';
 const linkRow=(link:CareSnapshot['links'][number])=>{
  const mine=link.patientId===uid;
  const person=mine?(link.caregiverName??'Solicitud pendiente'):link.patientName;
  return <View key={link.id} style={[styles.linkRow,{borderColor:c.border,borderRadius:theme.radius.md}]} testID={`caregiver-link-${link.id}`}>
   <View style={styles.rowCenter}>
    <Avatar name={person} size={44} />
    <View style={styles.flex}>
     <AppText variant="bodyStrong" color="heading">{person}</AppText>
     <AppText variant="caption" color="textSecondary">{mine?'Tu cuidador/a':'Familiar al que cuidas'}</AppText>
    </View>
    <Badge label={link.accepted?'Activo':'Pendiente'} tone={link.accepted?'success':'warning'} size="sm" />
   </View>
   {!link.accepted&&mine?<>
    <InfoBanner tone="warning" title="Solicitud de cuidador/a" message={(link.caregiverName??'Esta persona')+' quiere vincularse contigo. No recibirá tus avisos ni datos hasta que aceptes.'}/>
    <PrimaryButton label="Aceptar como cuidador/a" disabled={busy} onPress={()=>void run(async()=>{await CaregiverService.approvePairing(link.id);setNotice((link.caregiverName??'La persona')+' ya está vinculada como tu cuidador/a.');})} />
    <SecondaryButton label="Rechazar solicitud" disabled={busy} onPress={()=>void run(async()=>{await CaregiverService.rejectPairing(link.id);setNotice('Solicitud rechazada. No se ha compartido ningún dato.');})} />
   </>:!link.accepted?(
    <InfoBanner tone="info" title="Esperando al paciente" message={link.patientName+' debe aceptar tu solicitud antes de que el perfil de cuidador/a quede activo.'}/>
   ):(
    <TextButton label={mine?'Desvincular cuidador/a':'Dejar esta vinculación'} tone="danger" icon="unlink-outline" disabled={busy} onPress={()=>void confirmDisconnect(link)} />
   )}
  </View>;
 };
 return <Screen header={<AppHeader title="Cuidador y avisos" />} keyboard scrollRef={scrollRef} contentStyle={{gap:compact?12:16,width:'100%'}} scrollProps={{contentInsetAdjustmentBehavior:'automatic'}} testID="caregiver-screen">
  {/* Cabecera: quién cuida de quién, de un vistazo */}
  <View style={[styles.hero,{backgroundColor:c.primary,borderRadius:theme.radius.xl}]} testID="caregiver-hero">
   <View style={styles.rowCenter}>
    <View style={styles.flex}>
     <AppText variant="heading" style={{color:'#FFFFFF'}}>{heroTitle}</AppText>
     <AppText variant="caption" style={{color:'rgba(255,255,255,0.9)'}}>{heroText}</AppText>
    </View>
    <View style={styles.heroArt}><GuideIllustration size={guideSize} halo={false} /></View>
   </View>
   <View style={styles.heroChips}>
    <View style={[styles.heroChip,{backgroundColor:'rgba(255,255,255,0.16)'}]}><Icon name={caregiverProfile?'heart':'shield-checkmark'} size={16} color="#FFFFFF" /><AppText variant="small" style={{color:'#FFFFFF'}}>{caregiverProfile?(entitlement.isPremium?'Cuidador/a + Premium':'Cuidador/a · gratis'):entitlement.isPremium?'Paciente Premium':'Sin vincular'}</AppText></View>
    <View style={[styles.heroChip,{backgroundColor:active.length?'#DC2626':'rgba(255,255,255,0.16)'}]}><Icon name={active.length?'alert-circle':'checkmark-circle'} size={16} color="#FFFFFF" /><AppText variant="small" style={{color:'#FFFFFF'}}>{active.length?`${active.length} aviso${active.length===1?'':'s'} activo${active.length===1?'':'s'}`:'Sin avisos activos'}</AppText></View>
   </View>
  </View>

  {session?.mode==='demo'?<InfoBanner tone="warning" title="Necesitas una cuenta real para vincular a otra persona." />:null}
  {error?<InfoBanner tone="danger" title={error} />:null}
  {notice?<InfoBanner tone="success" title={notice} />:null}

  {/* Lo más importante primero: el aviso activo y su chat */}
  {active.length>1?<View style={{gap:8}}>{active.map(i=><SecondaryButton key={i.id} label={(isDrillIncident(i.id)?'Abrir simulacro · ':'Abrir aviso · ')+new Date(i.created_at).toLocaleTimeString()} onPress={()=>{setSelected(i.id);setDraft('');requestKey.current=null;}} />)}</View>:null}
  {incident?<Card style={{gap:12,borderWidth:2,borderColor:inDrill?c.warning:c.danger}} testID={inDrill?'caregiver-drill-incident':'caregiver-incident'}>
   <View style={styles.rowCenter}>
    <View style={[styles.alertIcon,{backgroundColor:inDrill?c.warningSoft:c.dangerSoft}]}><Icon name={inDrill?'pulse':'alert-circle'} size={26} color={inDrill?c.warning:c.danger} /></View>
    <View style={styles.flex}>
     <AppText variant="subheading" color="heading">{inDrill?'Aviso de prueba':'Aviso activo'}</AppText>
     <AppText variant="caption" color="textSecondary">{new Date(incident.created_at).toLocaleString()}</AppText>
    </View>
   </View>
   {inDrill?<InfoBanner tone="warning" title="Simulacro" message="Así se ve un aviso real. No se ha avisado a nadie y nada sale de este teléfono." />:null}
   <Card tone="muted" padding={12}><AppText selectable>{incident.summary}</AppText></Card>
   <AppText variant="caption" color="textSecondary">Información comunicada por el paciente; no es un diagnóstico ni confirmación clínica.</AppText>
   <View style={styles.statusLine}><Icon name={incident.members?.some(m=>m.acknowledgedAt)?'checkmark-done-circle':incident.members?.some(m=>m.receivedAt)?'eye':'time'} size={20} color={incident.members?.some(m=>m.acknowledgedAt)?c.successStrong:c.warning} /><AppText style={styles.flex}>{incident.members?.some(m=>m.acknowledgedAt)?'El cuidador ha confirmado que está atendiendo el aviso.':incident.members?.some(m=>m.receivedAt)?'Aviso abierto por el cuidador; atención aún sin confirmar.':'Pendiente de que el cuidador abra el aviso.'}</AppText></View>
   <AppText variant="caption" color="textSecondary">{inDrill?'Simulacro: no se ha enviado ninguna notificación.':notificationDescription(incident.notificationState)}</AppText>
   {caregiver&&!(inDrill&&incident.members?.some(m=>m.acknowledgedAt))?<PrimaryButton label="Estoy atendiendo este aviso" disabled={busy} onPress={()=>inDrill?drill?.acknowledge():void run(()=>CaregiverService.acknowledge(incident.id))} testID="caregiver-acknowledge" />:null}
   {inDrill?<AppText variant="caption" color="textSecondary">En un aviso real verías aquí la ubicación del paciente, si la ha permitido. En el simulacro no se comparte ninguna ubicación.</AppText>:incident.latitude!==null&&incident.longitude!==null?<>
    <AppText>Ubicación {locationFresh(incident.location_at)?'reciente':'sin actualización reciente'} · {incident.location_at?new Date(incident.location_at).toLocaleTimeString():''} · precisión aproximada {Math.round(incident.accuracy??999)} m</AppText>
    <SecondaryButton label="Ver ubicación en el mapa" icon="map-outline" onPress={()=>void Linking.openURL('https://maps.google.com/?q='+incident.latitude+','+incident.longitude).catch(()=>setError('No se ha podido abrir el mapa.'))} />
   </>:<AppText variant="caption" color="textSecondary">Ubicación no disponible o no autorizada.</AppText>}
   {inDrill?null:<AppText variant="caption" color="textSecondary">La ubicación se actualiza mientras el paciente mantiene MediClaro abierta. Si está bloqueada, sin conexión o sin permiso, se mostrará la última actualización.</AppText>}
   {inDrill?<AppText variant="caption" color="textSecondary">En un aviso real también podéis hablar con una llamada de voz por internet desde aquí.</AppText>
    // Llamada de voz como en WhatsApp (pantalla de llamada) si el chat está activo en el servidor; si no, la de antes.
    :uid&&incidentCalls.length?<View style={{gap:8}} testID="caregiver-incident-calls">{incidentCalls.map(cv=><PrimaryButton key={cv.linkId} label={`Llamar a ${cv.otherName.split(' ')[0]}`} icon="call" onPress={()=>router.push({pathname:'/caregiver-call',params:{link:cv.linkId}})} testID={`caregiver-incident-call-${cv.linkId}`} />)}</View>
    :uid&&!chatReady&&autoCall?<AppText variant="caption" color="textSecondary">Preparando la llamada…</AppText>
    :uid?<CaregiverAudioCall
    key={incident.id}
    incidentId={incident.id}
    uid={uid}
    recipients={caregiver?[{id:incident.patient_id,name:'paciente'}]:(data?.links??[]).filter(l=>l.accepted&&l.patientId===uid&&l.caregiverId).map(l=>({id:l.caregiverId!,name:l.caregiverName??'cuidador/a'}))}
    autoStartRecipientId={!caregiver&&autoCall&&incident.id===requestedIncident?(data?.links??[]).find(l=>l.accepted&&l.patientId===uid&&l.caregiverId)?.caregiverId:null}
   />:null}
   <View style={[styles.incidentThread,{backgroundColor:c.background,borderColor:c.border,borderRadius:theme.radius.lg}]} accessibilityLabel="Mensajes del aviso">
    <AppText variant="captionStrong" color="textSecondary" style={styles.upper}>Mensajes del aviso</AppText>
    {incident.messages.length?incident.messages.map((m,i)=>{const own=m.sender_id===uid;const prev=incident.messages[i-1];const next=incident.messages[i+1];return <ChatBubble
     key={m.id}
     text={m.content}
     mine={own}
     time={chatTime(m.created_at)}
     senderName={own?'Tú':m.sender_id===incident.patient_id?'Paciente':'Cuidador/a'}
     firstInGroup={!prev||prev.sender_id!==m.sender_id}
     lastInGroup={!next||next.sender_id!==m.sender_id}
     highlight={m.response_due_at&&!m.responded_at?(m.escalated_at?'Sin respuesta: aviso de atención generado.':'Respuesta pendiente (plazo de un minuto).'):undefined}
     testID="caregiver-incident-message"
    />;}):<AppText variant="caption" color="textSecondary" align="center">Aún no hay mensajes. Escribe para que {caregiver?'tu familiar':'tu cuidador/a'} sepa cómo estás.</AppText>}
   </View>
   <ChatComposer value={draft} onChangeText={t=>{setDraft(t);requestKey.current=null;}} onSend={()=>inDrill?void send(false):void run(()=>send(false))} placeholder="Escribe sobre este aviso…" disabled={busy} maxLength={2000} testID="caregiver-incident-chat" />
   {caregiver?<SecondaryButton label="Enviar y pedir respuesta en 1 minuto" icon="timer-outline" disabled={busy||!draft.trim()} onPress={()=>inDrill?void send(true):void run(()=>send(true))} testID="caregiver-send-checkin" />:null}
   <SecondaryButton label="Llamar al 112 si lo considero necesario" icon="call" onPress={()=>inDrill?void showAlert('Simulacro','En el simulacro no se llama a nadie. En un aviso real, este botón abre el teléfono para llamar al 112.'):void callNumberOrExplain('112','112')} />
   {inDrill?<SecondaryButton label="Terminar simulacro" icon="stop-circle-outline" onPress={endDrill} testID="caregiver-drill-end" />
    :!caregiver?<SecondaryButton label="Cerrar aviso y dejar de compartir ubicación" disabled={busy} onPress={()=>void run(()=>CaregiverService.close(incident.id))} />:null}
  </Card>:<View style={[styles.calm,{backgroundColor:c.successSoft,borderRadius:theme.radius.lg}]} testID="caregiver-calm">
   <Icon name="checkmark-circle" size={24} color={c.successStrong} />
   <View style={styles.flex}>
    <AppText variant="bodyStrong" color="heading">Todo tranquilo</AppText>
    <AppText variant="caption" color="textSecondary">{caregiverProfile?'No hay avisos activos. Si tu familiar pide ayuda, te llegará aquí un aviso de emergencia.':canCreatePatientQr?'No hay avisos activos. Si pides ayuda, tu cuidador/a recibirá un aviso de emergencia con tu ubicación.':'No hay avisos activos.'}</AppText>
   </View>
  </View>}

  {/* Chat del día a día: lo que escribe una persona lo ve la otra al momento, con «Visto» */}
  {chatSummary.conversations.length?<View style={{gap:compact?12:16}} testID="caregiver-chats">
   {chatSummary.conversations.map(conv=><CareChatCard key={conv.linkId} conversation={conv} myId={uid??null} onOpen={()=>router.push({pathname:'/caregiver-chat',params:{link:conv.linkId}})} onCall={()=>router.push({pathname:'/caregiver-call',params:{link:conv.linkId}})} />)}
  </View>:CareChatService.isAvailable()?<CareChatPlaceholder
   caregiverSide={caregiverOnboarding}
   onLink={()=>scrollRef.current?.scrollTo({y:Math.max(0,linkingY.current-12),animated:true})}
  />:null}

  {/* Cómo funciona: siete pasos con dibujo y la voz grabada de MediClaro (Sulafat) */}
  <CareHowItWorks caregiverSide={caregiverOnboarding} />

  {/* «Mis pastillas»: el cuidador ve las tomas de su familiar si el paciente lo permite */}
  {acceptedPatients.length?<Card style={{gap:10}} testID="caregiver-pills">
   <View style={styles.rowCenter}>
    <View style={[styles.alertIcon,{backgroundColor:c.primaryTint}]}><Icon name="alarm" size={24} color={c.primary} /></View>
    <View style={styles.flex}>
     <AppText variant="subheading" color="heading">Sus pastillas</AppText>
     <AppText variant="caption" color="textSecondary">Tomas de hoy, pendientes, confirmadas e incidencias (si te lo permite).</AppText>
    </View>
   </View>
   {acceptedPatients.map(l=><PrimaryButton key={l.id} label={`Ver las pastillas de ${l.patientName.split(' ')[0]}`} icon="medkit-outline" onPress={()=>router.push({pathname:'/pills/patient',params:{id:l.patientId,name:l.patientName}})} testID={`caregiver-pills-${l.id}`} />)}
  </Card>:null}
  {!caregiverProfile&&myCaregivers.length?<Card style={{gap:8}} testID="caregiver-pills-permissions">
   <View style={styles.rowCenter}>
    <View style={[styles.alertIcon,{backgroundColor:c.primaryTint}]}><Icon name="alarm" size={24} color={c.primary} /></View>
    <View style={styles.flex}>
     <AppText variant="subheading" color="heading">Mis pastillas y tu cuidador/a</AppText>
     <AppText variant="caption" color="textSecondary">Tú decides si puede ver tus tomas, confirmarlas por ti o recibir un aviso si no confirmas una.</AppText>
    </View>
   </View>
   <SecondaryButton label="Elegir qué comparto" icon="options-outline" onPress={()=>router.push('/pills/settings')} />
  </Card>:null}

  {/* Vinculación */}
  <View onLayout={e=>{linkingY.current=e.nativeEvent.layout.y;}}>
  <Card style={{gap:12}} testID="caregiver-linking">
   {caregiverOnboarding?<>
    <View style={styles.rowCenter}>
     <View style={[styles.alertIcon,{backgroundColor:c.primaryTint}]}><Icon name="link" size={24} color={c.primary} /></View>
     <View style={styles.flex}>
      <AppText variant="subheading" color="heading" accessibilityRole="header">{caregiverProfile&&patientLabel?'Vincular a otro familiar':'Vincularme como cuidador/a'}</AppText>
      <AppText variant="caption" color="textSecondary">Es gratis. Solo hace falta el código de 6 números (o el QR) de la persona a la que vas a cuidar.</AppText>
     </View>
    </View>
    <View style={[styles.linkArt,{backgroundColor:c.primaryTint,borderRadius:theme.radius.lg}]} accessible accessibilityLabel="Dibujo: su código de 6 números o su QR, tu solicitud y su aceptación">
     <View style={styles.codeRow}>{['4','8','2','9','1','3'].map((d,i)=><View key={i} style={[styles.codeBoxSmall,{borderColor:c.primarySoft,backgroundColor:c.surface}]}><AppText variant="bodyStrong" color="heading">{d}</AppText></View>)}</View>
     <View style={styles.linkFlow}>
      <View style={[styles.flowIcon,{backgroundColor:c.surface}]}><Icon name="qr-code" size={22} color={c.primary} /></View>
      <Icon name="arrow-forward" size={20} color={c.textMuted} />
      <View style={[styles.flowIcon,{backgroundColor:c.surface}]}><Icon name="paper-plane" size={22} color={c.primary} /></View>
      <Icon name="arrow-forward" size={20} color={c.textMuted} />
      <View style={[styles.flowIcon,{backgroundColor:c.successSoft}]}><Icon name="checkmark-circle" size={22} color={c.successStrong} /></View>
     </View>
    </View>
    <View style={{gap:10}}>
     {['Escribe el código de 6 números del paciente o escanea su QR.','El paciente recibe tu solicitud y decide si acepta.','Solo después de aceptar recibirás sus avisos y mensajes.'].map((text,i)=><View key={text} style={styles.rowCenter}>
      <View style={[styles.step,{backgroundColor:c.primary}]}><AppText variant="label" style={{color:'#FFFFFF'}}>{String(i+1)}</AppText></View>
      <AppText style={styles.flex}>{text}</AppText>
     </View>)}
    </View>
    {input(name,setName,'Tu nombre para la solicitud',80)}
    <TextInput accessibilityLabel="Código de 6 números" placeholder="Código de 6 números" value={code} onChangeText={v=>setCode(v.replace(/\D/g,'').slice(0,6))} keyboardType="number-pad" maxLength={6} style={[styles.input,{color:theme.colors.text,borderColor:theme.colors.textSecondary,textAlign:'center'},code?{fontSize:24,letterSpacing:6}:{fontSize:18,letterSpacing:0}]} />
    <SecondaryButton label="Escanear QR del paciente" icon="qr-code-outline" onPress={()=>setScanning(true)} disabled={busy} testID="caregiver-scan-qr" />
    {scanning?<CareInviteScanner onCode={value=>{const six=parseCarePairCode(value);if(six)setCode(six);setScanning(false);setNotice(six?'QR leído. Revisa el código y envía la solicitud.':'Este QR pertenece al sistema anterior. Usa el código de 6 números del paciente.');}} onCancel={()=>setScanning(false)}/>:null}
    <PrimaryButton label="Enviar solicitud al paciente" icon="paper-plane" disabled={busy||!name.trim()||!parseCarePairCode(code)} onPress={()=>void run(async()=>{const result=await CaregiverService.requestByCode(code,name.trim());setNotice(result.status==='accepted'?'Ya estás vinculado/a como cuidador/a de '+result.patientName+'.':'Solicitud enviada a '+result.patientName+'. Esperando su aceptación.');})} testID="caregiver-confirm-link" />
    <AppText variant="caption" color="textSecondary">Al enviarla, el paciente recibirá una solicitud y tendrá que aceptarla. Hasta entonces no se compartirán avisos ni datos.</AppText>
   </>:<>
    <View style={styles.rowCenter}>
     <View style={[styles.alertIcon,{backgroundColor:c.primaryTint}]}><Icon name="link" size={24} color={c.primary} /></View>
     <View style={styles.flex}>
      <AppText variant="subheading" color="heading" accessibilityRole="header">Vincular a mi cuidador/a</AppText>
      <AppText variant="caption" color="textSecondary">Dale tu código de 6 números o enséñale el QR. Las dos formas sirven igual.</AppText>
     </View>
    </View>
    {patientCode?<>
     <View style={styles.codeRow} accessible accessibilityLabel={`Tu código: ${patientCode.split('').join(' ')}`} testID="caregiver-code">
      {patientCode.split('').map((d,i)=><View key={i} style={[styles.codeBox,{borderColor:c.primarySoft,backgroundColor:c.primaryTint,borderRadius:theme.radius.sm}]}><AppText variant="title" color="heading">{d}</AppText></View>)}
     </View>
     <View style={{alignItems:'center',gap:10}}>
      <View style={{backgroundColor:'#FFFFFF',padding:12,borderRadius:16,borderWidth:1,borderColor:c.border}} accessible accessibilityLabel="QR opcional para vinculación"><QRCode value={carePairQr(patientCode)} size={qrSize} quietZone={8} /></View>
     </View>
     <SecondaryButton label="Compartir código" icon="share-outline" onPress={()=>void Share.share({message:'Mi código de MediClaro es '+patientCode+'. También puedes abrir MediClaro y escribirlo manualmente para solicitar ser mi cuidador/a.'})} />
    </>:<InfoBanner tone="warning" message="No se ha podido cargar tu código todavía. Pulsa Actualizar."/>}
    <InfoBanner tone="info" title="Tú decides" message="Cuando alguien introduzca tu código recibirás una solicitud. Tendrás que aceptarla expresamente antes de que esa persona pueda recibir avisos o datos."/>
   </>}
   {pendingRequests.length||myLinks.length?<View style={{gap:10}}>
    <AppText variant="captionStrong" color="textSecondary" style={styles.upper}>Vinculaciones</AppText>
    {myLinks.map(linkRow)}
   </View>:null}
  </Card>
  </View>

  {/* Practicar sin riesgo */}
  <Card style={{gap:10}} testID="caregiver-drill">
   <View style={styles.rowCenter}>
    <View style={[styles.alertIcon,{backgroundColor:c.warningSoft}]}><Icon name="pulse" size={24} color={c.warning} /></View>
    <View style={styles.flex}>
     <AppText variant="subheading" color="heading">Practicar sin riesgo</AppText>
     <AppText variant="caption" color="textSecondary">
      {realActive.length
       ?'Hay un aviso real activo: atiéndelo antes de hacer una prueba.'
       :caregiverProfile
        ?'Simulacro: verás cómo te llega el aviso de tu familiar, cómo lo atiendes y el chat, como en una emergencia real. No se avisa a nadie.'
        :'Simulacro: verás cómo se envía tu aviso, cómo lo abre y lo atiende tu cuidador/a y el chat, como en una emergencia real. No se avisa a nadie.'}
     </AppText>
    </View>
   </View>
   <PrimaryButton
    label={drill?'Simulacro en marcha':'Probar la emergencia completa'}
    icon="pulse-outline"
    onPress={startDrill}
    disabled={!!drill||realActive.length>0}
    testID="caregiver-drill-start"
   />
  </Card>

  {/* En este móvil */}
  <Card style={{gap:10}} testID="caregiver-device">
   <AppText variant="subheading" color="heading" accessibilityRole="header">En este móvil</AppText>
   {caregiverProfile?<>
    <SecondaryButton label="Activar avisos en este móvil" icon="notifications-outline" onPress={()=>void run(activateNotifications)} disabled={busy} testID="caregiver-enable-notifications" />
    <SecondaryButton label="Probar sonido del aviso" icon="volume-high-outline" onPress={()=>void run(testCaregiverSound)} disabled={busy} testID="caregiver-test-sound" />
    <AppText variant="caption" color="textSecondary">Sonido sujeto a los ajustes del teléfono. Alertas críticas pendientes de autorización Apple. Necesita conexión y notificaciones permitidas.</AppText>
    <SecondaryButton label={entitlement.isPremium?'Ver mi Premium':'Añadir Premium para mi propio uso'} icon="ribbon-outline" onPress={()=>router.push('/premium')} testID="caregiver-own-premium" />
    <AppText variant="caption" color="textSecondary">Ser cuidador/a es gratis. Premium es opcional y solo añade IA, identificación y funciones avanzadas para ti.</AppText>
   </>:canCreatePatientQr?<>
    <SecondaryButton label="Activar avisos de vinculación" icon="notifications-outline" onPress={()=>void run(activateNotifications)} disabled={busy} testID="patient-enable-link-notifications" />
   </>:<>
    <AppText variant="caption" color="textSecondary">También puedes ser Cuidador/a + Premium: seguirás siendo cuidador/a gratis y, si contratas Premium para ti, tendrás además IA, identificación y el resto de funciones Premium.</AppText>
   </>}
   <SecondaryButton label="Actualizar" icon="refresh" loading={busy} onPress={()=>void run(refresh)} />
  </Card>
  <AppText variant="small" color="textMuted" align="center" style={styles.thin}>Chat y avisos solo entre personas vinculadas. Ninguna notificación garantiza atención: en una urgencia, llama al 112.</AppText>
 </Screen>;
}
const styles=StyleSheet.create({
 input:{borderWidth:1,borderRadius:12,minHeight:52,padding:12},
 flex:{flex:1,minWidth:0},
 rowCenter:{flexDirection:'row',alignItems:'center',gap:12},
 hero:{padding:18,gap:14},
 heroArt:{marginRight:-6},
 linkArt:{padding:14,gap:12,alignItems:'center'},
 codeBoxSmall:{width:34,height:42,borderWidth:1.5,borderRadius:8,alignItems:'center',justifyContent:'center'},
 linkFlow:{flexDirection:'row',alignItems:'center',gap:8},
 flowIcon:{width:44,height:44,borderRadius:22,alignItems:'center',justifyContent:'center'},
 heroChips:{flexDirection:'row',flexWrap:'wrap',gap:8},
 heroChip:{flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:10,paddingVertical:6,borderRadius:999},
 alertIcon:{width:48,height:48,borderRadius:24,alignItems:'center',justifyContent:'center'},
 statusLine:{flexDirection:'row',alignItems:'center',gap:8},
 incidentThread:{borderWidth:1,padding:12,gap:2},
 calm:{flexDirection:'row',alignItems:'flex-start',gap:12,padding:14},
 step:{width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center'},
 codeRow:{flexDirection:'row',justifyContent:'center',gap:6},
 codeBox:{width:44,height:56,borderWidth:1.5,alignItems:'center',justifyContent:'center'},
 linkRow:{borderWidth:1,padding:12,gap:10},
 upper:{textTransform:'uppercase',letterSpacing:0.6},
 thin:{fontWeight:'400'},
});
