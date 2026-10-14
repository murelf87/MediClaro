// PROPUESTA R-20 (NO APLICADA) · Una sola política de privacidad.
//
// Problema que resuelve: había DOS políticas de privacidad distintas circulando a la vez.
//   · La de la web (docs/privacidad.html en GitHub Pages), generada desde src/content/legal.ts, que es la
//     que se mantiene al día y la que se declara en App Store Connect y en Play Console.
//   · La que servía esta función, escrita a mano y congelada en «30 de septiembre de 2026», que era justo la
//     que abría la app de producción: EXPO_PUBLIC_PRIVACY_URL apuntaba aquí.
// Dos textos distintos sobre los mismos datos es un problema por sí mismo, y el que leía la gente era el
// viejo: no mencionaba «Mis pastillas», ni el cuidador/a, ni Bizum, ni los avisos, ni el panel del titular.
//
// Qué hace esta versión: deja de tener texto propio y redirige a la web, que pasa a ser el único documento
// fuente. Así, las personas que tengan instalada una versión anterior de la app (con la dirección antigua
// incrustada en la compilación) acaban leyendo exactamente el mismo texto que la web y que la app nueva.
//
// Para desplegarla hacen falta las dos cosas, en este orden:
//   1. Que la web esté publicada y respondiendo (GitHub Pages, carpeta docs/).
//   2. `supabase functions deploy public-info --project-ref <ref>` (no lleva JWT; es pública).
// Y en el siguiente build de la app, EXPO_PUBLIC_PRIVACY_URL ya apunta directamente a la web (eas.json).

/** Único documento fuente de los textos legales. Si cambia el alojamiento, se cambia aquí. */
const SITE = 'https://murelf87.github.io/MediClaro';

const DESTINATION: Record<string, string> = {
  privacy: `${SITE}/privacidad.html`,
  terms: `${SITE}/condiciones.html`,
  legal: `${SITE}/aviso-legal.html`,
  'delete-account': `${SITE}/eliminar-cuenta.html`,
  support: `${SITE}/soporte.html`,
};

Deno.serve((req) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
  const which = new URL(req.url).searchParams.get('page') ?? 'support';
  const target = DESTINATION[which] ?? DESTINATION.support;
  // 302 y no 301: si algún día cambia el alojamiento, ningún navegador se queda con la dirección vieja
  // guardada para siempre. `cache-control` corto por lo mismo.
  return new Response(null, {
    status: 302,
    headers: { location: target, 'cache-control': 'public, max-age=300' },
  });
});
