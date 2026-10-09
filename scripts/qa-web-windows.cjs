// Windows visual QA: isolated copy, never modify production runtime for mocks.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), cp = require('node:child_process');
const root = process.cwd(), work = fs.mkdtempSync(path.join(os.tmpdir(),'mediclaro-ui-'));
for (const name of ['app','src','assets','plugins','package.json','package-lock.json','tsconfig.json','babel.config.js','metro.config.js','app.json']) {
 if(fs.existsSync(path.join(root,name))) fs.cpSync(path.join(root,name),path.join(work,name),{recursive:true});
}
fs.symlinkSync(path.join(root,'node_modules'),path.join(work,'node_modules'),'junction');
const patch = (name, edit) => {const p=path.join(work,name);fs.writeFileSync(p,edit(fs.readFileSync(p,'utf8')));};
patch('src/lib/supabase.ts',s=>s.replace(/\/\/ @qa-real-client-start[\s\S]*?\/\/ @qa-real-client-end/,
 "import { createDemoBackend, readQaScenario } from '../mocks/demoBackend';\nconst __qa = readQaScenario();\nconst realClient = createDemoBackend({scenario:__qa,startSignedIn:!__qa.has('signedout')}) as unknown as ReturnType<typeof createClient>;")
 .replace('export const isBackendConfigured =','export const isBackendConfigured = true || '));
patch('src/services/billing/index.ts',s=>s.replace(/\/\/ @qa-billing-start[\s\S]*?\/\/ @qa-billing-end/,'function simulated(): boolean { return true; }'));
patch('app.json',s=>{const a=JSON.parse(s);a.expo.platforms=['ios','android','web'];a.expo.web={bundler:'metro',output:'single'};return JSON.stringify(a,null,2)});
patch('src/services/CaregiverService.ts',s=>s.replace(/export const CaregiverService=\{[\s\S]*$/,"let qaRole:'patient'|'caregiver'='patient';\nexport const CaregiverService={snapshot:async()=>({role:qaRole,links:[],incidents:[]}),role:async(role:'patient'|'caregiver')=>{qaRole=role;},invite:async()=>({code:'12345678-1234-4321-9876-123456789abc',expiresAt:new Date().toISOString()}),accept:async()=>({}),revoke:async()=>({}),received:async()=>({}),acknowledge:async()=>({}),message:async()=>({}),close:async()=>({}),location:async()=>({}),start:async()=>({incidentId:'fixture',queued:false})};"));
const fixture = {generatedAt:new Date().toISOString(),days:30,page:0,kpis:{users:42,verified:12,newUsers:6,premium:10,pastDue:1,cancelled:1,scans:150,activeUsers:12,chats:99,errors:2,costEuro:0.024,saved:20,favorites:8,linkedCaregivers:4,activeIncidents:1,incidents:3,calls:2,pushPending:1},
 billing:[{provider:'apple',state:'ACTIVE',count:10}],daily:[{day:'2026-10-02',scans:20,chats:8,errors:1,cost:0.01}],
 notifications:[{state:'accepted',count:3}],activity:[{action:'data_exported',created_at:new Date().toISOString()}],
 accounts:Array.from({length:20},(_,i)=>({id:String(i),phone:'*** '+String(100+i),plan:'premium',state:'ACTIVE',provider:'apple',created_at:new Date().toISOString()}))};
fs.writeFileSync(path.join(work,'src/services/OwnerService.ts'),'export const OwnerService = {access:async()=>true,dashboard:async(days:number,page:number)=>('+JSON.stringify(fixture)+')};');
fs.writeFileSync(path.join(work,'app/layout-qa.tsx'), `import {useState} from 'react';import {View} from 'react-native';
import {AppHeader,AppText,PrimaryButton,SecondaryButton,TextButton,Screen} from '../src/components';
import {usePreferences} from '../src/hooks';
export default function Probe(){const [count,setCount]=useState(0);const {setFontSize}=usePreferences();return <Screen
 header={<AppHeader title="Mis medicamentos y contacto con la persona cuidadora" backLabel="Cancelar" right={<TextButton label="Guardar cambios" onPress={()=>setCount(v=>v+1)}/>}/>}>
 <View style={{gap:12}}><AppText>Acciones: {count}</AppText>
 <TextButton label="Texto muy grande" onPress={()=>void setFontSize('muy_grande')} testID="qa-large"/>
 <PrimaryButton label="Avisar a María de los Ángeles, mi cuidadora y contacto de emergencia" icon="people-outline" onPress={()=>setCount(v=>v+1)} testID="qa-primary"/>
 <SecondaryButton label="Compartir mi ubicación actual con la persona cuidadora" icon="location-outline" onPress={()=>setCount(v=>v+1)} testID="qa-secondary"/>
 <PrimaryButton label="Avisar a María de los Ángeles, mi cuidadora y contacto de emergencia" icon="people-outline" onPress={()=>{}} loading testID="qa-loading"/>
 <TextButton label="Volver al historial de todos mis medicamentos guardados y favoritos" icon="arrow-back" onPress={()=>setCount(v=>v+1)} testID="qa-text"/>
 </View></Screen>}`);
const env={...process.env,CI:'1',EXPO_PUBLIC_DEMO_ACCESS:'on',EXPO_PUBLIC_PAYMENTS_MODE:'store,stripe'};
if(fs.existsSync(path.join(root,'.env.qacheck'))) for(const l of fs.readFileSync(path.join(root,'.env.qacheck'),'utf8').split(/\r?\n/)) {
 const i=l.indexOf('=');const k=l.slice(0,i);if(['EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_ANON_KEY'].includes(k))env[k]=l.slice(i+1).replace(/^['"]|['"]$/g,'');
}
const out=path.join(root,'dist-ui-qa');
fs.writeFileSync(path.join(root,'.tmp-ui-work.txt'),work);
const res=cp.spawnSync('npx.cmd',['expo','export','--platform','web','--output-dir',out,'--max-workers','2','--clear'],{cwd:work,env,stdio:'inherit',shell:true});
console.log('VISUAL_QA_COPY='+work);process.exit(res.status||0);
