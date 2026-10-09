# MediClaro — Guía para comercializar la app (v1.2 · 28-09-2026)

Qué está listo, qué decisiones son **solo del titular** y en qué orden hacerlo para publicar en **App Store** y
**Google Play**. Resume las normas de Apple, Google, Google Gemini, Supabase y la AEMPS consultadas en sus páginas
oficiales (fuentes al final, con fecha de consulta 27/28-09-2026).

> **No es asesoramiento jurídico.** Los puntos legales (producto sanitario, protección de datos, condiciones de Gemini)
> deben revisarse con un abogado. No se citan artículos de ley: donde haga falta, está marcado **[VERIFICAR]**.

---

## 1. En resumen

- **v1.2:** la app ya incluye **MediClaro Premium con la compra integrada de Apple y Google Play** (planes mensual 4,99 €,
  trimestral 12,99 € y anual 39,99 €), las pantallas de bienvenida, explicación, planes, forma de pago, confirmación y
  «Completa tu cuenta». La compilación `production` vende **solo con la tienda** (`EXPO_PUBLIC_PAYMENTS_MODE=store`).
- **Integración 29-09-2026:** el código del servidor ya incluye `iap-verify`, notificaciones Apple/Google, catálogo de planes, limpieza de cuentas anónimas y bloqueo de IA a no-Premium. Para cobrar de verdad aún faltan las **acciones externas del titular**: desplegar migraciones/funciones, configurar secretos y SMS/Anonymous sign-ins, crear productos/acuerdos en App Store Connect y Play Console y superar Sandbox/License Testing.
- **Red de seguridad:** mientras el servidor no compruebe compras (`storeVerification` distinto de `true`), la versión de
  tienda **no vende, no bloquea nada y no anuncia Premium**: funciona como la gratuita de la v1.1. Se puede publicar así y
  activar la venta después sin enviar otra versión (solo cambiando `app_config.plans`), aunque lo recomendable es salir
  ya con la compra funcionando (ver 6).
- La tarjeta con Stripe queda **preparada pero apagada** en tienda: solo tiene sentido en la UE/EEE con los permisos de
  Apple y Google (opción C) y R-22.
- Antes de publicar hay **seis cosas que solo puede hacer el titular** (apartado 2).

---

## 2. Lo que solo puede hacer el titular (bloquea la publicación)

| # | Qué | Por qué | Preparado en |
|---|---|---|---|
| 1 | **Publicar como empresa** (persona jurídica) con número **D-U-N-S** | Apple: las apps de ámbitos muy regulados, **incluida la salud**, «should be submitted by a legal entity that provides the services, and not by an individual developer» (norma 5.1.1(ix)). Google Play: las **apps de salud** («Medical apps») deben publicarse con **cuenta de organización**, que exige D-U-N-S. | — |
| 2 | **Cuentas**: Apple Developer Program (organización) y Google Play Console (organización). En App Store Connect, declarar el estado de **comerciante** (UE). | Requisito para publicar. | `store/CLASIFICACION_Y_REVISION.md` §6 |
| 3 | **Textos legales** revisados y publicados en una web: privacidad, condiciones y aviso legal. URL de soporte y URL web para pedir la **eliminación de la cuenta** (Google). | Las dos tiendas piden la URL de privacidad; la app enlaza a los textos. | `legal/` (borradores con huecos `[PENDIENTE]`) |
| 4 | **Backend**: SMS activado con **números de prueba** para los revisores (R-02), funciones desplegadas (R-03), región **UE** de Supabase, y aplicar los arreglos (R-01 imprescindible antes de cobrar). | Sin SMS nadie puede entrar; sin R-01 quien pague recibe los límites gratuitos. | `BACKEND_REQUIREMENTS.md`, `backend-patches/` (probados, sin aplicar) |
| 5 | **Evaluación de producto sanitario** (reglamento europeo) → declaración de Apple (Sí/No) y declaración de apps de salud de Google. **[VERIFICAR con experto regulatorio]** | Apple exige la declaración a las apps de categoría Médica o con información médica «frecuente» y la **muestra en la ficha** (EEE, Reino Unido y EE. UU.) desde el 26-03-2026. Google la exige a todas las apps. | `store/CLASIFICACION_Y_REVISION.md` §3 y §4 |
| 6 | **Revisión de las condiciones de Gemini** (ver 4.1). **[VERIFICAR]** | Las condiciones prohíben usarlo «to provide medical advice». | — |

