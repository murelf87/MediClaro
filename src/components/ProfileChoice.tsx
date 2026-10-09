import {useRef,useState} from 'react';
import {View} from 'react-native';
import {useRouter} from 'expo-router';
import {AppText,Card,InfoBanner,PrimaryButton,SecondaryButton} from './index';
import {ProfileEntryService,type CareProfileRole} from '../services/ProfileEntryService';
import {DEMO_ACCESS_ENABLED} from '../config/app';
import {AuthService} from '../services/AuthService';
import {ProfileService} from '../services/ProfileService';
type ReviewMode='premium'|'free'|'caregiver';
export function ProfileChoice({review=false}:{review?:boolean}){
 const router=useRouter();const running=useRef(false);
 const [busy,setBusy]=useState<CareProfileRole|ReviewMode|null>(null),[error,setError]=useState('');
 const openProfileOptions=async()=>{
  if(running.current)return;running.current=true;setBusy('patient');setError('');
  try{
   await AuthService.ensureAccount();
   const profile=await ProfileService.getProfile();
   const incomplete=!profile.displayName||!profile.sex||profile.age===null;
   router.replace(incomplete
    ? {pathname:'/profile-setup',params:{next:'/caregiver',mode:'caregiver'}}
    : '/caregiver');
  }
  catch{setError('No se ha podido abrir la gestión de perfil. Comprueba la conexión y vuelve a intentarlo.');}
  finally{running.current=false;setBusy(null);}
 };
 const reviewAs=async(mode:ReviewMode)=>{
  if(running.current)return;running.current=true;setBusy(mode);setError('');
  try{
   if(mode==='premium'){
    await AuthService.enterWithoutVerification();
    router.replace(await ProfileEntryService.choose('patient'));
   }else{
    router.replace(await ProfileEntryService.choose(mode==='caregiver'?'caregiver':'patient'));
   }
  }catch{setError('No se ha podido preparar el perfil de revisión. Comprueba la conexión y vuelve a intentarlo.');}
  finally{running.current=false;setBusy(null);}
 };
 if(review&&DEMO_ACCESS_ENABLED)return <View style={{gap:12}}>
  <AppText variant="subheading" align="center">Probar MediClaro por perfil</AppText>
  <Card style={{gap:8}}>
   <PrimaryButton label="Paciente Premium" icon="diamond-outline" onPress={()=>void reviewAs('premium')} loading={busy==='premium'} disabled={!!busy} testID="review-premium-patient"/>
   <AppText variant="caption">Revisión interna de IA, medicamentos, voz y funciones Premium sin realizar un cobro.</AppText>
  </Card>
  <Card style={{gap:8}}>
   <SecondaryButton label="Paciente gratuito" icon="person-outline" onPress={()=>void reviewAs('free')} loading={busy==='free'} disabled={!!busy} testID="review-free-patient"/>
   <AppText variant="caption">Comprueba la experiencia gratuita y sus accesos a Premium.</AppText>
  </Card>
  <Card style={{gap:8}}>
   <SecondaryButton label="Cuidadora o cuidador" icon="people-outline" onPress={()=>void reviewAs('caregiver')} loading={busy==='caregiver'} disabled={!!busy} testID="review-caregiver"/>
   <AppText variant="caption">Comprueba vinculación, avisos, incidencias, ubicación, chat y audio.</AppText>
  </Card>
  <InfoBanner tone="info" message="Modo de revisión interno. Estos accesos no aparecen en la compilación de producción de App Store."/>
  {error?<InfoBanner tone="danger" message={error}/>:null}
 </View>;
 return <View style={{gap:12,width:'100%'}}>
  <Card style={{gap:8,width:'100%'}}>
   <PrimaryButton label="Elegir o cambiar mi perfil" icon="people-outline" onPress={()=>void openProfileOptions()} loading={busy==='patient'} disabled={!!busy} testID="profile-manage"/>
   <AppText variant="caption">Tu acceso gratuito ya es tu perfil Básico. Desde aquí puedes vincularte como cuidador/a o gestionar tus vinculaciones. Ser cuidador/a es gratis y no requiere teléfono, SMS ni verificación telefónica.</AppText>
  </Card>
  {error?<InfoBanner tone="danger" message={error}/>:null}
 </View>;
}
