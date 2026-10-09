/**
 * Entrada de cuidador/a (gratis, sin teléfono ni SMS): crea la cuenta si hace falta, completa el perfil la primera
 * vez y abre «Cuidador y avisos». Se usa en la entrada de la app («Soy cuidador/a · gratis») y en «Cuidador y
 * avisos» cuando todavía no hay cuenta.
 * Los accesos de revisión interna por perfil (Paciente Premium / gratuito / cuidador) ya no existen en la app:
 * la entrada es la misma en todas las compilaciones (nota del propietario del 09/10, 21:08).
 */
import {useRef,useState} from 'react';
import {View} from 'react-native';
import {useRouter} from 'expo-router';
type Router=ReturnType<typeof useRouter>;
import {AppText,Card,InfoBanner,PrimaryButton} from './index';
import {AuthService} from '../services/AuthService';
import {ProfileService} from '../services/ProfileService';

/** Abre la entrada de cuidador/a: cuenta (si no la hay) → perfil (si está incompleto) → Cuidador y avisos. */
export async function openCaregiverEntry(router:Router):Promise<void>{
 await AuthService.ensureAccount();
 const profile=await ProfileService.getProfile();
 const incomplete=!profile.displayName||!profile.sex||profile.age===null;
 router.replace(incomplete?{pathname:'/profile-setup',params:{next:'/caregiver',mode:'caregiver'}}:'/caregiver');
}

export const CAREGIVER_ENTRY_ERROR='No se ha podido abrir la gestión de perfil. Comprueba la conexión y vuelve a intentarlo.';

export function ProfileChoice(){
 const router=useRouter();const running=useRef(false);
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const openProfileOptions=async()=>{
  if(running.current)return;running.current=true;setBusy(true);setError('');
  try{await openCaregiverEntry(router);}
  catch{setError(CAREGIVER_ENTRY_ERROR);}
  finally{running.current=false;setBusy(false);}
 };
 return <View style={{gap:12,width:'100%'}}>
  <Card style={{gap:8,width:'100%'}}>
   <PrimaryButton label="Elegir o cambiar mi perfil" icon="people-outline" onPress={()=>void openProfileOptions()} loading={busy} disabled={busy} testID="profile-manage"/>
   <AppText variant="caption">Tu acceso gratuito ya es tu perfil Básico. Desde aquí puedes vincularte como cuidador/a o gestionar tus vinculaciones. Ser cuidador/a es gratis y no requiere teléfono, SMS ni verificación telefónica.</AppText>
  </Card>
  {error?<InfoBanner tone="danger" message={error}/>:null}
 </View>;
}
