# MediClaro — 1.0.1-rc.2-20261003
Fecha: 2026-10-03. Antecedente: RC1/build 24. Estado: candidata interna; NO aprobada para Apple App Review.

## Cambios y evidencia
- Presentación inicial sin Siguiente: avanza al finalizar el audio Google de cada paso; pausa, repetición y salida. Sin voz sintética del sistema en esta presentación.
- Voces Sulafat/Achird de Google: WAV válidos y distintos; nueva narración de emergencias generada y verificada. El respaldo local de lectura de emergencia permanece separado.
- Recorrido automático: FULL_TOUR=1 aprobado con reproducción natural completa de los cinco audios reales en Edge (181,84 s), sin adelantar ni simular su final; pausa aprobada y cero errores de página. Seis pruebas nuevas de ciclo de vida aprobadas.
- Botones y cabecera: ajuste de etiquetas largas y fuente muy grande; altura estable durante carga. 32 casos visuales en 320/375/393/430 px aprobados, con fixtures aisladas del código de producción.
- Panel de propietario móvil: usuarios y suscripciones, actividad, errores, coste IA, guardados/favoritos, incidentes y entrega de avisos; actualización periódica, filtros y paginación. No muestra conversaciones médicas ni GPS de otros usuarios.
- Premium gratuito para +34680127015 y +34646350527, exclusivamente tras confirmar el móvil por SMS. Sin contraseña universal ni llave incorporada al cliente.
- Autorización del propietario y ausencia de cargos extra probadas en PostgreSQL con transacción revertida, incluyendo denegación a teléfonos sin verificar/anónimos y acceso a tablas privadas.
- Historial/favoritos y guardado/borrado: comprobaciones reales de backend aprobadas.
- Cuidador: 31 comprobaciones reales aprobadas; invitación, chat privado durante incidente, consentimiento GPS, revocación y scheduler real de falta de respuesta.
- Reevaluación IA: cuatro casos HTTP aprobados, incluidos empeoramiento respiratorio y mejoría. No equivale a validación clínica.
- Foto: 15 archivos protegidos y método de identificación sin modificaciones; SHA256 3a50b5953a560ca36583e555dce41b2294b58e9580f2db89f7cf2f42e8449342.
- Jest final: 22 suites / 282 pruebas aprobadas. Typecheck aprobado.
- Migraciones de propietario desplegadas; funciones de entitlement y narración actualizadas. Identificación redeplegada sin cambiar su código.
- RC: demo desactivada y pagos móviles por tienda; variables públicas configuradas en perfil EAS. No contiene fixtures de auditoría. Se retiró QA_ACCESS_TOKEN del backend; el acceso QA antiguo queda desactivado.
- 112 exclusivamente manual. No se han enviado alertas a cuidadores reales ni realizado llamadas de emergencia.

## Compilación
- Exportación iOS/Hermes 1.0.1 aprobada; no equivale a IPA firmado.
- Build 23 anterior terminado y firmado tras reparar el perfil Push; no contiene estos cambios.
- RC 1.0.1 build 24 FINISHED: 989bfa06-1cdd-4125-872e-8b41b3b62d88. Perfil rc, distribución interna Ad Hoc; no equivale a envío a App Store.
- Fuente confirmada por EAS: a40d671ae48dd842bb5115dcb82f24ba772b080e. Firma y compilación nativa aprobadas; pruebas físicas pendientes.
- Instalación: https://expo.dev/accounts/antoniom87/projects/mediclaro/builds/989bfa06-1cdd-4125-872e-8b41b3b62d88
- IPA: https://expo.dev/artifacts/eas/Z4Ke0XVn_s6dQkuyLzi5desmnlUh5RBiQ3LQK-lZ7kE.ipa

## Bloqueos antes de App Review
1. TURN: faltan CAREGIVER_TURN_URLS y CAREGIVER_TURN_SHARED_SECRET en secretos del backend. Sin ellos, la configuración RTC devuelve 503; señalización aprobada no prueba audio.
2. Prueba física en iPhone y segundo móvil: vinculación, chat, sonido/push con pantalla bloqueada, micrófono y audio en ambos sentidos, Google TTS, cámara, historial/favoritos y accesibilidad. El segundo iPhone necesita registro Ad Hoc o TestFlight.
3. Apple Sandbox: compra, restauración y caducidad con cuentas/productos reales; storeVerification permanece false hasta completar esa validación.
4. Critical Alerts: aprobación/entitlement de Apple y autorización del usuario pendientes. El sonido actual es ordinario, sujeto a ajustes del sistema; no es ES-Alert. Solicitud preparada en APPLE_CRITICAL_ALERTS_REQUEST.md.
5. GPS en segundo plano y llamadas con la app cerrada no implementados/verificados. El GPS actual requiere app abierta y consentimiento; las llamadas requieren ambos participantes en primer plano.
6. Agente telefónico IA bidireccional no implementado. Audio entre paciente y cuidador no lo sustituye. No se ha contratado Twilio.
7. Expo Doctor 20/21: advertencia WebRTC/New Architecture pendiente de prueba física, sin ocultarla.
8. npm audit: 17 avisos (12 moderados, 5 altos). Los altos pertenecen a node-forge en herramientas Expo/firmado; no hay versión corregida publicada accesible en la auditoría. Sin downgrade forzado; no se considera resuelto.
9. Documentación de revisión, privacidad y textos médicos requieren revisión final; no se afirma cumplimiento legal ni aceptación Apple.

