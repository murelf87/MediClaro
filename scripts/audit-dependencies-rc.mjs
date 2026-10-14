import { execFileSync } from 'node:child_process';
let raw;
try{raw=execFileSync('cmd.exe',['/d','/s','/c','npm audit --omit=dev --json'],{encoding:'utf8'});}catch(e){raw=e.stdout;}
const d=JSON.parse(raw);console.log(JSON.stringify({productionVulnerabilities:d.metadata?.vulnerabilities,packages:Object.entries(d.vulnerabilities??{}).map(([name,v])=>({name,severity:v.severity,fixAvailable:v.fixAvailable}))},null,2));
