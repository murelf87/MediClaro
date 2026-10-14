# MediClaro · Subir la versión de producción a Apple (actualizado la noche del 11/10/2026)

## Estado
- Código listo para producción: comprobación de publicación sin fallos, TypeScript sin errores, 61 grupos / 608 pruebas. Último código publicado: commit `acdc2a8`.
- La versión de producción lleva todo lo de hoy:
  - voz que nunca se queda en silencio y dice dónde falla;
  - voz de la app elegida desde el panel (natural de Google o la del teléfono), con tope mensual de gasto y respaldo con la voz del teléfono;
  - chat de IA con conversaciones nuevas, velocidad de lectura con animales (🐌 🐢 🐇), apertura en el último mensaje y botón grande «Repetir explicación» (también en la lectura en voz alta);
  - «Mis pastillas»: «Cada 4, 6, 8 o 12 horas» (calcula las horas y un aviso por pastilla) y «Cuando lo necesite» (sin horas ni alarma, con «La he tomado ahora»);
  - contador «IA este mes» en el panel del propietario;
  - sin los enlaces «Ver también en la web»;
  - «Revisar la app» y «Notifícanos un error»;
  - ubicación con el móvil bloqueado durante un aviso;
  - «Cómo llegar» y la foto real de la caja.
- Lleva actualizaciones sin build (canal `production`). Los arreglos de pantallas y textos llegarán sin pasar otra vez por la tienda.
- Las credenciales de Apple ya están en EAS (builds de producción 26, 28 y 29 del 6 y 7/10).
- La siguiente build será la 1.0.1 (36).

## Orden
1. **Tú:** comprobar en el iPhone con la actualización de hoy (cierra MediClaro del todo y ábrela dos veces):
   - la voz natural: Perfil › Accesibilidad › «Probar» (necesita los créditos de Google de 30 € ya activos);
   - el chat de IA: una conversación nueva, los tres animales y «Repetir explicación»;
   - «Mis pastillas»: «Cada 8 horas» y «Cuando lo necesite» con «La he tomado ahora».
   - cuando todo esté bien, me dices **«sube»**.
2. **Yo, solo con tu permiso:**
   - una build de producción para iPhone;
   - subirla a App Store Connect (TestFlight).

   No se envía a revisión.
3. **Tú, antes de enviarla a revisión:**
   1. **Suscripciones en App Store Connect** (un grupo «MediClaro Premium»). Sin esto la versión de la App Store no puede vender Premium: las funciones Premium salen bloqueadas sin forma de pagar y Apple la rechazaría.
      - Las tres suscripciones, con estos identificadores exactos:
        - `com.mediclaro.app.premium.monthly`: 4,99 € al mes.
        - `com.mediclaro.app.premium.quarterly`: 12,99 € cada 3 meses.
        - `com.mediclaro.app.premium.annual`: 39,99 € al año.
      - La clave de App Store Server API en los secretos de Supabase (`PRODUCTION_SETUP.md` §3).
      - Después, con tu permiso, despliego `iap-verify` si falta y activo `storeVerification`.
      - La build no cambia: los productos y la comprobación los da el servidor.
   2. **Política de privacidad y URL de soporte que funcionen** (App Store Connect › Información de la app).
      - La de Supabase (`public-info`) no se ve como página: Supabase muestra el código en vez de la web, en su dominio no deja servir páginas.
      - Ya están hechas en el repositorio (`docs/`), con los mismos textos de la app. Falta activarlas (GitHub no me deja desde aquí): GitHub › murelf87/MediClaro › Settings › Pages › «Deploy from a branch» › main › /docs › Save.
      - Direcciones para App Store Connect:
        - privacidad: https://murelf87.github.io/MediClaro/privacidad.html
        - soporte: https://murelf87.github.io/MediClaro/soporte.html
      - Faltan los datos del titular: nombre o empresa, NIF, domicilio y correo. No se inventan; con ellos regenero las páginas (`node scripts/build-legal-pages.mjs`) y los pongo también en la app (variables `EXPO_PUBLIC_COMPANY_*` y `EXPO_PUBLIC_SUPPORT_EMAIL` del entorno production de EAS).
   3. **Cuenta de prueba para Apple** (se entra por SMS), con Premium. Cualquiera de estas dos:
      - un teléfono de prueba con código fijo (Supabase › Authentication › Phone › números de prueba);
      - el código MediClaro de una cuenta de prueba (Perfil › Mi cuenta › «Tu código MediClaro»).
   4. **Notas para la revisión** (abajo, en inglés): pegarlas en App Review Information › Notes, con los datos de la cuenta de prueba.
   5. Capturas, descripción, clasificación por edad y la declaración de producto sanitario que pide App Store Connect.
4. **Tú:** «Enviar a revisión» en App Store Connect. Las suscripciones nuevas se envían junto con la versión.

## Pagos con Bizum, tarjeta o «que pague un familiar»
- Siguen hechos, pero el servidor los tiene apagados: no hay claves de Stripe en Supabase. Por eso no aparecen.
- **Tú:** poner tus claves de Stripe en Supabase (`ACTIVAR_PAGOS.md`; yo no manejo claves).
- **Yo, con tu permiso:** desplegar las funciones de pago y encender las opciones.
- En la versión de la App Store, Apple obliga a cobrar las suscripciones con su compra integrada: ahí solo sale Apple.

## Notas para la revisión de Apple (pegar en inglés)

> MediClaro helps older people identify their medicines with a photo and explains the official Spanish medicines
> information (AEMPS / CIMA) in simple language. It is not a medical device: it does not diagnose or decide doses and
> always recommends asking a doctor or pharmacist.
>
> Sign-in is by phone number and SMS code. Test account for review: phone [+34 ...], SMS code [......] (fixed test
> code). Alternatively, on the first screen tap “Ya soy Premium” and enter the MediClaro code [MC-....-....].
> The MediClaro code is only a sign-in credential for an existing account (used instead of the SMS code when changing
> phones). It is not a promo or license code and it does not unlock Premium by itself.
>
> MediClaro Premium is sold only with In-App Purchase (monthly, quarterly and annual auto-renewable subscriptions).
> Emergency features and calling 112 are always free.
>
> AI: medicine photos and questions are sent to Google Gemini only after the user gives explicit consent in the app.
> The consent can be withdrawn in Profile › Privacy and data. Only what is needed is sent: the photo, the question or
> the text to read, and the profile name so the assistant can address the user by name. The phone number is never sent.
>
> Background location: used only while an emergency alert started by the user is active, so that their linked caregiver
> can see where they are. It stops automatically when the alert ends or expires. The app only asks for “While Using the
> App” permission, and iOS shows the blue location indicator while it is shared.
>
> The app includes a private owner-only admin area (Profile › “Panel de propietario”). It is shown only to the app
> owner’s verified phone numbers and is protected by a 6-digit code and Face ID. It is not needed to review any user
> feature. It lets the owner give complimentary Premium to specific people’s phone numbers; no purchases happen there.