## Reproducción
npm test -- --runInBand
npm run typecheck
node scripts/verify-photo-unchanged-rc.mjs
node scripts/audit-caregiver-rc.mjs
node scripts/audit-backend-rc.mjs
node scripts/audit-reassessment-rc.mjs
node scripts/audit-tts-rc.mjs
node scripts/qa-web-windows.cjs; node scripts/serve-qa.js dist-ui-qa 8765
node scripts/audit-ui-rc.cjs; node scripts/audit-tour-ui-rc.cjs
scripts/audit-owner-rc.sql (PostgreSQL, transacción con ROLLBACK)

Informe anterior conservado en MEDICLARO_RELEASE_CANDIDATE_REPORT_PREVIOUS.md.

## Cambios posteriores a build 24 — 2026-10-03
- Entrada gratuita al inicio sin teléfono; rutas IA/foto muestran bloqueo Premium. Compra y confirmación antes de completar/verificar teléfono.
- Eliminado fallback que pedía teléfono antes del pago si fallaba la cuenta anónima.
- Entitlement falla cerrado incluso con storeVerification=false o error de consulta; pago no configurado no regala IA.
- Verificación: 23 suites / 290 tests, typecheck y protección de identificación fotográfica aprobados.
- Estos cambios de código NO están incluidos en el IPA build 24; requieren siguiente compilación y prueba visual/física.
- Comprobación de Auth pública HTTP 200: phoneEnabled=true, signupDisabled=false. No prueba entrega SMS; falta evidencia del error o estado del iPhone/proveedor.
- PIN local de 4 dígitos acordado como desbloqueo del mismo dispositivo tras verificar teléfono; NO implementado todavía. No sustituye recuperación por SMS ni transfiere Premium entre cuentas.

## RC2 — perfiles iniciales y QR
- Elección Soy usuario / Soy cuidadora o cuidador desde el principio, sin SMS ni pago. Crea o reutiliza sesión anónima segura y guarda rol de cuidado en servidor; no modifica plan, suscripción ni privilegios administrativos.
- Cuidador gratuito: vinculación, avisos y chat durante incidente. Premium propio opcional mediante la misma oferta/tienda; nunca hereda la suscripción del usuario.
- Vinculación mediante QR privado de 24 h o código/enlace compartido. Generar o escanear no acepta automáticamente: el usuario emite el vínculo y la cuidadora confirma explícitamente. Revocación y permisos de datos permanecen en servidor.
- Backend real: seis comprobaciones de perfiles/vinculación gratuitas aprobadas, y 31 comprobaciones del cuidador/scheduler aprobadas de nuevo.
- UI aislada: 40 casos visuales aprobados; ambos perfiles navegables, IA/foto bloqueadas gratis, acceso del cuidador a Premium propio. QR renderizado leído por decodificador independiente; prueba física de cámara aún pendiente.
- Tests finales: 25 suites / 309 pruebas, typecheck y protección de identificación por foto aprobados.
- cleanup-anonymous actualizado/desplegado: conserva cuentas gratuitas con vínculos no revocados y no borra ante errores de consulta. Cinco pruebas unitarias sobre cuentas ficticias; NO se ejecutó limpieza destructiva de cuentas reales.
- Sin teléfono, la sesión se conserva en este dispositivo; cerrar sesión o reinstalar puede exigir una nueva vinculación. No se promete recuperación por PIN/SMS sin completar esos pasos.
- react-native-qrcode-svg fijado en 6.3.26. npm audit actual: 18 avisos (13 moderados, 5 altos), pendientes; no se forzaron cambios incompatibles de Expo.
- Fuente de app: acd7956ccf7c4495a90117576a5ad113d0569df0; label 1.0.1-rc.2-20261003.
- Build 25: 07c7f74d-7085-4f95-87e4-67c3722e72c4, FINISHED, distribución interna Ad Hoc, versión 1.0.1 / 25.
- Instalación: https://expo.dev/accounts/antoniom87/projects/mediclaro/builds/07c7f74d-7085-4f95-87e4-67c3722e72c4
- IPA firmada: https://expo.dev/artifacts/eas/Gzt_pcTwBO2Cw10sIrOvx_FzIUmIU_BwkUyJHgVQD6Q.ipa
- PIN no incluido. SMS de la cuenta propietaria aún sin entrega verificada. TURN, alertas críticas, GPS/audio en segundo plano y Apple Sandbox siguen pendientes.

## Corrección posterior a build 25: acceso real del propietario
- SMS aceptado HTTP 200 y recepción confirmada por el propietario tras corregir configuración de Twilio.
- Teléfono terminado en 015 verificado, no anónimo, reconocido como propietario en base de datos real.
- Detectado permission denied al consultar campos de billing en profiles con rol authenticated. SubscriptionService abortaba antes de mostrar Premium.
- Aplicados grants SELECT solo para siete columnas necesarias. RLS propia identidad permanece; sin UPDATE de billing ni SELECT de is_admin.
- Cambio de servidor, compatible con build 25 sin reinstalación. Falta confirmar refresco/UI/IA en iPhone real.
- Requisito nuevo pendiente de implementación: panel de propietario para conceder/revocar Premium de cortesía por teléfono verificado, separado de privilegios administrativos, con auditoría. No afirmar incluido en build 25.