---

## 3. Cobro de Premium

**Cómo está en la v1.2.** Implementada la **opción B** (compra integrada de Apple y Google) y preparada la **C** (tarjeta con
Stripe al lado de la compra integrada, solo donde las tiendas lo permitan). La compilación `production` usa solo B.

**Por qué la compra integrada.**

- **Apple 3.1.1:** para desbloquear funciones o suscripciones «you must use in-app purchase»; y hay que ofrecer un
  mecanismo para **restaurar** las compras (hecho: «Restaurar compra» en bienvenida, planes y forma de pago).
- **Apple 3.1.2(c):** antes de suscribirse hay que describir con claridad qué se obtiene por el precio (hecho: planes,
  ventajas, «Incluye 100 identificaciones al mes», renovación y cancelación junto al botón). Apple pide además que en el
  flujo de compra **el importe que se cobra sea el precio más destacado** (hecho: 39,99 € en grande, el ahorro aparte) y
  que la app y los metadatos enlacen las **condiciones de uso** y la **política de privacidad** (hecho en la app; en la
  ficha, ver `store/FICHA_TIENDAS.md`).
- **Apple 5.1.1(v):** no exigir datos personales si no son necesarios (hecho: se paga sin registrarse; el teléfono se
  pide después y se puede dejar para más tarde).
- **Apple, UE, desde el 01-10-2026:** se pueden ofrecer pagos alternativos o enlaces a una web solo con el permiso
  *StoreKit External Purchases or Offers Entitlement*, la hoja de aviso del sistema y **«Apple In-App Purchase must be
  presented as an option at the same time»**. Comisión de lo vendido en los 7 días siguientes al enlace: **15 %** (10 % en el
  programa para pequeñas empresas o desde el segundo año de suscripción). Los pagos así hechos hay que **declararlos** a
  Apple (*External Purchase Server API*).
- **Google Play, EEE:** Stripe solo dentro de sus programas (elección de facturación, facturación alternativa u ofertas
  externas), integrando sus API y **declarando cada transacción** (`externaltransactions`); en el programa de elección hay
  que ofrecer también Google Play Billing. Desde el 30-06-2026 las suscripciones pagan un **10 %** de comisión de servicio;
  con Google Play Billing se añade un **5 %** de facturación en el EEE.

**Opciones**

| Opción | Qué supone | Comisión (suscripción) | Estado en la v1.2 |
|---|---|---|---|
| **A. Salir gratis** | Solo el plan gratuito con los límites del servidor. | 0 | Disponible con `EXPO_PUBLIC_PAYMENTS_MODE=none` (y, en la práctica, es lo que hace la red de seguridad mientras no haya `iap-verify`) |
| **B. Compra integrada** de Apple y de Google | Premium como suscripción de cada tienda (3 planes en un mismo grupo). | Google: 10 % + 5 % de facturación (EEE). Apple: **[VERIFICAR en App Store Connect]** con los términos de la UE del 01-10-2026. | **Hecho en la app** (perfil `production`). Falta el servidor (R-04, R-12, R-21, R-24) y los productos (C-12) |
| **C. Tarjeta con Stripe + compra integrada al lado** | Las dos vías a la vez, con la de la tienda igual de visible. | Apple: 15 % (10 %) de lo vendido en 7 días tras el enlace. Google: 10 %. | **Preparada** en la app (hoja de aviso, token, página segura). Falta: permisos de Apple y Google (C-14) y declarar los pagos (R-22) |

