# MediClaro — Estado real del snapshot y pendientes

Fecha del snapshot: 08/10/2026  
Versión de package: 1.0.1  
Commit base: aa69d84b3671098e7dec166e4d5f61f48e10a0f6  
El ZIP incorpora además los cambios locales posteriores reflejados en `99_ULTIMOS_CAMBIOS_NO_COMMIT.patch`.

## Incluido en este snapshot
- Frontend Expo / React Native.
- Expo SDK 57.
- Navegación y pantallas de MediClaro.
- Supabase backend y migraciones.
- Edge Functions.
- Pruebas Jest.
- Scripts de auditoría.
- Assets.
- Configuración EAS.
- Documentación funcional/técnica.
- Cambios recientes de IA, voz, cuidador, perfiles y emergencia.

## Cambios recientes incluidos
- Perfil Básico como acceso gratuito por defecto.
- "Elegir o cambiar mi perfil" en lugar de "Soy usuario".
- Perfil cuidador gratuito sin teléfono/SMS.
- Datos de perfil: nombre obligatorio, sexo, edad, teléfono opcional en Básico, foto.
- Vinculación cuidador mediante código de 6 dígitos o QR opcional.
- Solicitud pendiente hasta aceptación expresa del paciente Premium.
- Desvinculación con confirmación.
- Estado "Cuidador/a de [paciente]".
- Historial persistente de conversación de Lucía.
- Contexto longitudinal en backend.
- "Pensando..." animado.
- Escritura progresiva de nuevas respuestas.
- Micrófono mantener pulsado / soltar para enviar.
- Transcripción de voz.
- Respuesta automática por voz.
- Eliminación del fallback silencioso a la voz robótica en Premium.
- Aoede añadida como voz natural adicional.
- Lectura de medicamentos fijada a Sulafat.
- Preparación de lectura continua para evitar palabras partidas entre tarjetas.
- Controles visuales de audio: reproducir/pausar/repetir/progreso.
- Botón de IA para avisar y llamar al cuidador dentro de una emergencia.
- Flujo de llamada WebRTC preparado para inicio automático.
- Permisos de micrófono iOS/Android corregidos en configuración actual.
- Plugin final de privacidad iOS para preservar NSMicrophoneUsageDescription y NSMotionUsageDescription.

## Verificaciones observadas
- Último typecheck del código actual: PASS, exit code 0.
- Última suite completa observada antes del empaquetado: 26 suites / 320 tests PASS.
- Hash de la lógica protegida de foto de medicamento:
  `3a50b5953a560ca36583e555dce41b2294b58e9580f2db89f7cf2f42e8449342`
- TTS real Sulafat: HTTP 200, WAV RIFF válido.
- TTS real Achird: HTTP 200, WAV RIFF válido.
- TTS continuo real con varios segmentos: HTTP 200, WAV RIFF válido, continuous=true.
- Release-check observado: FALLOS=0 y dos pendientes de configuración externa.

## Importante sobre la Build 31
La Build 31 ya generada NO debe tratarse como build final:
- el Info.plist de esa IPA se comprobó y no incluía todavía NSMicrophoneUsageDescription;
- por eso el micrófono podía cerrar la app al solicitar acceso;
- el código de este ZIP contiene la corrección posterior;
- debe generarse una nueva build y comprobar la IPA final antes de probar el micrófono.

No instalar/publicar la Build 31 como candidata final.

## Bloqueos reales antes de producción

### 1. Apple IAP / Premium
`storeVerification=false` sigue siendo un bloqueo deliberado.
Falta prueba real en Apple Sandbox:
- compra;
- restauración;
- expiración;
- cancelación;
- recepción/verificación servidor-servidor.

No activar venta real hasta que esto pase.

### 2. TURN para llamada cuidador
El flujo WebRTC existe, pero para producción fiable en redes móviles/routers distintos se necesita TURN.
El fallback STUN directo sirve para pruebas, pero puede fallar en NAT restrictivo.
Configurar:
- CAREGIVER_TURN_URLS
- CAREGIVER_TURN_SHARED_SECRET

Después probar en dos teléfonos y dos redes distintas.

### 3. Prueba física iPhone
La siguiente build debe comprobar físicamente:
- permiso de micrófono;
- mantener pulsado y soltar;
- transcripción;
- respuesta automática por voz;
- que la app no se cierra;
- Sulafat en medicamentos;
- Aoede/Sulafat/Achird en Lucía;
- cámara/foto medicamento;
- foto de perfil;
- notificaciones;
- pantalla bloqueada;
- vinculación cuidador;
- llamada y chat de emergencia;
- ubicación.

### 4. Apple Info.plist
Antes de cualquier envío:
- descargar IPA nueva;
- abrir `Payload/MediClaro.app/Info.plist`;
- comprobar:
  - NSMicrophoneUsageDescription presente;
  - NSMotionUsageDescription presente;
  - resto de permisos coherentes.

