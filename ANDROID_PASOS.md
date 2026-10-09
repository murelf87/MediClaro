# MediClaro en Android (Google Play) — qué hay hecho y qué falta

## Ya preparado en el proyecto
- Paquete `com.mediclaro.app`, icono adaptativo y monocromo, permisos mínimos (cámara, micrófono, ubicación, alarma exacta, biometría).
- `eas.json`: `production` genera un paquete **.aab** (el que pide Google Play); `rc` genera un **.apk** interno para instalar y probar
  en un Android real; el envío a Play (`submit.production.android`) va a la pista **interna** como **borrador**. Nada se envía solo.
- Compras con Google verificadas en el servidor (`iap-verify`, RTDN): ver `PRODUCTION_SETUP.md` §3. `storeVerification` sigue en **false**.
- Textos de la ficha y privacidad: `store/` y `legal/`.

## Lo que tiene que hacer el propietario (no lo puede hacer Claude)
1. **Cuenta de Google Play Console** (pago único de 25 USD) y crear la app «MediClaro», idioma español.
   Si la cuenta es personal y nueva, Google exige una **prueba cerrada con al menos 12 personas durante 14 días** antes de publicar
   (condición vigente que conozco; compruébala en la consola).
2. **Firma**: la primera vez, EAS crea la clave de subida (`eas credentials` → Android). Se guarda en EAS; haz copia de seguridad.
3. **Notificaciones push (FCM)**: si se usan avisos remotos (cuidador, chat), crear el proyecto en Firebase, descargar
   `google-services.json` y subirlo con `eas credentials`. No se sube a Git.
4. **Cuenta de servicio de Google** para publicar y para verificar compras: se guarda como secreto en Supabase y en EAS, nunca en el código.
5. **Formularios de Play**: Seguridad de los datos (salud, ubicación, voz, fotos), clasificación de contenido, política de privacidad
   (URL ya definida), declaración de permisos. `SCHEDULE_EXACT_ALARM` exige justificar que es una app de recordatorios de medicación.
6. **Suscripción** `mediclaro_premium` con los tres planes en Play Console, y probar con «License testing» antes de activar `storeVerification`.
7. **Capturas** para móvil (mínimo 2) y gráfico de funciones 1024×500; hay material en `store/capturas`.

## Orden recomendado
`rc` (apk) → probar en un Android real (voz, cámara, alarma, llamada) → `production` (aab) → Play Console pista interna →
prueba cerrada → producción.
