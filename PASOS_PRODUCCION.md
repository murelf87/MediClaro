# MediClaro: pasos para publicar (versión candidata RC-2026-10-09)

El código de esta versión está terminado y comprobado (ver `CAMBIOS_2026-10-09.md` §19 y §21). Lo que queda solo lo
puede hacer el titular, porque necesita sus cuentas y claves:

- el panel de Supabase,
- Stripe,
- App Store Connect,
- Google Play,
- EAS (la nube de Expo).

Ni el ZIP ni la app llevan claves secretas.

Hay que seguir este orden. Cada paso remite al documento con el detalle.

---

## 1. Servidor (Supabase)

1. **Migraciones**, en este orden, solo las que aún no estén aplicadas. Se aplican con `npx supabase db push`.
   - `20261008200000_premium_unlimited_scans.sql`
   - `20261009100000_bizum_and_family_payments.sql`
   - `20261009120000_medication_plans.sql`
   - `20261009150000_care_chat_and_calls.sql`
   - `20261009170000_owner_admin_panel.sql`
   - `20261009190000_care_chat_window.sql` (el chat con el cuidador/a lo enciende la persona cuidada: 1 hora)
   - `20261009191000_owner_phones_antonio_marina.sql` (propietarios: solo Antonio y Marina)
2. **Funciones** que cambian en esta versión. Cada una se despliega con `npx supabase functions deploy <nombre>`.
   - `chat`
   - `caregiver-dispatch`
   - `caregiver-rtc-config`
   - `tts`
   - `tts-preview`
   - `create-checkout`
   - `stripe-webhook`

   `family-pay` se despliega aparte, con `npx supabase functions deploy family-pay --no-verify-jwt`.
3. **Secretos** en *Edge Functions › Secrets*. La lista está en `PRODUCTION_SETUP.md` §3 (Apple, Google Play, IA) y
   en `BACKEND_REQUIREMENTS.md` (C-2, Stripe). Las llamadas usan el TURN ya configurado. Nunca van en la app.
4. **Teléfonos de propietario**: los deja fijos la migración `20261009191000` (Antonio +34 680 127 015 y Marina
   +34 646 350 527, guardados como huella, nunca en claro). El código del panel se crea desde la app:
   `PANEL_PROPIETARIO.md` §6.

## 2. Cobros

1. **App Store Connect**:
   - Las tres suscripciones Premium.
   - Las notificaciones del servidor (`PRODUCTION_SETUP.md` §3).
2. **Google Play Console**:
   - La suscripción `mediclaro_premium` con sus planes.
   - Las notificaciones en tiempo real (`PRODUCTION_SETUP.md` §3).
3. **Stripe** (solo si se cobra fuera de las tiendas):
   - Activar Bizum, SEPA y PayPal si se quieren ofrecer.
   - En `app_config.plans`, poner a `true` solo lo que se haya activado (`CAMBIOS_2026-10-09.md` §10).

## 3. Textos legales

Los textos dentro de la app ya recogen todo lo de esta versión:

- «Mis pastillas»,
- Bizum y el pago por un familiar,
- el chat y las llamadas con el cuidador/a,
- el Premium de regalo,
- el panel del propietario.

Antes de publicar hay que hacer dos cosas:

- Revisar con un abogado los textos de `legal/`, que son borradores.
- Que las páginas públicas enlazadas desde la tienda (`EXPO_PUBLIC_PRIVACY_URL`, condiciones y aviso legal) digan
  lo mismo que la app.

Por los datos de salud, se recomienda valorar una evaluación de impacto (EIPD).

## 4. Compilación de producción (EAS)

1. **Número de versión.** `app.json` tiene la versión `1.0.1`. Si la 1.0.1 ya está publicada en la App Store o en
   Google Play, hay que subir `version` (por ejemplo, a `1.1.0`) antes de compilar. Los números de compilación los
   lleva EAS solo (`autoIncrement`).
2. **Compilar** con el perfil de producción. Este perfil ya deja apagados los accesos de prueba y solo permite
   compras de las tiendas.
   - iPhone: `eas build --profile production --platform ios`
   - Android: `eas build --profile production --platform android`

   La compilación incluye:
   - el texto de Face ID,
   - el permiso de biometría de Android,
   - los sonidos de la alarma y de las llamadas,
   - la foto de Isabel y José en la entrada.

## 5. Pruebas en teléfonos reales (antes de enviar)

1. La lista de aceptación de `PRODUCTION_SETUP.md` §5:
   - compras de prueba,
   - SMS,
   - cámara con cajas reales,
   - emergencia y 112,
   - restaurar compra.
2. «Mis pastillas»: la alarma con la app cerrada y tras reiniciar el teléfono (`MIS_PASTILLAS.md` §15).
3. **Chat y llamada de voz** entre dos teléfonos, la persona Premium y su cuidador/a, con MediClaro abierta en los
   dos.
4. **Panel del propietario**:
   - crear el código,
   - activar Face ID,
   - crear un bono y dárselo a una persona de prueba,
   - poner un aviso y verlo en Inicio,
   - cerrar el panel.
5. Cuando las compras de prueba confirmen bien, activar las ventas reales con `storeVerification = true`
   (`PRODUCTION_SETUP.md` §4).

## 6. Envío a las tiendas

1. Pegar las **notas para la revisión de Apple**. El texto está en inglés en `PANEL_PROPIETARIO.md` §6.7.
2. Enviar las compilaciones aprobadas en las pruebas. Lo hace el titular, desde App Store Connect y Google Play
   Console o con `eas submit --profile production`. Nada se envía automáticamente.

---

**Comprobación rápida en Windows:** `COMPROBAR_MEDICLARO.bat` revisa el código (comprobaciones de publicación,
TypeScript y pruebas). Las compras, la cámara, los SMS, el GPS, las llamadas y la IA solo se pueden comprobar en
teléfonos reales con las cuentas de verdad.