### 5. Emergencia 112
Actualmente no debe anunciarse llamada autónoma real al 112.
El flujo seguro actual debe mantener el 112 como acción manual hasta validación legal/técnica.

### 6. Funciones todavía no cerradas
No declarar como producción terminada:
- Critical Alerts de Apple, si no hay entitlement concedido;
- GPS en background permanente;
- audio en background;
- agente telefónico autónomo;
- BLE/mesh/P2P/store-and-forward/E2E offline;
- escalado autónomo real al 112;
- conectividad WebRTC garantizada sin TURN.

## Nota sobre secretos
El ZIP excluye:
- `.env`;
- `.env.*` reales;
- IPA;
- `node_modules`;
- caches;
- repositorio `.git`.

Incluye `.env.example` para documentar las variables necesarias.

## Regla para continuar
No reconstruir el proyecto desde cero.
Trabajar sobre este código, conservar el diseño actual y corregir por capas:
1. funcionalidad;
2. pruebas;
3. seguridad;
4. responsive;
5. build interna;
6. validación física;
7. build de producción;
8. inspección IPA;
9. solo después, envío a Apple con autorización explícita.

## Actualización 08/10/2026 — voces y Expo Go
Ver `CAMBIOS_VOCES_Y_EXPO_GO_2026-10-08.md` y `100_CAMBIOS_VOCES_EXPO_GO_2026-10-08.patch`.
- Corregido: el micrófono de Lucía no grababa en iPhone (faltaba activar la grabación en la sesión de audio).
- Corregido: «Escuchar cómo funciona» del cuidador (texto no permitido en `tts-preview`).
- Voz natural: texto preparado para la voz (unidades, 112, enlaces), español de España, sin palabras cortadas, sin solapes entre pantallas de la explicación inicial.
- Vista previa en iPhone con Expo Go: `VER_EN_IPHONE_EXPO_GO.bat`. Compras y llamadas WebRTC solo en la build instalada.
- Verificación: TypeScript 0 errores; Jest 30 suites / 356 pruebas OK; paquete iOS generado; foto protegida sin cambios.
- Pendiente de desplegar: `npx supabase functions deploy tts tts-preview --project-ref ldonnvkysjalpmystoeq`.
- Sin verificar: voces reales de Gemini y prueba física en iPhone.

## Actualización 08/10/2026 (tarde) — explicación continua y correcciones del panel
Ver `CAMBIOS_EXPLICACION_Y_NOTAS_2026-10-08.md` y `101_TODOS_LOS_CAMBIOS_DESDE_TU_ZIP_2026-10-08.patch` (acumulado).
- «Conocer MediClaro»: una sola voz continua con 26 imágenes sincronizadas (sin tarjetas); grabaciones cortadas
  reparadas; regeneración de un clic `REGENERAR_VOCES_EXPLICACION.bat` (solo las defectuosas, nunca empeora).
- Lucía: micrófono junto a «Enviar», respuesta que se escribe poco a poco y se lee sola.
- Sin código de barras; foto de perfil en Cuenta; título del Inicio adaptable; sin «Elegir o cambiar mi perfil».
- Premium con identificaciones ilimitadas: la app ya lo muestra cuando el servidor lo aplica.
- Pendiente del propietario: aplicar `supabase/migrations/20261008200000_premium_unlimited_scans.sql` y regenerar
  las voces de Sulafat (2 finales recortados) con el .bat.
- Verificación: TypeScript 0 errores; Jest 33 suites / 404 pruebas OK; paquete iOS generado; lógica de foto sin cambios.

## Actualización 09/10/2026 — RC-2026-10-09: «Mis pastillas», pagos, cuidador/a y notas del panel
Ver `CAMBIOS_2026-10-09.md`, `MIS_PASTILLAS.md` y `102_TODOS_LOS_CAMBIOS_DESDE_TU_ZIP_2026-10-09.patch` (acumulado).
- «Mis pastillas»: pauta, avisos locales (también con la app cerrada y sin internet), confirmación de tomas,
  historial con correcciones trazables, posible toma doble, asistente con datos reales, cuidador/a con permisos,
  sin conexión, cambios de hora y privacidad. Backend nuevo: `20261009120000_medication_plans.sql`.
- Pagos: Bizum, «Que pague mi familiar o cuidador/a», SEPA y PayPal (los dos últimos solo si se activan), página de
  pago rediseñada con panel de confianza. Backend: `20261009100000_bizum_and_family_payments.sql` + `family-pay`.
- Asistente renombrado a MediClaro; explicación inicial en una sola toma y una sola voz (Sulafat); Aoede retirada.
- Además (notas del panel): alarma propia en los avisos, botón central del chat con el cuidador/a, mensaje del 112
  honesto (no se oye dentro de la llamada), voces elegidas también en emergencia, memoria del asistente en Perfil,
  foto de tu propia caja (solo en el teléfono) y limpieza de datos de medicación al cerrar sesión.
