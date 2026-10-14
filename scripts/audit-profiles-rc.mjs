import fs from 'node:fs';import assert from 'node:assert/strict';import {createClient} from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('.env.qacheck','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const make=()=>createClient(env.EXPO_PUBLIC_SUPABASE_URL,env.EXPO_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const patient=make(),caregiver=make();let linkId;
const action=async(c,a,p={})=>{const r=await c.rpc('caregiver_action',{p_action:a,p_payload:p});assert(!r.error,r.error?.message);return r.data;};
try{
 for(const c of [patient,caregiver]){const auth=await c.auth.signInAnonymously();assert(!auth.error,auth.error?.message);}
 await action(patient,'role',{role:'patient'});await action(caregiver,'role',{role:'caregiver'});
 assert.equal((await action(patient,'snapshot')).role,'patient');assert.equal((await action(caregiver,'snapshot')).role,'caregiver');console.log('REAL_PROFILES_WITHOUT_PHONE=PASS');
 for(const c of [patient,caregiver]){const r=await c.rpc('get_account_status');assert(!r.error,r.error?.message);assert.equal(r.data.plan,'free');}console.log('CARE_ROLE_NEVER_GRANTS_PREMIUM=PASS');
 const invitation=await action(patient,'invite',{name:'QA RC2 usuario'});linkId=invitation.code;
 assert.equal((await action(caregiver,'snapshot')).links.length,0);console.log('QR_CREATION_DOES_NOT_AUTO_LINK=PASS');
 await action(caregiver,'accept',{code:linkId,name:'QA RC2 cuidador'});
 assert((await action(patient,'snapshot')).links.some(l=>l.accepted));assert((await action(caregiver,'snapshot')).links.some(l=>l.accepted));console.log('EXPLICIT_FREE_PAIRING=PASS');
 for(const c of [patient,caregiver]){const r=await c.rpc('get_account_status');assert.equal(r.data.plan,'free');}console.log('PAIRING_DOES_NOT_SHARE_PREMIUM=PASS');
 await action(caregiver,'role',{role:'patient'});const r=await caregiver.rpc('get_account_status');assert.equal(r.data.plan,'free');console.log('PROFILE_SWITCH_DOES_NOT_CHANGE_BILLING=PASS');
}finally{
 if(linkId)await action(patient,'revoke',{linkId}).catch(()=>{});
 for(const c of [patient,caregiver])await c.auth.signOut();
}
