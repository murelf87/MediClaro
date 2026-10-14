import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'});
const paths=git('ls-files','supabase/functions/identify-medicine','supabase/functions/_shared/providers','src/screens/identify').trim().split(/\r?\n/).filter(p=>p&&!p.endsWith('VoiceScreen.tsx'));
let failures=0;
for(const file of paths){const before=git('show','HEAD:'+file).replace(/\r\n/g,'\n');const now=fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n');if(before!==now){console.log('CHANGED '+file);failures++;}}
const before=git('show','HEAD:src/services/MedicationService.ts');const now=fs.readFileSync('src/services/MedicationService.ts','utf8');
const identify=s=>s.slice(s.indexOf('  async identifyMedication('),s.indexOf('  async searchMedication(')).replace(/\r\n/g,'\n');
if(identify(before)!==identify(now))failures++;
console.log(JSON.stringify({protectedFiles:paths.length,photoLogicUnchanged:failures===0,sha256:createHash('sha256').update(identify(now)).digest('hex')}));
process.exitCode=failures?1:0;
