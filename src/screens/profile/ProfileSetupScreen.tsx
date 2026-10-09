import {useEffect,useState} from 'react';
import {View,useWindowDimensions} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {useLocalSearchParams,useRouter,type Href} from 'expo-router';
import {AppHeader,AppText,Avatar,Card,Chip,InfoBanner,PrimaryButton,Screen,SecondaryButton,TextField} from '../../components';
import {useAppTheme,useAsync} from '../../hooks';
import {ProfileService} from '../../services';
import type {ProfileSex} from '../../types';

const SEX_OPTIONS:Array<{value:ProfileSex;label:string}>=[
 {value:'female',label:'Mujer'},
 {value:'male',label:'Hombre'},
 {value:'other',label:'Otro'},
 {value:'prefer_not_to_say',label:'Prefiero no decirlo'},
];

export default function ProfileSetupScreen(){
 const router=useRouter();
 const params=useLocalSearchParams<{next?:string|string[];mode?:string|string[]}>();
 const theme=useAppTheme();
 const {width}=useWindowDimensions();
 const compact=width<390;
 const profile=useAsync(()=>ProfileService.getProfile(),[]);
 const [name,setName]=useState(''),[sex,setSex]=useState<ProfileSex|null>(null),[age,setAge]=useState(''),[phone,setPhone]=useState('');
 const [photoUri,setPhotoUri]=useState<string|null>(null),[photoMime,setPhotoMime]=useState('image/jpeg');
 const [saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{if(!profile.data)return;setName(profile.data.displayName??'');setSex(profile.data.sex);setAge(profile.data.age===null?'':String(profile.data.age));setPhone(profile.data.contactPhone??'');},[profile.data?.id]);
 const nextRaw=Array.isArray(params.next)?params.next[0]:params.next;
 const modeRaw=Array.isArray(params.mode)?params.mode[0]:params.mode;
 const caregiverFlow=modeRaw==='caregiver'||nextRaw==='/caregiver';
 const next=(nextRaw||'/(tabs)') as Href;
 const pickPhoto=async()=>{
  setError('');
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsEditing:true,aspect:[1,1],quality:0.82,exif:false});
  if(result.canceled||!result.assets?.[0])return;
  setPhotoUri(result.assets[0].uri);setPhotoMime(result.assets[0].mimeType||'image/jpeg');
 };
 const save=async()=>{
  if(saving)return;
  const cleanName=name.trim().replace(/\s+/g,' ');
  const numericAge=Number(age);
  if(cleanName.length<2){setError('El nombre es obligatorio.');return;}
  if(!sex){setError('Indica tu sexo para completar el perfil.');return;}
  if(!Number.isInteger(numericAge)||numericAge<0||numericAge>120){setError('Escribe una edad válida.');return;}
  setSaving(true);setError('');
  try{
   await ProfileService.updateProfile(caregiverFlow?{displayName:cleanName,sex,age:numericAge}:{displayName:cleanName,sex,age:numericAge,contactPhone:phone.trim()||null});
   if(photoUri)await ProfileService.uploadAvatar(photoUri,photoMime);
   router.replace(next);
  }catch(e){setError((e as Error).message||'No se ha podido guardar el perfil.');}
  finally{setSaving(false);}
 };
 const currentUri=photoUri||profile.data?.avatarUrl||null;
 return <Screen keyboard header={<AppHeader title="Completa tu perfil" />} contentStyle={{gap:compact?12:16,width:'100%'}} scrollProps={{contentInsetAdjustmentBehavior:'automatic'}}>
  <InfoBanner tone="info" title="Tus datos básicos" message={caregiverFlow?"Para ser cuidador/a solo necesitamos nombre, sexo y edad. No pedimos teléfono, SMS ni verificación telefónica. Puedes añadir una foto para que el paciente te reconozca.":"Nombre, sexo y edad son necesarios para tu perfil. El teléfono es opcional en el perfil Básico. Puedes añadir una foto de perfil."}/>
  <Card style={{gap:14}}>
   <View style={{alignItems:'center',gap:10}}>
    <Avatar name={name} uri={currentUri} size={compact?80:96}/>
    <SecondaryButton label={currentUri?'Cambiar foto de perfil':'Añadir foto de perfil'} icon="camera-outline" onPress={()=>void pickPhoto()} disabled={saving}/>
   </View>
   <TextField label="Nombre *" value={name} onChangeText={setName} autoCapitalize="words" maxLength={60}/>
   <AppText variant="label">Sexo *</AppText>
   <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
    {SEX_OPTIONS.map(o=><Chip key={o.value} label={o.label} selected={sex===o.value} onPress={()=>setSex(o.value)}/>)}
   </View>
   <TextField label="Edad *" value={age} onChangeText={t=>setAge(t.replace(/\D/g,'').slice(0,3))} keyboardType="number-pad" maxLength={3}/>
   {!caregiverFlow?<TextField label="Teléfono (opcional)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" maxLength={20} hint="Puedes dejarlo vacío en el perfil Básico."/>:null}
   {error?<InfoBanner tone="danger" message={error}/>:null}
   <PrimaryButton label="Guardar y continuar" icon="checkmark" onPress={()=>void save()} loading={saving}/>
  </Card>
 </Screen>;
}
