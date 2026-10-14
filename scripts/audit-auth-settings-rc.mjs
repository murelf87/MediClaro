import fs from 'node:fs';
const env=Object.fromEntries(fs.readFileSync('.env.qacheck','utf8').split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>{const i=l.indexOf('=');return[l.slice(0,i),l.slice(i+1).replace(/^['"]|['"]$/g,'')]}));
const response=await fetch(env.EXPO_PUBLIC_SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:env.EXPO_PUBLIC_SUPABASE_ANON_KEY},signal:AbortSignal.timeout(15000)});
console.log('AUTH_SETTINGS_HTTP='+response.status);
if(!response.ok)process.exit(1);
const s=await response.json();
console.log(JSON.stringify({phoneEnabled:s.external?.phone,anonymousEnabled:s.external?.anonymous,smsAutoconfirm:s.sms_autoconfirm,signupDisabled:s.disable_signup}));
console.log('Read-only configuration check; no SMS sent and no delivery confirmed.');
