# 💙 MediClaro — app para iPhone y Android

App para personas mayores: **hacen una foto a la caja de un medicamento** y la app les explica en lenguaje sencillo qué es,
para qué sirve, cómo se toma y qué precauciones tiene, con datos oficiales de **CIMA (AEMPS)**. Incluye lectura en voz alta,
un asistente de IA (con permiso previo), «Mis medicamentos», historial, **MediClaro Premium** (compra integrada de Apple y
Google Play y, donde las tiendas lo permiten, tarjeta en la página segura de Stripe) y un módulo de **emergencia** (112
siempre visible y separado del servicio privado de asistencia de cada usuario).

**Entrega 1.2 (28-09-2026) — pantallas Premium y pago** · versión de la app 1.0.0 (primera publicación).

| Documento | Contenido |
|---|---|
| [`COMERCIALIZACION.md`](COMERCIALIZACION.md) | **Qué falta para vender y en qué orden**: decisiones del titular, cobro en las tiendas, riesgos y fuentes |
| [`SCREEN_MAP.md`](SCREEN_MAP.md) | Las 49 rutas: cada pantalla, **qué botones llevan a ella** y qué hace cada control |
| [`FRONTEND_AUDIT.md`](FRONTEND_AUDIT.md) | Auditoría final: pantallas, botones, pruebas, novedades 1.2 y 1.1, errores conocidos, información necesaria |
| [`BACKEND_REQUIREMENTS.md`](BACKEND_REQUIREMENTS.md) | Lo que el backend debe corregir, añadir o configurar (con endpoint, método, request, response, errores y pantallas) |
| [`backend-patches/`](backend-patches/README.md) | Arreglos del servidor **propuestos y probados, sin aplicar** (R-01, R-05, R-06, R-07, R-09, R-10) |
| [`store/`](store/) | Kit de tiendas: fichas, privacidad (Apple y Google), clasificación, declaraciones de salud, notas para la revisión y **capturas** |
| [`legal/`](legal/README.md) | Borradores de política de privacidad, condiciones de uso y aviso legal (pendientes de revisión jurídica) |

## Arquitectura

```
App Expo (iOS / Android)                         Supabase (backend existente, sin cambios)
  app/            rutas (Expo Router)              · Auth (teléfono + SMS)
  src/screens/    pantallas                        · Edge Functions: identify-medicine, medicine-detail,
  src/components/ componentes compartidos            chat, account, create-checkout, customer-portal,
  src/theme/      colores, tipografía, espaciado…    stripe-webhook
  src/services/   ÚNICA capa que habla con ───────► · Postgres con RLS
                  el backend (Auth, datos, pagos,  ──► CIMA (AEMPS) · Gemini · Stripe (solo desde el servidor)
                  emergencia, voz, permiso de IA)  ──► StoreKit 2 / Google Play Billing (`expo-iap`, en
                                                       `services/billing/`; la compra se confirma en el servidor)
  src/api/        cliente, errores, almacenamiento local
  src/mocks/      datos de ejemplo (solo Modo demostración y QA; aislados)
```

Reglas que cumple el código: las pantallas nunca importan Supabase, Stripe, CIMA ni ningún proveedor; no hay claves secretas
en la app; no se guardan tarjetas; la sesión, el perfil de emergencia y los datos privados de asistencia se guardan **cifrados**
en el llavero (iOS) o el Keystore (Android); el 112 nunca se marca solo; **nada se envía a la IA sin el permiso explícito** de
la persona (se puede retirar en Perfil → Privacidad y datos).

## Puesta en marcha de la app

1. **Requisitos:** Node 20+, `npm i -g eas-cli`, y después `npm install`.
2. **Configuración pública:** copie el bloque «APP» de [`.env.example`](.env.example) a `.env` (o a variables de EAS) y ponga
   `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` (también valen `app.json → extra`). El resto de variables
   (soporte, textos legales, titular) están explicadas en `BACKEND_REQUIREMENTS.md` §4.
3. **Probar en el móvil:** `npx expo start` y ábrala con una *development build* (`eas build --profile development`).
4. **Tiendas:** `eas build --platform all --profile production` y `eas submit`. Solo iPhone (sin versión nativa para iPad)
   y Android. Antes, lea `COMERCIALIZACION.md` (empresa, cuentas, textos legales, SMS y revisión).

### Modos de cada compilación (`eas.json`)

| Perfil | `EXPO_PUBLIC_DEMO_ACCESS` | `EXPO_PUBLIC_PAYMENTS_MODE` | Para qué |
|---|---|---|---|
| `development`, `preview` | `on` («Entrar sin verificar» y Modo demostración) | `store,stripe` (compra integrada de la tienda **y** tarjeta con Stripe; sin tienda real, hojas «SIMULACIÓN» sin cobro) | Pruebas internas |
| `production` | `off` (sin acceso de prueba; los datos de ejemplo y las hojas simuladas no entran en el paquete) | `store` (**solo la compra integrada de Apple / Google Play**) | App Store y Google Play |

Valores admitidos: `store`, `stripe`, `store,stripe` o `none` (app gratuita: «Tu plan», sin precios ni botones de compra, como en la 1.1).
Las tiendas exigen la compra integrada para las suscripciones (Apple 3.1.1, pagos de Google Play); la tarjeta solo puede ofrecerse
en una versión de tienda con los permisos de pago alternativo de la UE/EEE (`COMERCIALIZACION.md` §3). **Red de seguridad:** mientras
el servidor no compruebe las compras (`iap-verify` y `app_config.plans.storeVerification = true`, R-04), la versión de tienda no
vende ni bloquea nada y muestra «Tu plan».

