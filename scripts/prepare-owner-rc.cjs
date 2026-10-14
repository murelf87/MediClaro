const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.version='1.0.1';fs.writeFileSync('package.json',JSON.stringify(p,null,2)+'\n');const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));lock.version='1.0.1';if(lock.packages?.[''])lock.packages[''].version='1.0.1';fs.writeFileSync('package-lock.json',JSON.stringify(lock,null,2)+'\n');
const eas=JSON.parse(fs.readFileSync('eas.json','utf8'));
for(const line of fs.readFileSync('.env.qacheck','utf8').split(/\r?\n/)){const i=line.indexOf('=');const k=line.slice(0,i);if(['EXPO_PUBLIC_APP_STORE_ID','EXPO_PUBLIC_PRIVACY_URL','EXPO_PUBLIC_OTP_TTL_SECONDS'].includes(k))eas.build.production.env[k]=line.slice(i+1).replace(/^['"]|['"]$/g,'');}
fs.writeFileSync('eas.json',JSON.stringify(eas,null,2)+'\n');
console.log('RC_VERSION=1.0.1-rc.1');
