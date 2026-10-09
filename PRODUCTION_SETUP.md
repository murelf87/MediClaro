# MediClaro — integración final y paso a producción

**Fecha:** 29-09-2026  
**Base:** v1.2 recibida + integración de backend/identificación/P0 realizada sobre el mismo proyecto.

## 1. Qué queda implementado en código

### Identificación real de medicamentos (España)

Flujo efectivo del backend:

1. Código Nacional tecleado o código de barras/DataMatrix compatible → extracción de CN.
2. Si existe CN → consulta directa a `CIMA/AEMPS` (`/medicamento?cn=...`). **No se llama a Gemini.**
3. Si no hay identificador utilizable → Gemini Vision se limita a leer literalmente nombre, principio activo, dosis, forma, laboratorio, unidades y posible CN del envase.
4. Un CN leído por visión se valida en CIMA. Si no hay CN, se buscan candidatos en CIMA y cada candidato se vuelve a enriquecer con su ficha completa oficial antes de calcular la confianza.
5. Solo se identifica automáticamente si supera el umbral de confianza y la separación respecto al segundo candidato. Si no, devuelve candidatos o `not_found`. Una foto con varios medicamentos no se autoidentifica.
6. La ficha y el prospecto proceden de CIMA/AEMPS. El resumen sencillo se genera desde ese texto oficial; si la IA falla, se conserva el texto oficial y no se inventa un resumen.

Se corrigió además el contrato del prospecto segmentado de CIMA: `docSegmentado/contenido/2` devuelve una lista de secciones y ahora se procesa como tal.

### Arquitectura internacional

El selector de proveedor es explícito por `profiles.country`: `ES → CIMA/AEMPS`; `US → FDA NDC Directory/openFDA + etiquetado oficial FDA`. No existe fallback silencioso entre países. La interfaz móvil entregada sigue siendo la española; la infraestructura de datos queda separada para poder construir la localización inglesa sin mezclar fuentes.

### Premium y seguridad del gasto de IA

`identify-medicine`, `medicine-detail` y el chat farmacológico comprueban Premium en el servidor. La migración final deja la cuota gratuita de IA en 0. El cliente no puede saltarse este control llamando directamente a la Edge Function.

La detección/derivación de emergencia se ejecuta antes de Gemini y no requiere Premium. No registra el `user_id` en el evento de emergencia.

### Compras Apple / Google

Se añadieron:

- `supabase/functions/iap-verify`
- `supabase/functions/apple-store-notifications`
- `supabase/functions/google-play-notifications`
- `supabase/functions/_shared/storeBilling.ts`
- tablas `store_subscriptions` y `store_events`

La activación de Premium no confía en lo que diga el teléfono. Para Apple, el servidor consulta App Store Server API (`Get Transaction Info` y estado de suscripción); para Google, consulta `purchases.subscriptionsv2`. Se comprueba que la compra está vinculada al UUID de la cuenta MediClaro (`appAccountToken` / `obfuscatedExternalAccountId`) y que el producto está en el catálogo configurado.

Las notificaciones de tienda tampoco conceden Premium por sí mismas: sirven como disparador y el servidor vuelve a consultar a Apple/Google antes de actualizar el perfil.

### Ubicación de emergencia

La pantalla de emergencia muestra siempre, cuando existe GPS actual:

- dirección resuelta del GPS, si está disponible;
- **coordenadas**;
- **precisión**;
- **hora de actualización** y antigüedad;
- botón **«Leer ubicación en voz alta»**;
- botón para abrir esas coordenadas en el mapa.

El domicilio del perfil permanece separado y nunca sustituye a la ubicación GPS actual.

## 2. P0: estado real

| P0 | Estado del código final | Lo que falta fuera del código |
|---|---|---|
| R-01 Stripe / `sub_state` | Integrado en migraciones y `stripe-webhook` | Desplegar migración y función; probar webhook real |
| R-02 SMS | Frontend y flujo preparados | Activar Phone Auth y proveedor SMS; plantilla de 6 dígitos; números de revisión |
| R-03 funciones | Árbol completo preparado | Desplegar todas las Edge Functions y migraciones |
| R-04 Apple/Google | `iap-verify` + receptores de notificaciones implementados | Credenciales, productos, URLs, permisos y pruebas Sandbox/License Testing |
| R-21 cuenta sin teléfono | `signInAnonymously` ya usado + `cleanup-anonymous` añadido | Activar Anonymous sign-ins y programar limpieza diaria |
| R-24 IA solo Premium | Implementado en servidor + cuota free=0 | Desplegar migración/funciones |
| R-26 cuota mensual en planes largos | Implementado: ventana mensual anclada al inicio de suscripción | Desplegar migración |
| R-22 tarjeta en tienda | No necesaria para `production`, que usa `store` | Solo si en el futuro se habilita Stripe dentro de la app de tienda |

`app_config.plans.storeVerification` queda **false a propósito**. No lo cambies a `true` hasta que Apple Sandbox y Google License Testing hayan verificado compra, activación, renovación/cancelación y restauración.

## 3. Configuración que debe hacer el titular

### Supabase

1. Usa un proyecto en región UE.
2. Aplica todas las migraciones de `supabase/migrations/` en orden.
3. Despliega las funciones:

```bash
supabase functions deploy identify-medicine medicine-detail chat account create-checkout customer-portal iap-verify cleanup-anonymous
supabase functions deploy stripe-webhook apple-store-notifications google-play-notifications --no-verify-jwt
```

