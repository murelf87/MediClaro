import {useRef,useState} from 'react';
import {Linking,View} from 'react-native';
import {CameraView,useCameraPermissions} from 'expo-camera';
import {AppText,InfoBanner,SecondaryButton} from './index';
import {parseCareInvite,parseCarePairCode} from '../services/careInvite';
export function CareInviteScanner({onCode,onCancel}:{onCode:(code:string)=>void;onCancel:()=>void}){
 const [permission,requestPermission]=useCameraPermissions();const scanned=useRef(false),[error,setError]=useState('');
 return <View style={{gap:12}}>
  <AppText>Escanea el QR del paciente Premium. Se enviará una solicitud: el paciente tendrá que aceptarla antes de que el vínculo quede activo.</AppText>
  {permission?.granted?<CameraView style={{height:280,width:'100%'}} facing="back" barcodeScannerSettings={{barcodeTypes:['qr']}}
   onBarcodeScanned={({data})=>{if(scanned.current)return;const code=parseCarePairCode(data)??parseCareInvite(data);if(!code){setError('Este QR no es una vinculación válida de MediClaro.');return;}scanned.current=true;onCode(code);}}
   onMountError={()=>setError('No se ha podido abrir la cámara. Puedes introducir el código de 6 números manualmente.')}/>:<>
   <SecondaryButton label={permission?.canAskAgain===false?'Abrir ajustes de cámara':'Permitir cámara para el QR'} onPress={()=>{if(permission?.canAskAgain===false)void Linking.openSettings().catch(()=>setError('No se han podido abrir los ajustes.'));else void requestPermission().catch(()=>setError('No se ha podido solicitar permiso de cámara.'));}}/>
   <AppText>Si no das permiso, puedes escribir el código de vinculación.</AppText>
  </>}
  {error?<InfoBanner tone="warning" message={error}/>:null}
  <SecondaryButton label="Cerrar escáner" onPress={onCancel}/>
 </View>;
}
