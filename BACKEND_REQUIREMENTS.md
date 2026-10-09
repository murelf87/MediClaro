# BACKEND_REQUIREMENTS — MediClaro (iPhone y Android)

Este documento reúne **todo lo que el frontend necesita del backend** y que hoy falta, falla o hay que configurar.
La entrega frontend v1.2 original mantenía `supabase/` intacto. **La integración final de 29-09-2026 sí fusiona en el árbol real `supabase/` los parches probados y las funciones nuevas de producción**, sin reconstruir el frontend. Donde sigue faltando una cuenta, secreto o configuración externa, la app no lo simula.

Revisado contra el código final de `supabase/functions/*` y `supabase/migrations/*` (**11 migraciones y 12 Edge Functions**, sin contar `_shared`).

> **v1.1:** los fallos corregibles se prepararon primero como **propuestas probadas** en
> `backend-patches/`; en la integración final de 29-09-2026, R-01/R-05/R-06/R-07/R-09/R-10 se copiaron al árbol real `supabase/` (R-01, R-05, R-06, R-07, R-09, R-10). Ver la sección 6 y `backend-patches/README.md`.
> La decisión de cobro (R-04) está resumida en `COMERCIALIZACION.md`.
>
> **v1.2 (pantallas Premium y pago):** la app ya incluye la **compra integrada de Apple y Google** (y, donde las tiendas lo
> permiten, la tarjeta en la página segura de Stripe), la **cuenta sin teléfono al pagar** y el teléfono **después** del
> pago. Lo que eso necesita del servidor está en **R-04** (función `iap-verify` + notificaciones de las tiendas), **R-12**
> (catálogo de 3 planes), y en los requisitos nuevos **R-21 a R-26**. Orden recomendado: **R-01 → R-24 → R-04/R-12 → R-21**.
> Hasta que `iap-verify` exista y `app_config.plans.storeVerification` sea `true`, la versión de tienda **no bloquea nada**
> (funciona como la gratuita, sin anunciar Premium): ver R-04 → «Red de seguridad».

> **Integración final 29-09-2026:** el árbol `supabase/` ya incorpora R-01, R-24 y el código de R-04/R-21. La verificación de tienda se mantiene deliberadamente desactivada (`storeVerification=false`) hasta completar configuración externa y pruebas reales. La identificación española valida siempre contra CIMA/AEMPS; Gemini solo extrae lo visible del envase.

**Prioridades:** **P0** bloquea la salida a producción · **P1** necesario para que todo funcione como indica la
especificación (o por RGPD) · **P2** mejora o coherencia.

---

## 0. Resumen

| ID | Qué falta o falla | Prioridad | Efecto hoy en la app |
|---|---|---|---|
| R-01 | Sincronizar `profiles.sub_state` con el estado real de cobro | **P0** | **INTEGRADO 29-09-2026:** migración + webhook de Stripe aplicados al árbol `supabase/`; falta desplegar la migración/función en el proyecto real. |
| R-02 | Acceso por SMS sin configurar (Supabase Auth → Phone) | **P0** | No se puede iniciar sesión con el móvil ni añadir el teléfono tras pagar; mientras tanto existe el botón temporal «Entrar sin verificar» (solo en compilaciones de prueba) |
| R-03 | Desplegar **todas** las funciones que usa la app | **P0** | **CÓDIGO COMPLETO; ACCIÓN DEL TITULAR:** desplegar también `iap-verify`, notificaciones de tienda y limpieza anónima, además de las funciones existentes. |
| R-04 | Verificación de compras Apple/Google + notificaciones de servidor | **P0** (para vender en las tiendas) | **IMPLEMENTADO EN CÓDIGO 29-09-2026:** `iap-verify`, App Store Server Notifications y Google RTDN consultan las API oficiales antes de cambiar el entitlement. **Pendiente:** secretos/cuentas, productos, URLs, despliegue y pruebas Sandbox/License Testing; `storeVerification` permanece `false` hasta entonces. |
| R-05 | `emergency_profiles` sin columnas `phone` y `additional_info`; sin sitio para el servicio privado de asistencia y el médico de cada usuario | P1 | Esos datos se guardan solo en este teléfono (cifrados); se pierden al cambiar de móvil. **Propuesta probada** |
| R-06 | La exportación RGPD (`account` → `export`) no incluye el perfil de emergencia (datos de salud) | P1 | La app lo completa con lo que puede leer (perfil de emergencia y datos del teléfono). **Propuesta probada** para el servidor |
| R-07 | El límite gratuito se reinicia borrando filas de `scans` (RLS permite `DELETE`) | P1 | La app no ofrece borrar el historial, pero la API lo permite → abuso de cuota y coste de IA. **Propuesta probada** |
| R-08 | Registro de consentimientos (textos legales y tratamiento de datos de salud) | P1 | El permiso para la IA **ya se registra** (`kind = 'ai_processing'`); faltan los textos legales publicados y sus versiones |
| R-09 | Uso diario del asistente en `get_account_status` | P1 | No se puede mostrar «Te quedan N preguntas hoy»; solo se avisa al llegar al límite. **Propuesta probada** |
| R-10 | `cancel_at_period_end` no lo escribe el webhook | P1 | La app ya muestra «No se renovará» cuando el dato llega; hoy nunca llega. **Propuesta probada** |
| R-11 | Notificaciones: preferencias en servidor + envío | P1 | Preferencias guardadas en el teléfono; la pantalla avisa de que aún no se envían avisos |
| R-12 | Catálogo de planes (mensual 4,99 € · trimestral 12,99 € · anual 39,99 €) y productos de tienda en `app_config.plans`; `create-checkout` con `planId` | **P1** | Sin la fila se usan los precios del propietario (respaldo en la app); con tarjeta solo se ofrece el mensual hasta que `create-checkout` acepte `planId` |
| R-13 | Búsqueda de medicamentos por nombre | P2 | Añadir medicamento funciona con foto, código de barras o C.N.; no por nombre |
| R-14 | Cuidadores / familiares (invitaciones) | P2 | Beneficio «familiar» oculto. El aviso a un familiar en emergencia funciona sin backend (SMS del teléfono) |
| R-15 | `emergency-assess` con defectos (no lo usa la app; **no compila**: `deno check` falla) | P2 | Ninguno: la app genera el mensaje al operador de forma determinista. **No desplegarla** |
| R-16 | Coherencia de textos del servidor (tú/usted, «ilimitada» vs 200/día, códigos de error) | P2 | La app traduce los mensajes conocidos; los nuevos aparecerían tal cual |
| R-17 | Tabla duplicada `saved_medicines` (v3) sin uso | P2 | Ninguno (la app usa `saved_medications`) |
| R-18 | Beneficios Premium de la especificación sin respaldo en servidor | P2 | Ocultos: solo se anuncian «Más identificaciones» y «Más consultas al asistente IA» |
| R-19 | `usage_events` guarda `user_id` junto a `detail = 'emergency'` | P1 | Ninguno en la app; es un dato relacionado con la salud: política de privacidad y plazo de conservación |
| R-20 | `caregiver_links`: la persona titular puede activar un vínculo sin que la otra acepte | P2 | Ninguno hoy (no da acceso a datos); corregir antes de construir R-14 |
| R-21 | **Cuenta sin teléfono al pagar** (Supabase *Anonymous sign-ins*) y limpieza de cuentas abandonadas | **P0** (para no pedir el teléfono antes del pago) | La app y `cleanup-anonymous` están preparadas. **Pendiente del titular:** activar Anonymous sign-ins y programar la limpieza con `CRON_SECRET`. |
| R-22 | Declarar a Apple/Google los pagos con tarjeta hechos desde la app (tokens de compra externa) | **P0 si se ofrece la tarjeta** en una versión de tienda | La app envía el token a `create-checkout` (`externalPurchaseToken`); hoy nadie lo declara. La versión `production` no ofrece tarjeta |
| R-23 | Plantilla del SMS de verificación | P1 | La app muestra cómo llegará el mensaje; si la plantilla no coincide, el ejemplo no será exacto |
| R-24 | Funciones con IA **solo para Premium** también en el servidor (y nunca para cuentas sin pagar) | **P0** (antes de publicar con compras) | **INTEGRADO 29-09-2026:** `identify-medicine`, `medicine-detail` y chat normal exigen Premium en servidor; la cuota gratuita queda a 0. La derivación de emergencia sigue accesible sin Premium y sin Gemini. |
| R-25 | Unir cuentas cuando el teléfono ya tiene una cuenta de MediClaro (`phone_exists`) | P1 | La app avisa y no vincula el número; la suscripción queda en la cuenta sin teléfono de este móvil |
| R-26 | Uso incluido con suscripciones de tienda (sin pago por uso) y periodo del contador | P1 | La app solo muestra el cargo por uso adicional a quien paga con tarjeta; con Apple/Google no hay cargos extra |
| C-* | Configuración del propietario (variables, números, textos legales) | P0/P1 | Ver sección 4 |