4. Authentication → Providers → Phone: activa el proveedor SMS. Configura código de 6 cifras y la plantilla:

`MediClaro: tu código es {{ .Code }}. No se lo digas a nadie.`

5. Activa **Anonymous sign-ins** solo después de haber desplegado R-24.
6. Programa una llamada diaria a `cleanup-anonymous` con cabecera `X-Cron-Secret` igual al secreto `CRON_SECRET`.

### Secretos del servidor

No se incluyen secretos reales en el ZIP. Usa `supabase/.env.production.example` como lista y configura los valores en Supabase Edge Functions/Secrets. No pongas `service_role`, claves privadas Apple, cuenta de servicio Google ni `GEMINI_API_KEY` en el frontend.

Para Apple necesitas una clave **In-App Purchase** de App Store Connect y configurar:

- `APPLE_IAP_ISSUER_ID`
- `APPLE_IAP_KEY_ID`
- `APPLE_IAP_PRIVATE_KEY`
- `APPLE_BUNDLE_ID=com.mediclaro.app`
- `APPLE_NOTIFICATION_TOKEN` (cadena aleatoria propia)

Para Google Play:

- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`
- `ANDROID_PACKAGE_NAME=com.mediclaro.app`
- `GOOGLE_RTDN_TOKEN` (cadena aleatoria propia)

Y para IA:

- `GEMINI_API_KEY`
- `GEMINI_MODEL` si se quiere cambiar el modelo configurado.

### App Store Connect

Crea las tres suscripciones auto-renovables en el mismo grupo, salvo que cambies también `app_config.plans`:

- `com.mediclaro.app.premium.monthly` — 4,99 €/mes
- `com.mediclaro.app.premium.quarterly` — 12,99 €/3 meses
- `com.mediclaro.app.premium.annual` — 39,99 €/año

Configura App Store Server Notifications V2 hacia:

`https://<TU-PROYECTO>.supabase.co/functions/v1/apple-store-notifications?token=<APPLE_NOTIFICATION_TOKEN>`

Prueba primero Sandbox. El endpoint no activa nada basándose únicamente en el `signedPayload`: vuelve a consultar a Apple.

### Google Play Console / Google Cloud

Crea la suscripción `mediclaro_premium` con planes base:

- `monthly`
- `quarterly`
- `annual`

Da a la cuenta de servicio acceso a la app y a las suscripciones. Configura Real-time Developer Notifications mediante Pub/Sub y usa como push endpoint:

`https://<TU-PROYECTO>.supabase.co/functions/v1/google-play-notifications?token=<GOOGLE_RTDN_TOKEN>`

Google RTDN solo informa de que el estado cambió; el backend vuelve a consultar Google Play Developer API antes de actualizar Premium.

### Build móvil

Configura en EAS/entorno de build los valores públicos de `.env.example`, especialmente:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- URLs legales y correo de soporte
- datos públicos de la empresa

El perfil `production` ya mantiene `EXPO_PUBLIC_DEMO_ACCESS=off` y `EXPO_PUBLIC_PAYMENTS_MODE=store`.

## 4. Activar finalmente las ventas

Solo después de completar Sandbox/License Testing, cambia el campo de configuración:

```sql
update public.app_config
set value = jsonb_set(value, '{storeVerification}', 'true'::jsonb, true), updated_at = now()
where key = 'plans';
```

Ese cambio hace que la app ofrezca las compras reales. Antes de ese momento la red de seguridad evita presentar una compra que el servidor todavía no pueda confirmar.

## 5. Prueba de aceptación antes de publicar

En iPhone físico y Android físico, comprobar en este orden:

1. Primera apertura → `Conocer MediClaro` → explicación animada/narrada sin registro y sin consumo Gemini.
2. Planes → compra de prueba mensual/trimestral/anual → Premium confirmado solo después de respuesta del servidor.
3. `Completa tu cuenta` → teléfono → SMS → reinicio de app → sesión conservada.
4. Cámara con medicamento español real: primero caja con CN/código legible; después caja sin código visible para forzar lectura visual. Confirmar que el resultado corresponde a CIMA/AEMPS.
5. Foto borrosa y foto con dos medicamentos: no debe inventar ni autoelegir.
6. Abrir ficha → comprobar fuente AEMPS, resumen sencillo y prospecto.
7. Preguntar al asistente algo presente y algo no presente en el prospecto; no debe diagnosticar ni modificar tratamientos.
8. Lectura por voz.
9. Emergencia → confirmar dirección GPS actual, coordenadas, precisión, hora, lectura en voz alta y 112, sin depender de Premium.
10. Cancelar renovación y recibir notificación de tienda; comprobar `cancel_at_period_end`/estado.
11. Cerrar sesión o reinstalar → `Restaurar compra` → la tienda y el servidor deben recuperar Premium.
12. Probar una cuenta sin Premium llamando directamente a las Edge Functions: `identify-medicine`, `medicine-detail` y chat farmacológico deben devolver `PREMIUM_REQUIRED` sin gastar Gemini.

## 6. Comprobación en Windows

Ejecuta `COMPROBAR_MEDICLARO.bat`. Si faltan dependencias ejecutará `npm ci`; después realiza comprobaciones de release, typecheck, tests y `expo config --type introspect`.

El BAT valida el código. Las pruebas de compra, cámara, SMS, GPS y Gemini necesitan dispositivo/cuentas/secretos reales y no pueden sustituirse por mocks para aprobar producción.