**Recomendación** (criterio propio, no norma): salir con **B**. El pago por uso (0,05 € por identificación extra) no existe
con la tienda: Premium de precio fijo con 100 identificaciones al mes (R-26). **C** solo si las comisiones compensan el
trabajo de R-22.

---

## 4. Riesgos y cómo están cubiertos

### 4.1 Condiciones de Google Gemini (IA)
- Texto literal: **«You may not use the Services in clinical practice, to provide medical advice, or in any manner that
  is overseen by or requires clearance or approval from a medical device regulatory agency.»**
- Cobertura actual: la IA solo **explica la información oficial** del prospecto (CIMA · AEMPS); el asistente no
  diagnostica, no receta ni cambia tratamientos (instrucciones del servidor) y remite al médico o farmacéutico; la app lo
  recuerda siempre bajo el asistente («La IA no sustituye la opinión de un médico o farmacéutico») y en la ficha
  («Resumen elaborado con IA a partir del prospecto oficial»).
- Riesgo que queda: interpretación contractual → **revisión legal [VERIFICAR]**. Si se concluye que no encaja, cambiar
  de proveedor de IA solo afecta al backend (la app no conoce el proveedor).
- Datos: en el EEE, Google aplica a todo el uso las condiciones de datos del nivel de pago (**no usa los datos para
  mejorar sus productos**) y conserva registros **55 días** solo para detectar abusos. La app lo explica en el permiso.
- Las condiciones de la API exigen que quien la usa (el titular) sea mayor de 18 años.

### 4.2 Producto sanitario
- Apple: declaración obligatoria «Sí/No» para la categoría Médica o con información médica «frecuente»; si es «Sí», pide
  SRN de EUDAMED, instrucciones de uso, finalidad prevista e información de seguridad.
- Google: declaración de apps de salud para todas las apps; si **no** es producto sanitario, la descripción debe decir
  que la app «not a medical device and does not diagnose, treat, cure, or prevent any medical condition» y recordar
  consultar a un profesional (ya incluido en `store/FICHA_TIENDAS.md`).
- La finalidad que usa toda la documentación es: **información sobre medicamentos a partir de fuentes oficiales, sin
  diagnóstico ni tratamiento**. La conclusión («no es producto sanitario») la tiene que firmar un experto **[VERIFICAR]**.

### 4.3 Revisión médica de Apple (norma 1.4.1)
«Medical apps that could provide inaccurate data or information […] may be reviewed with greater scrutiny.» La app cita
la fuente oficial con la frase literal que exige la AEMPS y la **fecha** de obtención, marca los resúmenes de IA y nunca
presenta un texto de la IA como texto de la AEMPS.

### 4.4 Emergencias
La app **nunca llama sola**: abre el marcador y la persona pulsa. El **112** siempre visible y separado del servicio
privado de asistencia de cada persona. Para la revisión, usar un número de prueba en el servicio privado, nunca uno real.

### 4.5 Datos de salud y personas mayores
- Datos sensibles cifrados en el teléfono (llavero de iOS / Keystore de Android); en el servidor, cada persona solo accede
  a lo suyo (probado con los parches de `backend-patches/`).
- Permiso explícito para la IA, registrado con fecha; «Descargar mis datos» completo; eliminar la cuenta y borrar el
  perfil de emergencia desde la app.
- Pendiente del titular **[VERIFICAR con abogado]**: evaluación de impacto (EIPD), registro de actividades, contratos de
  encargo con Supabase (su DPA forma parte de sus términos), Google, Stripe y el proveedor de SMS; región UE de Supabase.

### 4.6 Uso de los datos de la AEMPS
Aviso legal del Nomenclátor: toda utilización debe incluir «Fuente de la información: Agencia Española de Medicamentos
y Productos Sanitarios www.aemps.gob.es», la **fecha de obtención** y no se pueden «Transformar o modificar los datos y
atribuírselos a la AEMPS». Hecho en la ficha del medicamento (probado).