---

## 1. P0 — Bloquean producción

### R-01 · El plan Premium no se aplica en el servidor (`sub_state`)

- **Endpoint necesario:** `stripe-webhook` (Edge Function existente) → función `syncSubscription`.
- **Método:** `POST` (lo llama Stripe; firma HMAC).
- **Request:** eventos `checkout.session.completed`, `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed` (sin cambios).
- **Response:** `200 ok` (sin cambios).
- **Errores:** `400` firma no válida · `500` (Stripe reintenta).
- **Pantallas que lo utilizan:** `/` (uso del mes), `/premium`, `/payment`, `/payment-result`, `/profile`, `/account`, `/history`, `/scan` → `/processing` (límite), `/chat` y `/assistant` (límite diario).
- **Problema:** `is_premium()` (migración v2) mira `profiles.sub_state IN ('TRIAL','ACTIVE','PAST_DUE')`, pero el webhook solo
  actualiza `plan`, `subscription_status`, `current_period_*`. `sub_state` se queda en `'FREE'` para siempre, así que
  `get_account_status`, `can_scan`, `consume_scan` y `can_chat` aplican los límites gratuitos a quien paga, y el uso
  adicional (0,05 €) nunca se mide.
- **Corrección propuesta (una de las dos):**
  1. En `syncSubscription`, escribir también `sub_state` según `sub.status`
     (`active→ACTIVE`, `trialing→TRIAL`, `past_due→PAST_DUE`, `canceled→CANCELLED`, `unpaid`/`incomplete_expired→EXPIRED`,
     resto→`FREE`) y `cancel_at_period_end` (ver R-10).
  2. O redefinir `is_premium()` con `plan = 'premium' AND subscription_status IN ('active','trialing','past_due')`.
- **Qué hace hoy el frontend:** decide si alguien es Premium leyendo `profiles.plan` (que sí escribe el webhook) y solo muestra
  el contador de uso cuando el plan que **aplica el servidor** (`get_account_status().plan`) coincide con el que ve la persona.
  Hoy, con Premium, no coincide y el contador no se muestra (sería falso). **En cuanto se corrija R-01, el uso Premium aparece
  solo** («N de 100 identificaciones incluidas»), sin cambiar la app (`SubscriptionService.getSubscription()`).
- **Integrado en `supabase/` (29-09-2026):** `supabase/migrations/20260929090000_r01_sub_state_sync.sql`; copia de la propuesta probada `backend-patches/migrations/20260928090000_r01_sub_state_sync.sql` (trigger que deriva
  `sub_state` de `plan` + `subscription_status` y corrige las cuentas existentes) y `backend-patches/functions/stripe-webhook/`
  (escribe `sub_state`; además corrige dos pérdidas de eventos). Las dos vías son independientes.

### R-02 · Acceso por teléfono + código SMS

- **Endpoint necesario:** Supabase Auth (existente, falta configurarlo): `POST /auth/v1/otp` y `POST /auth/v1/verify`.
- **Método:** `POST` (vía `supabase.auth.signInWithOtp` / `verifyOtp`).
- **Request:** `{ phone: "+34600123456", channel: "sms", create_user: true }` · verificación `{ phone, token: "123456", type: "sms" }`.
- **Response:** `200` (código enviado) · verificación → sesión (`access_token`, `refresh_token`, `user`).
- **Errores que la app ya traduce:** `phone_provider_disabled` («El acceso por SMS todavía no está activado») ·
  `over_sms_send_rate_limit` / `429` · `sms_send_failed` · `validation_failed` (número no válido) · `otp_expired` (código
  incorrecto o caducado) · `signup_disabled` · sin conexión.
- **Pantallas que lo utilizan:** `/login` («Enviar código»), `/verify` (código, «Reenviar código»).
- **Estado actual:** `supabase/config.toml` solo tiene `[auth.email]`; no hay `[auth.sms]` ni proveedor de SMS.
- **Qué hay que hacer (panel de Supabase, sin tocar código):**
  1. Auth → Providers → **Phone**: activar, elegir proveedor (p. ej. **Twilio**) y poner sus credenciales **en Supabase**
     (nunca en la app).
  2. Longitud del código: **6** cifras (la app lo exige).
  3. Caducidad del código («SMS OTP Expiry») = valor de `EXPO_PUBLIC_OTP_TTL_SECONDS` en la app (por defecto 300 s).
  4. Plantilla del SMS en español: **«MediClaro: tu código es {{ .Code }}. No se lo digas a nadie.»** (ver R-23).
  5. **Números de prueba** (Auth → Phone → test OTP) para la revisión de Apple/Google: los revisores necesitan poder entrar.
- **v1.2 · Añadir el teléfono después de pagar** («Completa tu cuenta» → `/verify?purpose=link`): la app usa
  `supabase.auth.updateUser({ phone })` (envía el SMS al número nuevo) y `verifyOtp({ phone, token, type: 'phone_change' })`,
  que es la vía que documenta Supabase para cambiar/añadir el teléfono. Mismo proveedor de SMS y misma plantilla.
  Error `phone_exists` → ver R-25.
- **Botón temporal «Entrar sin verificar»** (pedido por el propietario): aparece en `/login` y `/verify` solo en compilaciones de
  desarrollo/prueba (`EXPO_PUBLIC_DEMO_ACCESS=on`; el perfil `production` de `eas.json` lo pone en `off`).
  - Si el servidor tiene **Anonymous sign-ins** activado → crea una sesión real de prueba (`signInAnonymously`).
  - Si no → entra en **Modo demostración** con datos de ejemplo, siempre señalizado con una franja amarilla.
  - ⚠ **Seguridad (v1.2):** la **cuenta sin teléfono al pagar** también usa *Anonymous sign-ins*, así que en producción
    hará falta activarlo (R-21). Antes, aplicar **R-24**: sin él, cualquiera podría crear cuentas anónimas con la clave
    pública y gastar la cuota gratuita de IA. El botón «Entrar sin verificar» sigue sin aparecer en `production`.

### R-03 · Desplegar todas las Edge Functions que usa la app

- **Endpoint necesario:** despliegue de funciones existentes (sin cambiar su código).
- **Método:** `supabase functions deploy …`
- **Request / Response:** ver sección 5 (contrato).
- **Errores:** si no están desplegadas, la app recibe `404` y muestra «No lo hemos encontrado» / «No hemos podido …».
- **Pantallas que lo utilizan:** `medicine-detail` → `/result`, `/medication/[id]`, `/voice`, imágenes en `/candidates`,
  `/medicines`, `/saved/[id]` · `account` → `/account`, `/privacy`, `/profile` (descargar datos, eliminar cuenta).
- **Comando completo:**
  ```bash
  supabase functions deploy identify-medicine medicine-detail chat account create-checkout customer-portal iap-verify cleanup-anonymous
  supabase functions deploy stripe-webhook apple-store-notifications google-play-notifications --no-verify-jwt
  ```
  (El README original omitía `medicine-detail` y `account`; ya está corregido en el README.)

### R-04 · Compras de Apple y Google Play: `iap-verify` + notificaciones de las tiendas

> **Estado 29-09-2026:** implementado en código (`iap-verify`, `apple-store-notifications`, `google-play-notifications`, `storeBilling.ts`). Pendiente de despliegue, secretos/productos y pruebas reales; `storeVerification=false` hasta completarlas.

**Qué hace ya la app (v1.2).** Compra integrada con StoreKit 2 (iPhone) y Google Play Billing (Android) mediante
`expo-iap`; la hoja de compra es la oficial de cada tienda. Cada compra se hace con el **id de la cuenta de MediClaro**
(`auth.users.id`, en minúsculas) como `appAccountToken` (Apple) y `obfuscatedAccountId` (Google), para que el servidor sepa
de quién es. Tras la hoja, la app llama a `iap-verify`; **solo cuando responde `isPremium: true`** cierra la transacción
(`finishTransaction`; en Android equivale a **confirmar/acknowledge** la compra). Si el servidor no responde, la transacción
queda abierta y la app la vuelve a enviar al abrirse (nunca se pierde un pago). «Restaurar compra» envía a `iap-verify` las
compras activas de la cuenta de la tienda de ese teléfono.

**Contrato implementado en el servidor (pendiente de desplegar/configurar en el proyecto real).**

- **Endpoint nuevo:** `POST /functions/v1/iap-verify` (con JWT de la persona; límite recomendado 10/min).
- **Request (tal como lo envía la app):**
  ```json
  { "platform": "apple" | "google", "productId": "com.mediclaro.app.premium.annual",
    "transactionId": "2000000123456789" | null, "purchaseToken": "<JWS de Apple o purchaseToken de Google>",
    "planId": "premium_annual" }
  ```
  (`planId` solo llega en compras nuevas, no al restaurar.)
