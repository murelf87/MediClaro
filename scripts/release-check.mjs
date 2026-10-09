import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
let failures = 0;
let warnings = 0;
const ok = (m) => console.log(`[OK] ${m}`);
const fail = (m) => { failures++; console.log(`[FALLO] ${m}`); };
const warn = (m) => { warnings++; console.log(`[PENDIENTE] ${m}`); };
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

console.log('============================================================');
console.log('MEDICLARO - COMPROBACION DE RELEASE');
console.log('============================================================');

const required = [
  'src/screens/premium/WelcomeScreen.tsx',
  'src/screens/emergency/EmergencyPreparedScreen.tsx',
  'supabase/functions/identify-medicine/index.ts',
  'supabase/functions/medicine-detail/index.ts',
  'supabase/functions/chat/index.ts',
  'supabase/functions/iap-verify/index.ts',
  'supabase/functions/apple-store-notifications/index.ts',
  'supabase/functions/google-play-notifications/index.ts',
  'supabase/functions/cleanup-anonymous/index.ts',
  'supabase/functions/_shared/providers/cima.ts',
  'supabase/functions/_shared/providers/us.ts',
  'supabase/functions/_shared/storeBilling.ts',
  'supabase/migrations/20260929090400_v6_store_billing_premium_only.sql',
];
for (const f of required) exists(f) ? ok(f) : fail(`Falta ${f}`);

try {
  const eas = JSON.parse(read('eas.json'));
  eas?.build?.production?.env?.EXPO_PUBLIC_DEMO_ACCESS === 'off' ? ok('Produccion sin acceso de demostracion') : fail('EXPO_PUBLIC_DEMO_ACCESS production debe ser off');
  eas?.build?.production?.env?.EXPO_PUBLIC_PAYMENTS_MODE === 'store' ? ok('Produccion movil usa solo la tienda') : fail('EXPO_PUBLIC_PAYMENTS_MODE production debe ser store');
} catch { fail('eas.json no es JSON valido'); }

const identify = read('supabase/functions/identify-medicine/index.ts');
identify.includes('requirePremium(user.id)') ? ok('Identificacion exige Premium en servidor') : fail('Falta bloqueo Premium servidor en identify-medicine');
identify.includes('providerFor(entitlement.country)') ? ok('Proveedor farmacologico separado por pais') : fail('Identificacion no selecciona proveedor por pais');
identify.includes('cnFromBarcode') ? ok('Ruta CN/codigo evita Gemini cuando hay identificador') : fail('Falta ruta de codigo nacional');

const cima = read('supabase/functions/_shared/providers/cima.ts');
cima.includes('/medicamento?cn=') && cima.includes('/docSegmentado/contenido/2') ? ok('CIMA/AEMPS conectado a medicamento y prospecto oficial') : fail('Proveedor CIMA incompleto');
cima.includes('Array.isArray(raw)') ? ok('Respuesta segmentada de CIMA tratada como lista') : fail('Prospecto CIMA no trata la lista de secciones');

const billing = read('supabase/functions/_shared/storeBilling.ts');
const appleVerified = billing.includes('SignedDataVerifier') && billing.includes('verifyAndDecodeTransaction');
const googleVerified = billing.includes('purchases/subscriptionsv2') && billing.includes('androidpublisher.googleapis.com');
appleVerified && googleVerified ? ok('Verificacion servidor-servidor Apple + Google presente') : fail('Verificacion de tienda incompleta');

const emergency = read('src/screens/emergency/EmergencyPreparedScreen.tsx');
for (const token of ['Coordenadas:', 'Precisión:', 'Actualizada a las', 'Leer ubicación en voz alta']) {
  emergency.includes(token) ? ok(`Emergencia muestra: ${token}`) : fail(`Emergencia no muestra: ${token}`);
}

const migration = read('supabase/migrations/20260929090400_v6_store_billing_premium_only.sql');
migration.includes("where plan = 'free'") && migration.includes('monthly_scans = 0') ? ok('Cuota IA gratuita desactivada en servidor') : fail('R-24 no aplicado en migracion');
migration.includes("'storeVerification', false") ? warn('storeVerification=false: correcto hasta desplegar/configurar/probar Sandbox; activarlo despues') : fail('Falta red de seguridad storeVerification=false');

// Foto de homenaje de la entrada: sin fotos, la versión de las tiendas no muestra el hueco (no falla, solo avisa).
// Sin comentarios: el ejemplo de la cabecera no cuenta como foto puesta.
const homenaje = read('src/content/homenaje.ts').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
/fotos:\s*\[\s*\]/.test(homenaje) ? warn('Foto de homenaje de la entrada sin poner: src/content/homenaje.ts (sin fotos, la entrada sale como siempre)') : ok('Foto de homenaje de la entrada puesta');
for (const m of homenaje.matchAll(/require\('\.\.\/\.\.\/(assets\/images\/homenaje\/[^']+)'\)/g)) {
  exists(m[1]) ? ok(`Foto de homenaje: ${m[1]}`) : fail(`Falta la foto de homenaje ${m[1]}`);
}

// Panel del propietario: migración, Face ID declarado y sin canje de códigos dentro de la app (Apple 3.1.1).
exists('supabase/migrations/20261009170000_owner_admin_panel.sql') ? ok('Panel del propietario: migración presente') : fail('Falta la migración del panel del propietario');
exists('supabase/migrations/20261009191000_owner_phones_antonio_marina.sql') ? ok('Propietarios: solo Antonio y Marina (migración presente)') : fail('Falta la migración de los teléfonos de propietario');
exists('supabase/migrations/20261009190000_care_chat_window.sql') ? ok('Chat con el cuidador/a: lo enciende la persona cuidada (migración presente)') : fail('Falta la migración de la ventana del chat');
/NSFaceIDUsageDescription/.test(read('app.json')) ? ok('Face ID declarado (panel del propietario)') : fail('Falta NSFaceIDUsageDescription en app.json');
/redeem|canjear/i.test(read('src/services/OwnerAdminService.ts')) ? fail('El panel no debe canjear códigos dentro de la app') : ok('Bonos aplicados desde el panel, sin códigos que escribir en la app');

if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) warn('Variables publicas de Supabase no presentes en esta consola; configurarlas en EAS/entorno de build');

if (exists('node_modules/.bin/tsc')) {
  const r = process.platform === 'win32'
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', 'npm run typecheck'], { cwd: root, stdio: 'inherit' })
    : spawnSync('npm', ['run', 'typecheck'], { cwd: root, stdio: 'inherit' });
  r.status === 0 ? ok('Typecheck completo') : fail('Typecheck completo');
} else warn('node_modules no instalado: ejecuta npm ci para poder hacer typecheck/tests completos');

console.log('------------------------------------------------------------');
console.log(`FALLOS=${failures}  PENDIENTES_CONFIGURACION=${warnings}`);
if (failures === 0) console.log('CODIGO_RELEASE_CHECK=OK (los PENDIENTES requieren configuracion externa, no son funciones simuladas)');
process.exitCode = failures ? 1 : 0;