### 4.7 Coste de IA y abusos
Límites por plan en `plan_config` con tope absoluto. Fallo encontrado: borrando el historial por la API se reiniciaba
la cuota (R-07) → corregido en `backend-patches/` (probado, sin aplicar). **v1.2:** con cuentas sin teléfono (R-21) cualquiera
podría crear cuentas con la clave pública: por eso **R-24** (sin Premium, nada de IA en el servidor) va antes de activar
R-21. Supabase recomienda además CAPTCHA para los accesos anónimos (la app aún no lo incluye).

### 4.8 Personas mayores y pagos
- Nunca se cobra dos veces: con Premium activo, las pantallas de pago dicen «Ya tienes una suscripción activa»; si no se
  puede comprobar, los planes avisan de no volver a pagar.
- La confirmación («¡Bienvenido a MediClaro Premium!») solo aparece cuando el servidor confirma el pago.
- «Cancela cuando quieras. Sin permanencia.» y el precio con su periodo siempre junto al botón; cancelar se explica en
  Ayuda y en las condiciones de suscripción.
- Las emergencias y el 112 **nunca** dependen de pagar.

---

## 5. Hecho en la app para pasar la revisión (v1.1 + v1.2)

| Requisito | Estado |
|---|---|
| **v1.2** Compra integrada (Apple 3.1.1 / Google Play Billing), «Restaurar compra», precio cobrado como elemento principal, condiciones y privacidad junto al botón (3.1.2(c)), sin registro antes de pagar (5.1.1(v)) | Hecho · probado con compras simuladas; **falta la ronda en Sandbox** con `iap-verify` |
| **v1.2** Sin tarjeta ni enlaces a pagos externos en `production` (solo la tienda) | Hecho · configuración de `eas.json` y prueba de la compilación «solo tienda» |
| **v1.2** Red de seguridad: sin comprobación de compras en el servidor, nada bloqueado ni anunciado | Hecho · probado |
| Sin compras en la variante `none` (Apple 3.1.1, Google Payments) | Hecho · probado en todas las pantallas |
| Sin «Entrar sin verificar» ni Modo demostración en `production` (el código de demostración no entra en el paquete) | Hecho · comprobado en las compilaciones iOS y Android |
| Permiso explícito antes de enviar fotos o preguntas a Gemini (Apple 5.1.2(i)); retirable; alternativa sin IA (código de barras / C.N.) | Hecho · probado |
| Eliminar la cuenta dentro de la app (Apple 5.1.1(v)) | Hecho |
| Borrar el perfil de emergencia sin eliminar la cuenta; «Descargar mis datos» completo | Hecho · probado |
| Fuente AEMPS literal con fecha; resumen de IA identificado | Hecho · probado |
| Permisos mínimos: cámara, fotos y ubicación solo «mientras se usa» (sin micrófono ni segundo plano); manifiesto de privacidad de iOS; `usesNonExemptEncryption=false` | Hecho · comprobado en la configuración generada |
| Android: nivel de API objetivo **36** (Google Play lo exige a apps nuevas y actualizaciones desde el 31-08-2026) | Cumple (valor de React Native 0.86) |
| iOS: compilar con **Xcode 26 o posterior / SDK de iOS 26** (obligatorio desde el 28-04-2026) | Comprobar la imagen de EAS Build al compilar |
| Textos de las fichas, privacidad de las tiendas, clasificación por edades (Apple 16+, IARC), notas para el revisor | `store/` |
| Capturas de pantalla (iPhone 6,9" y 6,5"; Android 9:16), gráfico destacado de Google Play (1024×500) e icono de 512 px, sin transparencia | `store/capturas/` |

---

## 6. Orden recomendado

1. Empresa y D-U-N-S → cuentas de organización en Apple y Google. Firmar el **acuerdo de apps de pago** (Apple) y el perfil
   de pagos (Google), con datos bancarios y fiscales.