- **Qué debe hacer:**
  1. **Apple:** verificar la transacción firmada (JWS) con los certificados raíz de Apple o consultarla con la *App Store
     Server API* (`Get Transaction Info`); comprobar `bundleId`, `productId`, entorno (Sandbox/Production), que no esté
     revocada y que `appAccountToken` sea el id de la persona (si falta, aceptar solo si esa compra no pertenece a otra cuenta).
  2. **Google:** `purchases.subscriptionsv2.get` (Google Play Developer API) con el `purchaseToken`; comprobar
     `externalAccountIdentifiers.obfuscatedExternalAccountId` = id de la persona, estado activo y el producto/plan base.
     Si no está confirmada, **confirmarla también desde el servidor** (`purchases.subscriptions.acknowledge`): Google
     reembolsa las compras no confirmadas a los 3 días.
  3. Guardar la relación compra ↔ cuenta (propuesta: tabla `store_subscriptions` con `user_id`, `platform`,
     `original_transaction_id` / `purchase_token`, `product_id`, `status`, `expires_at`, `environment`), y actualizar
     `profiles`: `plan = 'premium'`, `subscription_status`, `current_period_end`, `billing_provider = 'apple' | 'google'`,
     `cancel_at_period_end` y `sub_state` (R-01).
  4. Una compra ya vinculada a **otra** cuenta → `409` (la app explica que entre con el teléfono de esa cuenta).
- **Response:** `{ "isPremium": true, "plan": "premium", "provider": "apple" | "google", "currentPeriodEnd": "<ISO>" }`.
  Con `isPremium: false` la app muestra «Estamos confirmando tu pago» y reintenta (no cierra la transacción).
- **Errores que la app ya trata:** `400` compra no válida («La tienda no ha podido confirmar esta compra») · `401` ·
  `404`/`5xx`/sin conexión (queda pendiente y se reintenta sola) · `409` compra de otra cuenta · `429`.
- **Notificaciones de servidor (obligatorias para renovaciones, cancelaciones, reembolsos y avisos de facturación):**
  *App Store Server Notifications V2* (URL en App Store Connect) y *Real-time developer notifications* de Google Play
  (Pub/Sub). Actualizan `profiles` igual que el punto 3, sin que la app esté abierta.
- **Pantallas que lo utilizan:** `/premium` (planes), `/payment` («Pagar con Apple» / «Pagar con Google Play»),
  `/premium-success`, «Restaurar compra» (en planes, forma de pago y bienvenida), `/premium` con suscripción
  («Gestionar suscripción» abre la gestión de la tienda).
- **Cómo se activa en la app (sin publicar una versión nueva):** `app_config.plans.storeVerification = true` (R-12) cuando
  `iap-verify` y las notificaciones estén en producción, y los productos creados en las tiendas con los identificadores de
  R-12. Mientras sea `false`, la app **no ofrece** la compra con la tienda.
- **Red de seguridad de la versión de tienda** (`EXPO_PUBLIC_PAYMENTS_MODE=store`): si el servidor declara que aún no
  comprueba compras (`storeVerification` distinto de `true`) y no hay tarjeta, no hay forma de pagar, así que la app **no
  bloquea ninguna función** (funciona como la gratuita, con los límites del servidor) y **no muestra avisos de Premium**.
  Es un estado de transición: el objetivo es publicar con `iap-verify` activo.
- **Normas:** Apple 3.1.1 (suscripciones con compra integrada) y 3.1.1 «restore mechanism» (hecho: «Restaurar compra»);
  3.1.2(c) describir lo que se obtiene por el precio (hecho: planes, ventajas, renovación, «Cancela cuando quieras. Sin
  permanencia.» y enlaces legales junto al botón). Fuentes y comisiones: `COMERCIALIZACION.md`.

---

## 2. P1 — Necesarios para la funcionalidad completa y el RGPD

### R-05 · Perfil de emergencia: columnas que faltan y datos de asistencia por usuario

- **Endpoint necesario:** tabla `emergency_profiles` (existente) + nuevas columnas; o tabla nueva `emergency_private_services`.
- **Método:** `SELECT` / `UPSERT` con RLS del propio usuario (como hoy).
- **Request (columnas nuevas):** `phone text`, `additional_info text`, `private_assistance_name text`,
  `private_assistance_phone text`, `primary_doctor_name text`, `primary_doctor_phone text`.
- **Response:** la fila completa.
- **Errores:** `42703` columna inexistente (lo que ocurriría hoy si la app enviara `phone` o `additional_info`) · RLS `42501`.
- **Pantallas que lo utilizan:** `/emergency-profile`, `/emergency-profile-edit`, `/private-assistance`, `/emergency`,
  `/emergency/prepared`, `/emergency/calling`, `/emergency/voice-message`, `/emergency/notify`.
- **Problema:** la migración v3 crea `emergency_profiles` sin `phone`, `additional_info` ni `created_at`; la v4 usa
  `CREATE TABLE IF NOT EXISTS` (no hace nada) y sus `ALTER` no añaden esas columnas.
- **Qué hace hoy el frontend:** no envía esas columnas (evita el error). El **servicio privado de asistencia de cada usuario** y su
  **médico** se guardan **solo en este teléfono, cifrados** (llavero/Keystore) y la pantalla lo dice («Guardado en este teléfono»).
  El 112 es siempre una opción aparte y nunca se llama sola. La persona puede **borrar su perfil de emergencia** sin eliminar la
  cuenta (`/emergency-profile` → «Borrar mi perfil de emergencia»).
- **Integrado en `supabase/` (29-09-2026):** `supabase/migrations/20260929090100_r05_emergency_profile_columns.sql` (basado en `backend-patches/migrations/20260928090100_r05_emergency_profile_columns.sql`). Tras
  aplicarla, la app necesita un cambio pequeño para usar las columnas nuevas (ver `backend-patches/README.md`).

### R-06 · Exportación de datos (RGPD) incompleta

- **Endpoint necesario:** `account` (Edge Function existente) → acción `export`.
- **Método:** `POST`.
- **Request:** `{ "action": "export" }`.
- **Response esperada:** la actual (`exportedAt, email, profile, history, myMedications, consents`) **más**
  `emergencyProfile` (fila de `emergency_profiles`) y `caregivers` (filas de `caregiver_links`).
- **Errores:** `401` · `429` (3/min) · `500`.
- **Pantallas que lo utilizan:** `/privacy` y `/account` («Descargar mis datos»).
- **Qué hace hoy el frontend:** completa el archivo con el perfil de emergencia (leído con la sesión de la persona) y con lo que
  solo vive en el teléfono (`dataOnThisPhone`: servicio privado, médico, preferencias de avisos y de pantalla, permiso de IA). Si
  el servidor ya incluye `emergencyProfile`, usa el del servidor.
- **Integrado en `supabase/functions/account/` (29-09-2026):** basado en `backend-patches/functions/account/` (añade perfil de emergencia, cuidadores, teléfono de
  acceso, actividad y registro de seguridad; si una consulta falla responde error en vez de un archivo incompleto).

### R-07 · El límite gratuito se puede reiniciar borrando el historial

- **Endpoint necesario:** política RLS `"borrar mis escaneos"` de `scans` (v2) y funciones de cuota.
- **Método:** `DELETE /rest/v1/scans` (hoy permitido al propio usuario).
- **Request / Response:** —
- **Errores:** —
- **Pantallas que lo utilizan:** ninguna (la app **no** ofrece borrar el historial por este motivo); afecta a la cuota que muestran
  `/`, `/history` y `/premium`.
- **Problema:** `get_account_status`, `can_scan` y `consume_scan` cuentan filas de `scans`; si el usuario las borra por API, su
  cuota vuelve a cero y puede generar coste de IA ilimitado.
- **Corrección propuesta:** borrado lógico (`hidden_at`) o contar la cuota en una tabla/columna que el usuario no pueda borrar.
  Cuando exista, la app puede ofrecer «Borrar historial».
- **Integrado en `supabase/` (29-09-2026):** `supabase/migrations/20260929090200_r07_scans_history_clear.sql`: quita el borrado
  directo y añade `clear_scan_history(p_ids bigint[] default null)`, que oculta las filas **y borra qué medicamento era**
  (conserva solo fecha y resultado para la cuota).

### R-08 · Registro de consentimientos

- **Endpoint necesario:** tabla `consents` (existente; política de `INSERT` del propio usuario ya creada).
- **Método:** `INSERT`.
- **Request:** `{ user_id, kind: "terms" | "privacy" | "health_data", version: "<versión publicada>", granted: true }`.
- **Response:** `201`.
- **Errores:** `409` ya registrado (clave `user_id, kind, version`) · RLS.
- **Pantallas que lo utilizarían:** `/login` (aceptación de condiciones y privacidad), `/emergency-profile-edit` (consentimiento
  expreso para datos de salud), `/emergency-sharing`.
