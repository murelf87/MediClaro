const baseCss = `
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:820px;margin:0 auto;padding:32px 22px;color:#172033;line-height:1.6}
h1,h2{color:#0f4c81} h1{font-size:2rem} h2{margin-top:2rem;font-size:1.25rem}
.card{background:#f6f9fc;border:1px solid #dce7f0;border-radius:16px;padding:18px;margin:18px 0}
small{color:#667085} a{color:#0f6cbd}
`;
function page(title: string, body: string) {
  return new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · MediClaro</title><style>${baseCss}</style></head><body><h1>${title}</h1>${body}<p><small>Última actualización: 30 de septiembre de 2026 · MediClaro 1.0</small></p></body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' },
  });
}
const privacy = `
<div class="card"><strong>MediClaro</strong> explica información oficial sobre medicamentos con lenguaje sencillo. No sustituye a un médico o farmacéutico.</div>
<h2>Datos que tratamos</h2>
<p>Cuando utilizas una cuenta podemos tratar tu número de teléfono, medicamentos guardados, historial de identificaciones, ajustes de accesibilidad y el perfil de emergencia que decidas crear.</p>
<h2>Fotos e inteligencia artificial</h2>
<p>Las fotos de cajas se utilizan para identificar el medicamento y MediClaro no las conserva como archivo. Antes de enviar una foto o una pregunta a Google Gemini solicitamos tu consentimiento. Se envía el contenido necesario para prestar la función, no tu nombre ni tu número de teléfono.</p>
`;
const privacy2 = `
<h2>Ubicación y permisos</h2>
<p>La ubicación se solicita cuando utilizas funciones de emergencia. La cámara y la fototeca solo se usan cuando eliges expresamente hacer o seleccionar una imagen.</p>
<h2>Pagos</h2>
<p>Las suscripciones digitales en iPhone se gestionan mediante Apple. MediClaro no recibe los datos completos de tu medio de pago.</p>
<h2>Tus derechos y control</h2>
<p>Desde la app puedes revisar permisos, retirar el consentimiento de IA, descargar tus datos y solicitar la eliminación de tu cuenta. También puedes gestionar los permisos desde los ajustes del teléfono.</p>
<h2>Seguridad y finalidad</h2>
<p>Tratamos los datos únicamente para prestar MediClaro, mantener la cuenta, ofrecer las funciones solicitadas, prevenir abusos y cumplir obligaciones legales. Aplicamos controles de acceso y minimización de datos.</p>
<h2>Contacto</h2>
<p>Para cuestiones de privacidad o soporte utiliza la sección <strong>Perfil → Ayuda y soporte</strong> de MediClaro.</p>
`;
const support = `
<div class="card"><strong>Soporte de MediClaro</strong><br>Ayuda para instalación, acceso, suscripción, identificación de medicamentos, accesibilidad y emergencias.</div>
<h2>Desde la aplicación</h2>
<p>Abre <strong>Perfil → Ayuda y soporte</strong>. Allí encontrarás las opciones disponibles para tu versión y podrás consultar también Privacidad y datos.</p>
<h2>Problemas con una suscripción</h2>
<p>En iPhone puedes revisar o cancelar una suscripción desde Ajustes → tu nombre → Suscripciones. Eliminar la app no cancela una suscripción activa.</p>
<h2>Información médica</h2>
<p>MediClaro no sustituye a profesionales sanitarios. Ante dudas sobre un tratamiento consulta a tu médico o farmacéutico. En una urgencia en España, llama al 112.</p>
`;
Deno.serve((req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const which = new URL(req.url).searchParams.get('page') ?? 'support';
  if (which === 'privacy') return page('Política de privacidad', privacy + privacy2);
  return page('Ayuda y soporte', support);
});