2. Supabase en **región UE**: aplicar `backend-patches/` (R-01 imprescindible) primero en un proyecto de pruebas; SMS con
   números de prueba y plantilla (R-02, R-23); desplegar funciones; secretos del servidor (`BACKEND_REQUIREMENTS.md` §4).
3. **Servidor de compras:** R-24 (IA solo para Premium) → `iap-verify` y notificaciones de Apple (*App Store Server
   Notifications V2*) y Google (*Real-time developer notifications*) (R-04) → *Anonymous sign-ins* (R-21) → fila
   `app_config.plans` (R-12) con `storeVerification: true` cuando todo esté probado en Sandbox.
4. **Productos:** App Store Connect → un grupo de suscripciones con 3 suscripciones autorrenovables
   (`com.mediclaro.app.premium.monthly`, `.quarterly`, `.annual`) a 4,99 €, 12,99 € y 39,99 €, con su nombre, descripción y
   captura de revisión (la pantalla de planes). Play Console → suscripción `mediclaro_premium` con planes base `monthly`,
   `quarterly` y `annual`. Cuentas de prueba: Sandbox (Apple) y *license testers* (Google).
5. Abogado y experto regulatorio: textos de `legal/` (incluidas las **condiciones de la suscripción** y el desistimiento
   **[VERIFICAR]**), producto sanitario, condiciones de Gemini, EIPD. Publicar las URL y ponerlas en EAS
   (`EXPO_PUBLIC_TERMS_URL`, `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_LEGAL_NOTICE_URL`).
6. Variables públicas de EAS: `EXPO_PUBLIC_SUPABASE_URL` y `EXPO_PUBLIC_SUPABASE_ANON_KEY` (nunca claves secretas).
7. `eas build --profile production --platform all` (con `EXPO_PUBLIC_PAYMENTS_MODE=store`).
8. Ronda en dispositivos con compras de Sandbox (`FRONTEND_AUDIT.md` §7).
9. App Store Connect y Play Console: ficha (con la suscripción explicada y los enlaces legales), privacidad (historial de
   compras), edades, declaraciones de salud, acceso para la revisión (número de prueba **con Premium activo**), capturas;
   **enviar la primera suscripción junto con la versión**.
10. Seguir costes, uso y compras en `usage_events`, la vista `admin_kpis` y los paneles de las tiendas.

---

## 7. Lo que no se ha podido confirmar

- La comisión de la **compra integrada de Apple en la UE** con los términos del 01-10-2026.
- Cómo prueba las compras el equipo de revisión de **Google Play** (en Apple, los revisores compran en Sandbox).
- Si el derecho de desistimiento de 14 días aplica a la suscripción tal como se presta **[VERIFICAR con abogado]**.
- Si el cargo de 0,05 € por identificación extra contaría para Google como suscripción (10 %) o como otro producto (20 %).
- La opción de **números de teléfono de prueba** en el panel de Supabase solo aparece en una discusión de 2023 de su
  GitHub; sí existe en su API de gestión (`sms_test_otp`, `sms_test_otp_valid_until`).
- En la tabla de capturas de Apple, la fila de 6,9" incluye la nota «Support for uploading assets for this device in App
  Store Connect will be available later this year»: por eso se entregan también las de 6,5", que Apple exige si no hay
  de 6,9".

---

## Fuentes (consultadas el 27 y 28-09-2026; las de compras, el 28-09-2026)