- **Qué falta:** los **textos legales publicados y su número de versión** (ver C-3). Sin ellos la app no registra una versión
  inventada. Hoy muestra el aviso y los enlaces a «Información legal».
- **Ya registrado por la app (v1.1): permiso para la IA** (norma 5.1.2(i) de Apple). Antes de enviar la primera foto o pregunta a
  Gemini, la app pide permiso y registra cada decisión: `{ user_id, kind: "ai_processing", version: "ia-2026-09@<fecha ISO>",
  granted: true | false }` (una fila por decisión; `23505` se trata como ya registrado; sin conexión se guarda en el teléfono y
  se reintenta). La persona puede retirarlo en `/privacy`. La tabla y sus políticas actuales lo admiten (probado).

### R-09 · Preguntas restantes del asistente

- **Endpoint necesario:** RPC `get_account_status()` (existente) → añadir campos.
- **Método:** `POST /rest/v1/rpc/get_account_status`.
- **Request:** sin parámetros.
- **Response (campos nuevos):** `"chats_today": number, "chat_per_day": number`.
- **Errores:** los actuales.
- **Pantallas que lo utilizan:** `/chat`, `/assistant` («Te quedan N preguntas hoy»), `/premium`.
- **Hoy:** la app solo informa cuando el servidor responde `402 CHAT_LIMIT` (tarjeta «Has llegado al límite de preguntas de hoy»;
  con acceso a Premium solo si hay compras en la app). Nota: `can_chat` cuenta también los mensajes derivados a emergencia.
- **Integrado en `supabase/` (29-09-2026):** `supabase/migrations/20260929090300_r09_r10_account_status.sql` (`chats_today`,
  `chat_per_day`, `chats_left_today`, `cancel_at_period_end`; día de España; las derivadas a emergencia no gastan preguntas, igual
  en `can_chat`).

### R-10 · Cancelación al final del periodo

- **Endpoint necesario:** `stripe-webhook` → escribir `profiles.cancel_at_period_end` (columna existente, v2).
- **Método:** `POST` (Stripe).
- **Request:** `customer.subscription.updated` (`sub.cancel_at_period_end`).
- **Response:** `200`.
- **Errores:** los actuales.
- **Pantallas que lo utilizan:** `/premium` y `/account` (texto «Se renueva el …» / «Termina el …»).
- **Hoy:** la app lee `profiles.cancel_at_period_end` y, si es `true`, muestra «Premium sigue activo hasta el … No se renovará.» y
  el aviso «Has cancelado la renovación». Como el webhook no lo escribe, hoy sigue apareciendo «Se renueva el …».
- **Integrado en `supabase/functions/stripe-webhook/` (29-09-2026):** basado en `backend-patches/functions/stripe-webhook/` (también contempla `cancel_at`).

### R-11 · Notificaciones

- **Endpoint necesario:** tabla `notification_preferences` (nueva) + `push_tokens` (nueva) + envío (Edge Function o servicio).
- **Método:** `SELECT` / `UPSERT` (RLS del propio usuario) · `POST /functions/v1/register-push-token`.
- **Request:** preferencias `{ account_alerts: boolean, safety_alerts: boolean, tips: boolean }` · token
  `{ token: string, platform: "ios" | "android" }`.
- **Response:** la fila guardada · `{ ok: true }`.
- **Errores:** `401` · `400` token no válido.
- **Pantallas que lo utilizan:** `/notifications`.
- **Hoy:** los interruptores se guardan en el teléfono, por cuenta, y la pantalla dice «Todavía no enviamos notificaciones».
  Cuando exista el backend: `NotificationService.isDeliveryAvailable()` → `true` y cambiar el almacenamiento por la tabla.

---

## 3. P2 — Mejoras y coherencia

### R-12 · Catálogo de planes y productos de las tiendas desde el servidor

- **Endpoint necesario:** fila `app_config` con `key = 'plans'` (tabla existente, lectura pública) y `create-checkout`
  aceptando el plan elegido.
- **Método:** `SELECT` (catálogo) · `POST /functions/v1/create-checkout`.
- **Request (checkout, v1.2):** `{ "returnUrl": "mediclaro://payment-result", "planId": "premium_annual",
  "externalPurchaseToken"?: "<token de la tienda>" }`. La app solo envía `planId` si la fila declara
  `checkoutAcceptsPlanId: true` (hoy el backend crea siempre el mensual) y `externalPurchaseToken` si la tienda lo da (R-22).
- **Response:** `{ "url": "https://checkout.stripe.com/…" }`.
- **Errores:** los actuales + `400` plan no válido.
- **Pantallas que lo utilizan:** `/premium`, `/payment`, `/payment-card`, `/premium-success`, `/legal?section=subscription`
  (condiciones con los precios reales), `/help`.
- **Formato de la fila `plans` que la app ya entiende** (si no existe, usa el respaldo de `src/config/plans.ts` con los
  precios del propietario: 4,99 €/mes, 12,99 €/3 meses y 39,99 €/año, IVA incluido; el anual destacado):
  ```json
  {
    "providerLabel": "Stripe",
    "storeVerification": false,
    "checkoutAcceptsPlanId": false,
    "plans": [
      { "id": "premium_monthly", "name": "MediClaro Premium", "period": "monthly", "priceCents": 499,
        "terms": ["IVA incluido.", "Incluye 100 identificaciones al mes."],
        "store": { "apple": { "productId": "com.mediclaro.app.premium.monthly" },
                   "google": { "productId": "mediclaro_premium", "basePlanId": "monthly" } } },
      { "id": "premium_quarterly", "name": "MediClaro Premium", "period": "quarterly", "priceCents": 1299,
        "store": { "apple": { "productId": "com.mediclaro.app.premium.quarterly" },
                   "google": { "productId": "mediclaro_premium", "basePlanId": "quarterly" } } },
      { "id": "premium_annual", "name": "MediClaro Premium", "period": "annual", "priceCents": 3999, "highlighted": true,
        "store": { "apple": { "productId": "com.mediclaro.app.premium.annual" },
                   "google": { "productId": "mediclaro_premium", "basePlanId": "annual" } } }
    ],
    "benefits": [ { "id": "assistant", "label": "Asistente IA", "detail": "Haz tus preguntas y recibe explicaciones sencillas." },
                  { "id": "emergency", "label": "Emergencias y ubicación", "detail": "…", "alwaysFree": true } ]
  }
  ```
  - `period`: `monthly` | `quarterly` | `annual`. `purchasable: false` oculta un plan. `store.apple: null` o
    `store.google: null` lo quita de esa tienda. Sin `store`, se usan los identificadores de arriba (por defecto).
  - El **ahorro** («Ahorra un 13 % aprox.», «Ahorra un 33 % aprox.») y el lema los calcula la app con los precios (nunca a
    mano). Con la tienda, se muestran y calculan con **el precio real de la tienda** (local). La cinta del plan destacado
    dice «RECOMENDADO» salvo que se ponga otra en `badge` (p. ej. «Más popular», solo cuando sea cierto).
  - `alwaysFree: true` marca ventajas que también son gratis (la pantalla lo aclara, para no inducir a error).
- **Productos que hay que crear en las tiendas** (o poner los propios en `store`): App Store Connect → 3 suscripciones
  autorrenovables en **un mismo grupo** (mensual, trimestral, anual); Google Play Console → 1 suscripción
  `mediclaro_premium` con 3 planes base (`monthly`, `quarterly`, `annual`), renovación automática. Mismos precios en euros.

### R-13 · Búsqueda por nombre

- **Endpoint necesario:** `POST /functions/v1/search-medicine` (nuevo; el proveedor CIMA ya tiene `searchMedication`).
- **Método:** `POST`.
- **Request:** `{ "query": "paracetamol 1 g", "limit": 10 }`.
- **Response:** `{ "results": [ { "id", "nombre", "laboratorio", "principioActivo", "forma", "fotoUrl" } ] }` (misma tarjeta que
  `identify-medicine`).
- **Errores:** `400` búsqueda corta · `401` · `429` · `503 PROVIDER_DOWN`.
- **Pantallas que lo utilizarían:** `/add-medication` (opción «Escribir el nombre»). Hoy: foto, código de barras o C.N.
  (`MedicationService.searchMedication` devuelve «todavía no está disponible» y la UI no lo muestra).

### R-14 · Cuidadores y familiares

- **Endpoint necesario:** `POST /functions/v1/caregiver-invite`, `…/caregiver-accept`, `…/caregiver-revoke` (nuevos; la tabla
  `caregiver_links` ya existe).
- **Método:** `POST`.
- **Request:** invitación `{ "email" | "phone", "scopes": ["settings","favorites"] }` · aceptar `{ "inviteId" }` · revocar `{ "linkId" }`.
- **Response:** `{ "link": { id, status, scopes } }`.
- **Errores:** `400` · `401` · `404` invitación · `409` ya vinculado.
- **Pantallas que lo utilizarían:** beneficio Premium «Funciones familiares» (oculto), Perfil.
- **Nota:** el **aviso a un familiar en una emergencia** (`/emergency/notify`) ya funciona sin backend: abre la app de Mensajes del
  teléfono con el texto preparado y la persona pulsa Enviar.