- Verificación: TypeScript 0 errores; Jest 38 suites / 448 pruebas OK; Deno 16 OK; migración en PGlite OK;
  release-check FALLOS=0; paquetes iOS/Android generados; lógica de foto sin cambios (hash `3a50b595…49342`).
- Pendiente del propietario: aplicar las migraciones, desplegar `chat`, `caregiver-dispatch`, `tts`, `tts-preview`,
  `create-checkout`, `stripe-webhook` y `family-pay --no-verify-jwt`, activar métodos en Stripe/`app_config.plans`,
  actualizar textos legales y probar en teléfonos reales (lista en `MIS_PASTILLAS.md` §15).
- Sin verificar aquí: avisos con la app cerrada / tras reiniciar, push real al cuidador/a, cobros reales.

## Actualización 09/10/2026 (tarde) — chat y llamadas, foto de homenaje y panel del propietario
Ver `CAMBIOS_2026-10-09.md` §13–17 y `PANEL_PROPIETARIO.md`.
- Chat permanente y llamada de voz tipo WhatsApp entre la persona Premium y su cuidador/a (backend
  `20261009150000_care_chat_and_calls.sql` + `caregiver-dispatch` + `caregiver-rtc-config`).
- Entrada: arriba el logo y la frase de MediClaro; debajo, la foto de homenaje de Isabel y José (puesta).
- Panel del propietario completo (18 rutas `/owner…`), con código de 6 cifras y Face ID; bonos aplicados desde el
  panel (sin códigos en la app, norma 3.1.1); aviso general en Inicio. Backend `20261009170000_owner_admin_panel.sql`.
- Panel del propietario rehecho pantalla a pantalla como las 12 imágenes del diseño (`PANEL_PROPIETARIO.md`, con
  las diferencias a propósito en §9); asistente sin bloqueo al escribir varias veces; cruz para cerrar la llamada.
- Verificación final (18:55): TypeScript 0; Jest 46 suites / 488 OK; Deno 21 OK; PGlite (3 migraciones) OK;
  release-check FALLOS=0; paquetes iOS/Android OK (también iOS con el perfil de producción); identificación por foto
  sin cambios.
- **Código definitivo para producción.** Pendiente solo del titular, en orden, en `PASOS_PRODUCCION.md`:
  - migraciones y funciones del servidor;
  - cobros en las tiendas y en Stripe;
  - revisión de los textos legales;
  - compilación EAS de producción;
  - pruebas en teléfonos reales;
  - envío a Apple y Google con las notas para la revisión.
- Opcional: cerrar las funciones antiguas del panel cuando todos usen la versión nueva (`PANEL_PROPIETARIO.md` §6.6).
- Sin verificar aquí: llamadas reales entre dos teléfonos, Face ID real, avisos push reales.


## Actualización 09/10/2026 (noche) — correcciones de las 19:05 y foto definitiva
Ver `CAMBIOS_2026-10-09.md` §20–21.
- Chat con el cuidador/a: lo enciende la persona cuidada; el cuidador/a responde durante 1 hora y después lo ve
  apagado (rojo) en la barra, en Inicio, en Cuidador y avisos y en el chat. Backend `20261009190000_care_chat_window.sql`
  (`CHAT_CLOSED`).
- Propietarios: solo Antonio (+34 680 127 015) y Marina (+34 646 350 527): `20261009191000_owner_phones_antonio_marina.sql`.
- Inicio: candado pequeño en vez de «Premium» en las filas; sin «te quedan N identificaciones» en Básico gratis;
  tarjeta grande del chat al final (encendida / apagada / candado / sin cuidador/a).
- Mis pastillas: pantalla «Cómo funciona Mis pastillas» (`/pills/help`) con siete pasos ilustrados.
- Cuidador y avisos rediseñada, con «Cómo funciona» en siete pasos con dibujo y la grabación real de Sulafat
  incluida en la app (36,96 s).
- Entrada: foto definitiva de Isabel y José (ojos verdes).
- Verificación (20:30): TypeScript 0; Jest 47 suites / 491 OK; Deno 21 OK; PGlite 5 migraciones OK; release-check
  FALLOS=0; paquetes iOS/Android OK; identificación por foto sin cambios; vista previa versión 17 sin errores.
- Expo Go: no se puede abrir desde el entorno de Claude (sin red hacia Expo/ngrok); en el PC, `VER_EN_IPHONE_EXPO_GO.bat`.
- Sin verificar aquí: la voz de la explicación en el teléfono (si se nota un corte, hace falta el segundo exacto),
  llamadas reales entre dos teléfonos, Face ID real, avisos push reales.