**Apple**
- [App Review Guidelines (3.1.1, 3.1.3(b), 5.1.1(v), 5.1.1(ix), 5.1.2(i), 1.4.1)](https://developer.apple.com/app-store/review/guidelines/)
- [Changes for apps in the European Union (18-08-2026)](https://developer.apple.com/news/?id=awe9ib0n)
- [Payment options on the App Store in the EU](https://developer.apple.com/support/payment-options-on-the-app-store-in-the-eu/)
- [Communication and promotion of offers on the App Store in the EU](https://developer.apple.com/support/communication-and-promotion-of-offers-on-the-app-store-in-the-eu/)
- [Declare regulated medical device status](https://developer.apple.com/help/app-store-connect/manage-app-information/declare-regulated-medical-device-status/)
- [Update on regulated medical device apps (26-03-2026)](https://developer.apple.com/news/?id=nyqbfz1y)
- [Age ratings values and definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions) · [Age Ratings (App Store)](https://apps.apple.com/us/iphone/story/id1825160725)
- [Upcoming requirements (Xcode 26 / SDK iOS 26 desde 28-04-2026)](https://developer.apple.com/news/upcoming-requirements/)
- [Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)
- [ITSAppUsesNonExemptEncryption](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption)

**Google Play**
- [Choose a developer account type (apps de salud → organización, D-U-N-S)](https://support.google.com/googleplay/android-developer/answer/13634885?hl=en)
- [Health Content and Services](https://support.google.com/googleplay/android-developer/answer/16679511?hl=en) · [Health apps declaration](https://support.google.com/googleplay/android-developer/answer/14738291?hl=en)
- [Lower service fees](https://support.google.com/googleplay/android-developer/answer/16954621?hl=en) · [Billing choice program](https://support.google.com/googleplay/android-developer/answer/17161464) · [External offers program (EEE)](https://support.google.com/googleplay/android-developer/answer/14372887?hl=en) · [Alternative billing (EEE)](https://support.google.com/googleplay/android-developer/answer/12348241?hl=en)
- [A new era for choice and openness (04-03-2026)](https://android-developers.googleblog.com/2026/03/a-new-era-for-choice-and-openness.html)
- [Target API level requirement](https://developer.android.com/google/play/requirements/target-sdk)
- [Store listing assets / screenshots](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en) · [Content ratings](https://support.google.com/googleplay/android-developer/answer/9859655?hl=en)

**Google Gemini**
- [Gemini API Additional Terms of Service](https://ai.google.dev/gemini-api/terms) · [Abuse monitoring (55 días)](https://ai.google.dev/gemini-api/docs/usage-policies)

**Compras (v1.2)**
- [Apple · Auto-renewable subscriptions (información obligatoria antes de comprar, importe cobrado destacado, enlaces a condiciones y privacidad)](https://developer.apple.com/app-store/subscriptions/)
- [Apple · External Purchase Server API · Reporting tokens with transactions](https://developer.apple.com/documentation/externalpurchaseserverapi/reportwithtransactions)
- [Apple · App Privacy Details (datos de pago introducidos fuera de la app)](https://developer.apple.com/app-store/app-privacy-details/)
- [Google Play · Backend integration for monetization outside Google Play Billing (`externaltransactions`)](https://developer.android.com/google/play/billing/outside-gpb-backend)
- [Google Play · Data safety (servicios de pago)](https://support.google.com/googleplay/android-developer/answer/10787469?hl=en)
- [Supabase · Anonymous Sign-Ins (CAPTCHA, límite por IP, limpieza)](https://supabase.com/docs/guides/auth/auth-anonymous) · [Phone login (`phone_change`)](https://supabase.com/docs/guides/auth/phone-login)

**Supabase**
- [Regions](https://supabase.com/docs/guides/platform/regions) · [DPA](https://supabase.com/legal/dpa) · [Phone login](https://supabase.com/docs/guides/auth/phone-login) · [Auth config API (`sms_test_otp`)](https://supabase.com/docs/reference/api/v1-update-auth-service-config) · [Discusión: números de prueba](https://github.com/orgs/supabase/discussions/5358)

**AEMPS**
- [Aviso legal AEMPS](https://www.aemps.gob.es/aviso-legal/) · [Aviso legal del Nomenclátor](https://listadomedicamentos.aemps.gob.es/Aviso_Legal_Nomenclator.pdf) · [CIMA REST API](https://www.aemps.gob.es/apps/cima/docs/CIMA_REST_API.pdf)