### R-15 · `emergency-assess` (no la usa la app)

- **Endpoint:** `POST /functions/v1/emergency-assess` (existente).
- **Problemas detectados:** no llama a `Deno.serve(...)` como el resto (usa `export default`), así que conviene comprobar que
  responde tras desplegarla; y `admin.from('usage_events').insert(...).catch(...)` usa `.catch` sobre el constructor de consultas,
  que no es una promesa completa: si falla ahí, cae siempre en la respuesta de reserva.
- **Comprobación (28-09-2026):** `deno check` de las 8 funciones: todas correctas **salvo esta** —
  `TS2551: Property 'catch' does not exist on type 'PostgrestFilterBuilder…'` (línea 85).
- **Pantallas:** ninguna. El mensaje para el operador (`/emergency/voice-message`) se construye **en el teléfono, de forma
  determinista**, solo con datos declarados por la persona y con su permiso; sin diagnósticos. **Recomendación: no desplegarla.**

### R-16 · Coherencia de textos del servidor

- **Tratamiento:** la interfaz habla de **tú**; los mensajes de error, el asistente (prompt de `chat`) y el resumen de la ficha
  (prompt de `medicine-detail`) usan **usted**. La app traduce los mensajes de error conocidos
  (`src/api/functions.ts`, `MESSAGE_BY_CODE` / `MESSAGE_BY_TEXT`), pero no los textos generados por la IA. Decidir un tratamiento
  y alinear los prompts.
- **Códigos de error:** devolver siempre `code` (como `LIMIT_REACHED`, `CHAT_LIMIT`, `PROVIDER_DOWN`, `AI_DOWN`) para que la app no
  dependa del texto.
- **Descripción del producto en Stripe** (`scripts/setup-stripe.mjs`): dice «asistente ilimitada», pero `plan_config` limita
  Premium a **200 preguntas al día**. La app muestra el límite real; corregir la descripción que se ve en la página de pago.

### R-17 · Tabla duplicada `saved_medicines`

- La migración v3 crea `saved_medicines`; la app usa `saved_medications` (v2), que es la que exporta `account`. Eliminar o
  documentar la duplicada para evitar confusiones. Sin efecto en la app.

### R-18 · Beneficios Premium de la especificación sin respaldo

- «Lectura completa por voz», «Historial ampliado», «Funciones familiares/cuidador» y «Soporte prioritario» **no se anuncian**
  porque el servidor no los diferencia por plan (anunciarlos sería publicidad engañosa). Se activan en `src/config/plans.ts`
  (`enabled: true`) o desde la fila `app_config.plans.benefits` cuando existan.

### R-19 · `usage_events` y datos relacionados con la salud

- **Problema:** `chat` registra `logEvent(user.id, 'chat', 'emergency')` cuando un mensaje se deriva a emergencia: queda asociado a
  la persona que escribió algo que parecía una urgencia. `metrics.ts` dice «SIN información médica», pero este dato lo es.
- **Qué hacer:** mencionarlo en la política de privacidad, fijar un plazo de conservación (borrado periódico) o no guardar
  `user_id` en esos eventos. La exportación propuesta (R-06) ya incluye `usage_events` de la propia persona.

### R-20 · `caregiver_links`: activación sin aceptación

- **Problema:** la política «titular gestiona» (`for all`) permite a la persona titular escribir `status = 'active'` y cualquier
  `caregiver_id` sin que la otra persona acepte. Hoy no da acceso a ningún dato (no hay políticas que lo usen).
- **Qué hacer antes de construir R-14:** que solo el servidor (o la persona invitada) pueda pasar un vínculo a `active`.

---

## 3 bis. Nuevos en v1.2 (Premium y pago)

### R-21 · Cuenta sin teléfono al pagar (Supabase *Anonymous sign-ins*)

> **Estado 29-09-2026:** el frontend ya usa `signInAnonymously` y se añade `cleanup-anonymous`; falta activar Anonymous sign-ins y programar la limpieza en el proyecto Supabase real.

- **Endpoint necesario:** Supabase Auth (existente): `POST /auth/v1/signup` sin datos (`signInAnonymously`).
- **Método:** `POST`.
- **Request / Response:** sin datos → sesión con `is_anonymous: true` en el JWT.
- **Errores que la app ya trata:** `anonymous_provider_disabled` / «Anonymous sign-ins are disabled» → la app dice «Antes
  necesitamos tu teléfono» y ofrece entrar con el teléfono y **volver al pago** (probado).
- **Pantallas:** `/payment`, `/payment-card`, `/premium` («Continuar con Premium»), después `/premium-success` →
  `/complete-account` → `/verify?purpose=link` (R-02).
- **Por qué:** el propietario pidió **no pedir el teléfono antes del pago**; además, Apple pide no exigir datos personales si
  no son necesarios (5.1.1(v)). La cuenta se crea al pagar y se vuelve permanente al añadir el teléfono.
- **Qué hay que hacer:**
  1. Auth → *Allow anonymous sign-ins* (activar) **después** de aplicar R-24.
  2. Supabase recomienda CAPTCHA (hCaptcha o Turnstile) para los accesos anónimos. **La app todavía no incluye CAPTCHA**:
     si se activa, hará falta añadir el componente y la clave pública del sitio (pendiente). Mientras tanto quedan el límite
     por IP de Supabase (30 accesos anónimos por hora, ajustable) y R-24 (una cuenta sin pagar no gasta IA).
  3. Limpieza periódica de cuentas anónimas **sin suscripción** y sin actividad (p. ej. 30 días), por ejemplo
     `delete from auth.users where is_anonymous and created_at < now() - interval '30 days' and id not in (select id from
     profiles where plan = 'premium')` (revisar antes las tablas que dependen de `auth.users`).
  4. En RLS/funciones, si hiciera falta distinguirlas: `auth.jwt()->>'is_anonymous'`.
- **Aviso:** una cuenta sin teléfono se pierde si se borra la app o se cambia de móvil sin haber añadido el teléfono
  (con Apple/Google se recupera con «Restaurar compra»; con tarjeta, solo con el teléfono). Por eso la app pide el teléfono
  justo después del pago («Completa tu cuenta»), con «Ahora no» y un aviso permanente en Perfil.

### R-22 · Declarar a Apple y Google los pagos con tarjeta iniciados en la app

- **Solo si una versión de tienda ofrece la tarjeta** (`EXPO_PUBLIC_PAYMENTS_MODE` con `stripe`). La compilación `production`
  de `eas.json` usa solo la tienda.
- **Qué envía la app:** antes de abrir Stripe muestra la hoja de aviso de la tienda y pasa el token que esta devuelve a
  `create-checkout` como `externalPurchaseToken`.
- **Qué falta en el servidor:** guardar el token con la sesión de Stripe y declararlo:
  - **Apple:** *External Purchase Server API* → `Send External Purchase Report` por cada token (inicio de suscripción,
    renovaciones y reembolsos, también si no hubo compra).
  - **Google Play:** Google Play Developer API → `externaltransactions` (primera transacción con el token; renovaciones con
    `initialExternalTransactionId`).
- **Errores:** los de cada API (reintentar; no afectan a la persona).

### R-23 · Plantilla del SMS de verificación

- **Dónde:** Supabase → Authentication → SMS template.
- **Texto recomendado (58 caracteres, cabe en un solo SMS aunque lleve tildes):**
  `MediClaro: tu código es {{ .Code }}. No se lo digas a nadie.`
- **Pantallas:** `/verify` (inicio de sesión) y `/verify?purpose=link` (añadir el teléfono): tras enviar el código, una
  animación («¡Mensaje enviado!») y la «consola» del código muestran **cómo llegará el mensaje** (con el código tapado) —
  `src/config/app.ts → SMS_TEMPLATE_EXAMPLE` debe coincidir con la plantilla.
- **Autocompletar el código:** iOS lo propone solo con el aviso de «Mensajes» (la app usa `textContentType=oneTimeCode`);
  Android lo propone con `autoComplete=sms-otp`. No hace falta cambiar la plantilla para ello.

### R-24 · Funciones con IA solo para Premium también en el servidor

- **Por qué:** «La IA real (Gemini) no se utiliza en el modo gratuito». La app ya bloquea identificar, el asistente, la
  lectura por voz y Mis medicamentos sin Premium, pero la API se puede llamar directamente con la clave pública (y con R-21
  cualquiera puede crear una cuenta).