### Botón temporal «Entrar sin verificar»

Mientras el SMS no esté activado, en `/login` y `/verify` aparece **«Entrar sin verificar»** para recorrer toda la app:

- Si el servidor está conectado y tiene *Anonymous sign-ins* activado → sesión real de prueba.
- Si no → **Modo demostración** con datos de ejemplo. Siempre se ve una franja amarilla con «Salir».
- Aparece en `npx expo start` y en los perfiles `development` y `preview` de `eas.json` (`EXPO_PUBLIC_DEMO_ACCESS=on`).
  **No aparece** en el perfil `production` (`off`) ni en ninguna compilación de publicación que no lo active expresamente.

## Backend (existente — el frontend no lo modifica)

1. `supabase login && supabase link --project-ref TU_REF && supabase db push` (proyecto en una **región de la UE**).
2. Secretos **solo en el servidor**: `supabase secrets set GEMINI_API_KEY=…` y los de Stripe (ver `.env.example`).
3. Stripe: `STRIPE_SECRET_KEY=sk_test_… SUPABASE_URL=https://TU_REF.supabase.co node scripts/setup-stripe.mjs` y ejecute la
   línea `supabase secrets set …` que imprime.
4. **Desplegar todas las funciones que usa la app** (no despliegue `emergency-assess`: no la usa la app y no compila, R-15):
   ```bash
   supabase functions deploy identify-medicine medicine-detail chat account create-checkout customer-portal iap-verify cleanup-anonymous
   supabase functions deploy stripe-webhook apple-store-notifications google-play-notifications --no-verify-jwt
   ```
5. **Acceso por SMS:** Supabase → Auth → Providers → Phone (proveedor de SMS, código de 6 cifras, caducidad igual a
   `EXPO_PUBLIC_OTP_TTL_SECONDS`, números de prueba para la revisión de las tiendas). Detalle en `BACKEND_REQUIREMENTS.md` R-02.
6. **Antes de cobrar:** aplicar el arreglo de **R-01** (el webhook no escribe `sub_state`; sin eso Premium no se aplica en el
   servidor). Está preparado y probado en `backend-patches/`, junto con R-05, R-06, R-07, R-09 y R-10: revíselos y
   aplíquelos primero en un proyecto de pruebas.
7. **Compras de Apple y Google (v1.2):** crear la función `iap-verify` y las notificaciones de servidor de las tiendas (R-04),
   activar *Anonymous sign-ins* para pagar sin teléfono (R-21), crear los productos en App Store Connect y Play Console (C-12)
   y poner `storeVerification: true` en `app_config.plans`. Hasta entonces la app no ofrece la compra (red de seguridad).

Tarjeta de prueba de Stripe (compilaciones de prueba): `4242 4242 4242 4242`, fecha futura y cualquier CVC.

## Calidad

```bash
npm run typecheck   # TypeScript estricto, sin `any`
npm test            # servicios, catálogo y oferta de planes, vías de pago, protección de rutas, permiso de IA y emergencia
cd backend-patches/tests && npm install && npm test && bash run-function-tests.sh   # arreglos del servidor
```

QA visual interna (no es un destino de la app): `scripts/qa-web.sh <carpeta>` crea una copia temporal que usa el backend simulado
de `src/mocks/` y la exporta a web para capturas y pruebas de flujo automáticas (`?qa=empty`, `?qa=premium`, `?qa=signedout`…;
`QA_PAYMENTS_MODE=store,stripe` por defecto, `store` para la variante de tienda y `none` para la app sin compras). `scripts/serve-qa.js` la sirve y `scripts/store-screenshots.js` genera
las capturas de las tiendas. El proyecto real no se modifica y el paquete de la app nunca incluye los datos simulados salvo
para el Modo demostración.

## Antes de publicar (importante)

Resumen de `COMERCIALIZACION.md`:

1. **Empresa y cuentas.** Apple (5.1.1(ix)) y Google Play piden que las apps de salud las publique una empresa, con número
   D-U-N-S y cuentas de organización.
2. **Cobro en las tiendas.** La app ya vende Premium con la compra integrada de Apple y Google Play (1.2). Para cobrar de
   verdad faltan `iap-verify` y las notificaciones de las tiendas (R-04), los productos y acuerdos en cada tienda (C-12) y
   `storeVerification: true`; la tarjeta en tienda, solo con los permisos de pago alternativo (C-14, R-22).
3. **Producto sanitario.** La app se presenta como *información* (no diagnóstico ni pauta). Apple exige declarar si es un
   producto sanitario regulado; debe confirmarlo un experto.
4. **Inteligencia artificial.** Permiso explícito antes de enviar nada a Gemini (hecho). Revisar con un abogado la cláusula de
   las condiciones de Gemini sobre «medical advice».
5. **RGPD.** Política de privacidad (borrador en `legal/`), registro de actividades, encargados de tratamiento (Supabase,
   Google, Stripe, proveedor de SMS), región UE en Supabase y evaluación de impacto. El perfil de emergencia contiene **datos
   de salud**.
6. **CIMA:** la app cita la fuente con la frase que pide la AEMPS y la fecha de obtención.


## Integración final de producción (29-09-2026)

Antes de publicar o activar compras, siga `PRODUCTION_SETUP.md`. La identificación española valida contra CIMA/AEMPS y las funciones de IA exigen Premium también en servidor.