- **Integrado 29-09-2026:** `plan_config.free` queda con cuota IA 0 y `identify-medicine`, `medicine-detail` y chat farmacológico llaman a `requirePremium()` en servidor antes de usar Gemini. Responden `402 / PREMIUM_REQUIRED` cuando no hay entitlement. La emergencia se detecta y deriva antes de esa comprobación y no consume Gemini.
- **Requisitos previos:** **R-01** (si no, el servidor trataría a quien paga como gratuito y le negaría la IA; la app lo
  muestra como «Estamos confirmando tu suscripción» con «Intentar de nuevo») y que la versión publicada **venda** Premium
  (con `EXPO_PUBLIC_PAYMENTS_MODE=none` la app es gratuita con los límites del servidor: no aplicar R-24 en ese caso).
- **Emergencias:** nada de esto afecta al 112 ni al módulo de emergencia (no usan IA).

### R-25 · El teléfono ya tiene una cuenta de MediClaro (`phone_exists`)

- **Cuándo:** alguien paga sin cuenta (R-21) y en «Completa tu cuenta» escribe un número que ya tiene cuenta.
- **Qué hace hoy la app:** no vincula el número y lo explica («Este número ya tiene una cuenta de MediClaro»); la
  suscripción sigue en la cuenta de este teléfono. Si la suscripción es de Apple/Google, al entrar con la otra cuenta y
  pulsar «Restaurar compra» el servidor responderá `409` (compra de otra cuenta).
- **Qué falta (propuesta):** `POST /functions/v1/account-merge` `{ "fromAnonymousUserId" }` llamado **con la sesión de la
  cuenta del teléfono** (ya verificada por SMS) y un comprobante de la cuenta anónima (su JWT): mueve la suscripción
  (`store_subscriptions` / cliente de Stripe), guardados e historial, y borra la cuenta anónima. Respuesta `{ merged: true }`;
  errores `401`, `403` (la cuenta de origen no es anónima o no es de esta persona), `409` (las dos tienen suscripción).
- **Pantallas que lo usarían:** `/complete-account` (opción «Entrar con ese número y juntar las cuentas»).

### R-26 · Uso incluido con las suscripciones de las tiendas

- **Pago por uso (0,05 € por identificación extra):** solo existe con **tarjeta** (Stripe, medido). Con Apple o Google Play
  no se puede cobrar un importe variable fuera de su sistema: el servidor debe tratar a esas personas con `hard_cap =
  monthly_scans` (sin uso adicional) y responder `402 LIMIT_REACHED` al agotarlas. La app ya solo menciona el cargo extra a
  quien paga con tarjeta y, con la tienda, dice «Tus identificaciones incluidas se renuevan cada mes».
- **Periodo del contador:** `get_account_status` debe contar desde el inicio del periodo de la suscripción (o del mes
  natural, pero igual para todas las vías) y devolver ese dato para que el texto de renovación sea exacto.
- **Planes trimestral y anual:** el uso incluido es **mensual** («Incluye 100 identificaciones al mes»); el contador debe
  reiniciarse cada mes también en esos planes.

---

## 4. Configuración del propietario (sin programar)

| ID | Qué | Dónde | Efecto si falta |
|---|---|---|---|
| C-1 | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (públicas por diseño) | `.env` / variables de EAS, o `app.json → extra` | Al pedir el código la app responde «La aplicación todavía no está conectada al servidor de MediClaro»; solo funciona el Modo demostración (compilaciones de prueba) |
| C-2 | Secretos del servidor: `GEMINI_API_KEY` (opcional `GEMINI_MODEL`), `STRIPE_SECRET_KEY`, `STRIPE_PRICE_BASE`, `STRIPE_PRICE_METERED`, `STRIPE_METER_EVENT`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_AUTOMATIC_TAX` | `supabase secrets set …` (**nunca** en la app) | Identificación, asistente y pagos fallan en el servidor |
| C-3 | Textos legales publicados: `EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_LEGAL_NOTICE_URL` | variables de EAS | «Información legal» muestra «Pendiente de publicación» |
| C-4 | Titular (LSSI): `EXPO_PUBLIC_COMPANY_NAME`, `EXPO_PUBLIC_COMPANY_TAX_ID`, `EXPO_PUBLIC_COMPANY_ADDRESS` | variables de EAS | El aviso legal no muestra los datos del titular |
| C-5 | `EXPO_PUBLIC_SUPPORT_EMAIL` | variables de EAS | «Escribir a soporte» no aparece en Ayuda |
| C-6 | `EXPO_PUBLIC_OTP_TTL_SECONDS` = caducidad del SMS configurada en Supabase | variables de EAS | El contador del código podría no coincidir con el servidor |
| C-7 | Número de la central de MediClaro: `app_config` → `emergency.primaryAssistanceNumber` (hoy vacío) | panel de Supabase | Sin central: el botón azul solo aparece si cada usuario configura su propio número privado |
| C-8 | `EXPO_PUBLIC_DEMO_ACCESS` (`on`/`off`) | `eas.json` (ya configurado: `on` en development/preview, `off` en production) | — |
| C-11 | `EXPO_PUBLIC_PAYMENTS_MODE`: `store`, `stripe`, `store,stripe` o `none` | `eas.json` (ya configurado: `store,stripe` en development/preview, `store` en production) | Con `stripe` en una versión de tienda sin los permisos de la UE, riesgo de rechazo (R-04, R-22). Con `none`, app gratuita como la v1.1 |
| C-12 | Productos de suscripción en App Store Connect y Google Play Console (identificadores de R-12), acuerdo de apps de pago, cuentas de prueba (Sandbox / *license testers*) | Tiendas | Sin productos la compra con la tienda no aparece |
| C-13 | `app_config.plans` (R-12) con `storeVerification: true` cuando `iap-verify` esté en producción | panel de Supabase | La compra con la tienda no se ofrece (red de seguridad de R-04) |
| C-14 | Permiso de Apple *StoreKit External Purchase Link* y programa de ofertas externas de Google (solo si se ofrece la tarjeta en tienda) | Tiendas | La tarjeta no aparece en las versiones de tienda |
| C-9 | Foto de marca para la bienvenida (personas mayores) | `src/config/brandAssets.ts` → `BRAND_HERO_IMAGE` | Se muestra la ilustración vectorial de MediClaro |
| C-10 | Números de prueba de SMS para la revisión de las tiendas | Supabase Auth → Phone | Apple/Google no podrán entrar a revisar la app |

---

## 5. Contrato actual que usa el frontend (referencia, ya existe)

Todas las llamadas pasan por la capa de servicios (`src/services/*`); ninguna pantalla habla con Supabase, Stripe, CIMA ni
proveedores externos. Las Edge Functions exigen `Authorization: Bearer <JWT>` (lo añade el cliente de Supabase), aceptan solo
`POST`, limitan tamaño y peticiones por minuto, y responden errores como `{ "error": "<mensaje>", "code"?: "<CÓDIGO>" }`.

### 5.1 `identify-medicine`
- **Endpoint:** `/functions/v1/identify-medicine` · **Método:** `POST` · límite 6/min, cuerpo ≤ 3 MB.
- **Request:** `{ image?: "<JPEG en base64, ≤ 2,8 M caracteres>", barcode?: "<≤120>", cn?: "<6 cifras>" }` (al menos uno).
- **Response:**
  - `{ status: "identified", scanId, best: Tarjeta, others: Tarjeta[] }`
  - `{ status: "ambiguous", scanId, reason, candidates: Tarjeta[] }`
  - `{ status: "not_found", reason: "blurry" | "multiple_items" | "no_match", message }`
  - `Tarjeta = { id (nregistro), score (0–100), nombre, laboratorio, principioActivo, forma, fotoUrl }`
- **Errores:** `400` falta foto/código o foto demasiado grande · `401` · `402 LIMIT_REACHED` · `413` · `429` · `503 PROVIDER_DOWN` · `500`.
- **Pantallas:** `/scan` y `/add-medication` → `/processing` → `/candidates` / `/result`.

### 5.2 `medicine-detail`
- **Endpoint:** `/functions/v1/medicine-detail` · **Método:** `POST` · límite 20/min.
- **Request:** `{ id: "<nregistro>" }`.
- **Response:** `{ medicine: MedicationSummary, simple: { paraQue, comoSeToma, avisos[], conservacion, generatedFrom, aiAssisted } | null, leaflet: Seccion[], leafletUrl, sheetUrl }`.
- **Errores:** `400` id no válido · `401` · `404` no encontrado en la base oficial · `429` · `503 PROVIDER_DOWN`.
- **Pantallas:** `/result`, `/medication/[id]`, `/voice`; imagen del envase en `/candidates`, `/medicines`, `/saved/[id]`
  (la app limita estas consultas a 8/min para respetar el límite del servidor).

### 5.3 `chat`
- **Endpoint:** `/functions/v1/chat` · **Método:** `POST` · límite 12/min, cuerpo ≤ 32 KB.
- **Request:** `{ messages: [{ role: "user" | "assistant", content: "<≤1000>" }] (≤10, alternados, termina en user), medicineId?: "<nregistro>" }`.
- **Response:** `{ reply, sourceUrl }` o, ante una posible urgencia, `{ emergency: true, resources: [{ label, phone }] }`.
- **Errores:** `400` sin pregunta · `401` · `402 CHAT_LIMIT` · `429` · `503 AI_DOWN`.
- **Pantallas:** `/chat` (pestaña), `/assistant?medicationId=…` (con contexto). Ante `emergency` la app muestra el 112 en rojo
  y los recursos devueltos; nunca llama sola.

### 5.4 `create-checkout`
- **Endpoint:** `/functions/v1/create-checkout` · **Método:** `POST` · límite 5/min.
- **Request:** `{ returnUrl: "mediclaro://payment-result" }` (debe empezar por `mediclaro://`, `exp://` o `https://`).
  v1.2: además `planId` (solo si `app_config.plans.checkoutAcceptsPlanId`) y `externalPurchaseToken` (si la tienda lo da).
  Hoy el servidor ignora los campos que no conoce, así que enviarlos no rompe nada.
- **Response:** `{ url }` (Stripe Checkout; vuelve con `?ok=1` o `?cancel=1`).
- **Errores:** `400` URL de retorno no válida · `401` · `409` ya tiene suscripción activa (la app lo trata como «ya
  activa») · `429` · `500`.
- **Pantallas:** `/payment-card` («Pagar 39,99 €») → página segura de Stripe dentro de la app → `/premium-success`
  (o `/payment-result` en la vuelta por enlace).

### 5.5 `customer-portal`
- **Endpoint:** `/functions/v1/customer-portal` · **Método:** `POST` · límite 5/min.
- **Request:** `{ returnUrl: "mediclaro://premium" }`.
- **Response:** `{ url }` (portal de Stripe: tarjeta, facturas, cancelar).
- **Errores:** `400` · `401` · `404` sin suscripción · `429`.
- **Pantallas:** `/premium` con suscripción («Gestionar suscripción», solo si se pagó con tarjeta; con Apple/Google se abre la
  gestión de la tienda).

### 5.6 `account`
- **Endpoint:** `/functions/v1/account` · **Método:** `POST` · límite 3/min.
- **Request:** `{ action: "export" }` · `{ action: "delete", confirm: "ELIMINAR" }`.
- **Response:** exportación `{ exportedAt, email, profile, history, myMedications, consents }` (la propuesta R-06 añade
  `phone, emergencyProfile, caregivers, usageEvents, securityLog`) · borrado `{ deleted: true }` (cancela la suscripción de
  Stripe y borra el usuario en cascada).
- **Errores:** `400` acción o confirmación no válida · `401` · `429` · `500`.
- **Pantallas:** `/account`, `/privacy`, `/profile`. Tras borrar, la app elimina también lo que de esa cuenta vivía solo en el
  teléfono y vuelve a `/welcome`.

### 5.7 Base de datos (REST con RLS del propio usuario)

| Recurso | Método | Request | Response | Errores | Pantallas |
|---|---|---|---|---|---|
| RPC `get_account_status()` | `POST /rest/v1/rpc/get_account_status` | — | `{ plan, state, period_end, scans_this_period, included_scans, free_scans_left, settings{display_name, font_size, easy_mode, speech_rate, locale, onboarded, country} }` | `401`, JWT caducado | `/`, `/history`, `/premium`, `/profile`, `/account`, preferencias al iniciar sesión |
| RPC `update_my_settings(p)` | `POST /rest/v1/rpc/update_my_settings` | `{ p: { display_name?, font_size?, easy_mode?, speech_rate?, onboarded? } }` | vacío | `401`, `23514` valor fuera de rango | `/accessibility`, `/easy-mode`, `/voice` (velocidad), `/account` (nombre), `/onboarding` |
| `profiles` (fila propia) | `GET` | `select=plan,subscription_status,current_period_end,billing_provider,cancel_at_period_end` | fila | `401` | `/`, `/premium`, `/payment`, `/payment-card`, `/payment-result`, `/premium-success`, `/profile`, `/account`, `/history` y el bloqueo de las funciones Premium |
| `consents` | `POST` | `{ user_id, kind: "ai_processing", version: "ia-2026-09@<fecha ISO>", granted }` | `201` | `401`, `23505` (ya registrado: la app lo da por bueno), RLS | Permiso para la IA (antes de `/scan`, `/chat`, `/assistant`) y `/privacy` |
| `plan_config` | `GET` | `select=plan,monthly_scans,overage_enabled,hard_cap,chat_per_day` | filas `free` y `premium` | — | `/premium`, `/payment`, `/payment-result` |
| `app_config` | `GET` | `key=eq.plans` (opcional, R-12) · `key=eq.emergency` | `{ value }` | — | `/premium`, `/payment`, `/payment-card`, `/legal`, bloqueo Premium (R-04) · `/emergency/*`, `/private-assistance` |
| `saved_medications` | `GET` / `POST` (upsert `user_id,nregistro`) / `PATCH` (`favorito`) / `DELETE` | `{ user_id, nregistro, nombre, principio_activo, presentacion, favorito? }` | filas | `401`, RLS | `/medicines`, `/saved/[id]`, `/result`, `/medication/[id]`, `/voice` |
| `scans` | `GET` | `select=id,nregistro,nombre,confidence,created_at,status,method` (100 últimos) | filas | `401` | `/history` |
| `emergency_profiles` | `GET` / `POST` (upsert `user_id`) / `DELETE` (fila propia) | columnas existentes (sin `phone` ni `additional_info`, ver R-05) | fila | `401`, `PGRST116` (sin perfil → «Crear mi perfil») | `/emergency-profile` (incluye «Borrar mi perfil de emergencia»), `/emergency-profile-edit`, `/emergency-sharing`, `/emergency/*` |
| Auth | `POST /auth/v1/otp`, `/verify`, `/token?grant_type=refresh_token`, `/logout`, `/signup` (anónimo, R-21), `PUT /auth/v1/user` (`{ phone }`, añadir teléfono) + `/verify` con `type: "phone_change"` | ver R-02 | sesión | ver R-02, R-21, R-25 | `/login`, `/verify`, `/complete-account`, `/profile`, `/account`, `/privacy`, `/payment`, franja de acceso de prueba, «Restaurar compra» |
| Función `iap-verify` (nueva, R-04) | `POST /functions/v1/iap-verify` | ver R-04 | `{ isPremium, plan, provider, currentPeriodEnd }` | `400`, `401`, `409`, `429`, `5xx` | `/payment`, `/premium`, `/premium-success`, «Restaurar compra» |

---

## 6. Arreglos probados de origen (`backend-patches/`) e integración final

| Archivo | Requisitos | Pruebas |
|---|---|---|
| `migrations/20260928090000_r01_sub_state_sync.sql` | R-01 | Estados de Stripe → `sub_state`; límites Premium; uso adicional; corrección de cuentas existentes; nadie se da Premium a sí mismo |
| `migrations/20260928090100_r05_emergency_profile_columns.sql` | R-05 | Guardar/leer columnas nuevas; aislamiento entre personas; borrar el perfil |
| `migrations/20260928090200_r07_scans_history_clear.sql` | R-07 | Sin borrado directo; `clear_scan_history()` borra el contenido y conserva la cuota; solo filas propias |
| `migrations/20260928090300_r09_r10_account_status.sql` | R-09, R-10 | Preguntas de hoy y restantes; día de España; emergencias no gastan; `can_chat` coherente; compatibilidad |
| `functions/stripe-webhook/` (+ `.diff`) | R-01, R-10 | Original frente a propuesta: `sub_state`, cancelación, eventos que antes se perdían |
| `functions/account/` (+ `.diff`) | R-06 | Exportación completa, sin datos de otras personas, error en vez de archivo incompleto |

Resultados de la propuesta original (28-09-2026): **39/39** pruebas de migraciones (PostgreSQL 18 en memoria, PGlite) y **21/21** de funciones (Deno 2,
con `deno check` de tipos contra los módulos reales). Cómo repetirlas y cómo aplicarlas: `backend-patches/README.md`.

## 7. Nuevos el 09/10/2026 (RC-2026-10-09) — preparados y probados, los aplica el propietario

Todo es **aditivo e idempotente** (no cambia tablas, políticas ni funciones existentes salvo las indicadas) y sin
claves en el código. Detalle funcional y técnico de «Mis pastillas»: `MIS_PASTILLAS.md`.

| Pieza | Qué es | Cómo se aplica |
|---|---|---|
| `migrations/20261008200000_premium_unlimited_scans.sql` | Premium con identificaciones ilimitadas (si no se aplicó el 08/10) | `npx supabase db push` |
| `migrations/20261009100000_bizum_and_family_payments.sql` | `profiles.paid_by_family`, `family_pay_invites` (solo servidor; del enlace solo se guarda su SHA-256), cron que devuelve a gratuito al acabar un periodo pagado con Bizum, `get_account_status` con `payment_kind` y `paid_by_family` | `npx supabase db push` |
| `migrations/20261009120000_medication_plans.sql` | «Mis pastillas»: 8 tablas con RLS (la app solo lee), RPC `medication_*` con usuario, permisos, Premium y límite de peticiones, idempotencia por UUID del teléfono, versión para conflictos, una sola resolución por toma, correcciones trazables, permisos del cuidador/a, cola de avisos y cron cada 10 min | `npx supabase db push` (necesita `pg_cron`) |
| `functions/create-checkout` | Formas de pago `bizum` (pago único del periodo, API de Stripe `2026-05-27.dahlia`), `sepa` (`sepa_debit`) y `paypal` para la suscripción mensual | `npx supabase functions deploy create-checkout` |
| `functions/stripe-webhook` | Activa Premium tras Bizum hasta la fecha pagada y tras el pago de un familiar | `npx supabase functions deploy stripe-webhook` |
| `functions/family-pay` (nueva) | Enlace seguro de pago para un familiar (7 días, un solo uso) | `npx supabase functions deploy family-pay --no-verify-jwt` |
| `functions/chat` | Nombre del asistente (`_shared/assistant.ts`), respuestas deterministas sobre las tomas («¿Me he tomado…?») y contexto breve de la pauta; nunca indica dosis ni recomienda por su cuenta medicamentos que la persona no toma | `npx supabase functions deploy chat` |
| `functions/caregiver-dispatch` | Envía también los avisos de tomas sin confirmar (sin el nombre del medicamento); si las tablas no existen, sigue como antes | `npx supabase functions deploy caregiver-dispatch` |
| `functions/tts-preview` | Texto permitido nuevo: la explicación en una sola toma (para regenerar la voz de una vez); el modelo de voz de respaldo también habla en español de España | `npx supabase functions deploy tts-preview` |
| `functions/tts` | El modelo de voz de respaldo (si falla el principal) recibe la indicación de español de España en el propio texto (forma documentada «Say …: texto») | `npx supabase functions deploy tts` |

Configuración (sin programar): activar Bizum, SEPA y PayPal en Stripe solo si se quieren ofrecer y anunciarlos en
`app_config.plans` (`bizum`, `familyPay`, `sepaDebit`, `paypal` = `true`); variables opcionales `STRIPE_PRICE_QUARTERLY`,
`STRIPE_PRICE_ANNUAL`, `FAMILY_PAY_PUBLIC_URL`, `FAMILY_PAY_DONE_URL` (ver `.env.example`).

Pruebas (09/10/2026, sin red ni claves): migración de «Mis pastillas» en PostgreSQL en memoria (PGlite) →
`MIGRACION_MIS_PASTILLAS=OK` (`backend-patches/tests/sql/medication_plans.test.mjs`); funciones con dobles de
Supabase/Stripe → **16/16** (`backend-patches/tests/functions/payments.test.ts` y `medication.test.ts`); `deno check`
de `chat`, `caregiver-dispatch`, `tts-preview`, `family-pay`, `create-checkout` y `stripe-webhook` → OK.

## 8. Nuevos el 09/10/2026 por la tarde — chat y llamadas con el cuidador/a (los aplica el propietario)

| Pieza | Qué es | Cómo se aplica |
|---|---|---|
| `migrations/20261009150000_care_chat_and_calls.sql` | Chat permanente entre la persona Premium y su cuidador/a (`care_chat_messages`, avisos `care_chat_push_jobs`) y llamadas de voz (`care_link_calls`, avisos `care_call_push_jobs`). Solo RPC `care_chat_action` y `care_call_action` (sin acceso directo a las tablas), Premium de la persona cuidada para escribir y llamar, idempotencia por UUID, límite de peticiones, 90 días de conservación y cron de limpieza | `npx supabase db push` |
| `functions/caregiver-dispatch` | Envía también «X te ha escrito» (sin el texto) y «X te está llamando» (caduca a los 45 s) | `npx supabase functions deploy caregiver-dispatch` |
| `functions/caregiver-rtc-config` | Credenciales TURN también para una conversación aceptada con Premium (`linkId`), además de los avisos | `npx supabase functions deploy caregiver-rtc-config` |

Pruebas: `backend-patches/tests/sql/care_chat.test.mjs` → `MIGRACION_CHAT_Y_LLAMADAS_CUIDADOR=OK`;
`backend-patches/tests/functions/care_chat.test.ts` (dentro de las 21 pruebas Deno OK).

## 9. Panel del propietario (09/10/2026) — lo aplica el propietario

| Pieza | Qué es | Cómo se aplica |
|---|---|---|
| `migrations/20261009170000_owner_admin_panel.sql` | `public.owner_admin(acción, datos)`: código de 6 cifras (bcrypt, bloqueo de 15 min tras 5 fallos), sesión del panel (15 min sin uso, 8 h máximo), permisos de Face ID por dispositivo (90 días), bonos (`owner_bonos`, `owner_bono_uses`) sobre el Premium de cortesía existente, usuarios, ficha, suscripciones, estadísticas, registro, aviso general, estado del sistema y copias. Nuevo `public.app_notice()` (lectura pública del aviso). Tablas en `mediclaro_private` sin acceso desde la API; todo queda en `audit_log`. No cambia `is_premium()` ni las funciones antiguas del panel | `npx supabase db push` (después de la del chat) |

Acciones de `owner_admin`: `status`, `setup_pin`, `unlock`, `unlock_device` (sin sesión del panel) y, con ella,
`lock`, `overview`, `users`, `user`, `grant`, `revoke`, `bonos`, `bono_create`, `bono`, `bono_disable`, `bono_enable`,
`subscriptions`, `stats`, `audit`, `notice_get`, `notice_set`, `system`, `export`, `account`, `devices`,
`device_revoke`, `trust_device`, `change_pin`. Errores: `AUTH_REQUIRED`, `OWNER_REQUIRED`, `OWNER_LOCKED`, `RATE_LIMIT`,
`PIN_WEAK`, `PIN_ALREADY_SET`, `PIN_SAME`, `INVALID_PHONE`, `USER_NO_PHONE`, `BONO_EXHAUSTED`, `BONO_DISABLED`,
`BONO_ALREADY_USED`, `INVALID_NAME`, `INVALID_USES`, `INVALID_NOTICE`, `TOO_MANY_BONOS`, `NOT_FOUND`,
`INVALID_REQUEST`, `INVALID_RANGE`, `INVALID_ACTION`. Los fallos de código devuelven `{ ok: false, error, attemptsLeft
| lockedUntil }` (no excepción) para que el bloqueo quede guardado.

Pruebas: `backend-patches/tests/sql/owner_admin.test.mjs` → `MIGRACION_PANEL_PROPIETARIO=OK`. Pasos, restablecer el
código, añadir teléfonos de propietario y cerrar las funciones antiguas: `PANEL_PROPIETARIO.md` §6.


## 10. Nuevos el 09/10/2026 por la noche — ventana del chat y propietarios (los aplica el propietario)

| Pieza | Qué es | Cómo se aplica |
|---|---|---|
| `migrations/20261009190000_care_chat_window.sql` | **El chat lo enciende la persona cuidada.** `mediclaro_private.care_chat_open_until(link)` = último mensaje de texto de la persona cuidada en la última hora + 1 h. La conversación (`care_chat_conversation_json`) devuelve además `premium`, `openUntil` y `canSend` (persona cuidada: siempre con Premium; cuidador/a: solo mientras hay ventana). `care_chat_action('send')` rechaza con **`CHAT_CLOSED`** si el cuidador/a escribe apagado (la respuesta repetida de un envío que ya entró, por `clientKey`, sigue devolviéndose). Las llamadas no abren ni cierran la ventana. Aditiva: redefine solo esas dos funciones; tablas, RLS y el resto de acciones sin cambios | `npx supabase db push` (después de `20261009150000`) |
| `migrations/20261009191000_owner_phones_antonio_marina.sql` | Propietarios: deja habilitadas exactamente las huellas SHA-256 de `34680127015` (Antonio) y `34646350527` (Marina) y desactiva cualquier otra fila de `mediclaro_private.owner_phones`. Sin teléfonos en claro | `npx supabase db push` |

Pruebas: `backend-patches/tests/sql/care_chat_window.test.mjs` → `MIGRACION_VENTANA_CHAT_CUIDADOR=OK` (apagado al
principio, se enciende 1 h cuando ella escribe, el cuidador/a no la alarga, se apaga a la hora, una llamada no lo
enciende, reintento idempotente, sin Premium nada cambia); `backend-patches/tests/sql/owner_phones.test.mjs` →
`MIGRACION_PROPIETARIOS=OK`. Las dos se pueden aplicar dos veces sin error.

Código de error nuevo que entiende la app: `CHAT_CLOSED` («El chat está apagado: se enciende cuando la persona a la
que cuidas te escribe, durante 1 hora»).
