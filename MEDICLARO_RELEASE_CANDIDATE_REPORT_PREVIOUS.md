# MediClaro — informe de preparación de Release Candidate
Fecha: 2026-10-02 (Europe/Madrid)
Estado: BLOQUEADO — no preparado para Apple App Review.
Versión de aplicación: 1.0.0. No se ha generado ni etiquetado una RC.
Proyecto: C:\Users\ANTONIO\MediClaro_FINAL_2026-09-29\mediclaro
Commit principal: 8aea6339996d92cb4e8be81d4c767c8cffe4c870.
Corrección posterior: tipado explícito de mensajes del backend; consultar git log.

## Cambios y evidencia
- Historial/Mis medicamentos: corregidos permisos reales de tablas Supabase; migración aplicada manteniendo RLS. Consultas, guardado, favorito y borrado verificados contra el servicio real con sesión anónima autenticada.
- Caché de última lectura por propietario en almacenamiento seguro; errores de autorización no activan fallback. Indicador visible de lectura sin conexión y reintento.
- Voz: eliminada sustitución silenciosa por voz del sistema. Estado de preparación separado de reproducción; cancelación, pausa y cambio de voz probados con reproductor simulado.
- Sulafat y Achird: generación real HTTP 200 de archivos WAV distintos (357428 y 328628 bytes). Audición/reproducción física en iPhone pendiente.
- Asistente: reevaluación de mejoría conserva advertencia ante antecedentes graves; síntomas graves actuales mantienen emergencia. Avisos antiguos ya no reactivan automáticamente el flujo.
- Cuatro escenarios reales de reevaluación comprobados contra chat desplegado. Respuesta farmacológica Premium completa pendiente.
- Cuidador: fallos reales ya no se presentan como entrega; mensajes distinguen llamada/SMS y confirmación pendiente. Ubicación condicionada al consentimiento específico.
- Llamada autónoma al 112 eliminada del vencimiento del temporizador; acción manual conservada. Test AST comprueba ausencia de llamadas oficiales en efectos y temporizadores de pantallas de emergencia.
- Dependencias alineadas con Expo SDK 57; expo-font añadido. Sin downgrade forzado.
- Identificación por fotografía: lógica protegida sin cambios; 15 archivos y método comparados con baseline. SHA256 del método: 3a50b5953a560ca36583e555dce41b2294b58e9580f2db89f7cf2f42e8449342.
- Actualización de parche de expo-camera para SDK: exige regresión física; no equivale a verificar la cámara real.

## Verificación ejecutada
- Jest: 20 suites, 256 pruebas aprobadas.
- Typecheck de aplicación: aprobado.
- Expo Doctor: 21/21 comprobaciones aprobadas.
- Exportación JavaScript/Hermes iOS: aprobada, 1597 módulos y 36 assets; dist-rc-audit.
- La exportación NO es un IPA firmado ni un build nativo de App Store.
- Backend: Deno check de chat y emergency-contact aprobado; chat desplegado de nuevo tras corregir un error de tipo.
- Migración de permisos aplicada; chat y emergency-contact desplegados.
- No se han realizado llamadas al 112 ni contactos reales a cuidadores.

## Bloqueo externo inmediato
Faltan TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_FROM_NUMBER en el servidor.
Configurar desde el PC con scripts/CONFIGURAR_TELEFONIA_MEDICLARO.ps1.
El número y la cuenta deben permitir Voice y SMS a los destinos previstos.
No compartir credenciales en el chat. No se ha contratado ni comprado un servicio.
Sin estas credenciales no se verifica llamada real, SMS, callbacks de entrega o interacción telefónica.

## Trabajo pendiente antes de una RC
- Agente telefónico IA bidireccional: NO implementado ni verificado. El flujo existente de Gather/dígito 1 es aviso estático, no conversación IA.
- Telefonía: integrar y comprobar conversación bidireccional, estados, errores, cancelación e idempotencia con un cuidador autorizado.
- Premium: compra, restauración, caducidad y permisos en Apple Sandbox con dispositivo y cuenta de prueba; verificar asistente completo con entitlement real.
- iPhone físico: cámara/reconocimiento sin regresión, favoritos e historial tras cierre/reapertura, desconexión, audio Sulafat/Achird, pausa y cambio, accesibilidad y permisos.
- Caché no incluye cola de escrituras offline. DemoBackend/reset persistente no completado.
- Mesh: únicamente cola local; no BLE/P2P/relay ni cifrado extremo a extremo demostrado. Base64 no es cifrado. No presentar como funcional.
- Auditoría npm: 16 avisos (12 moderados, 4 altos, 0 críticos); npm audit fix sin force no los resuelve. Revisar mitigación/upstream de dependencias y herramientas Expo; no declarar seguridad resuelta.
- Revisión clínica del clasificador y mensajes de emergencia; las pruebas de frases no sustituyen validación clínica.
- Revisar privacidad, consentimiento, declaraciones médicas y uso de ubicación frente a Apple App Review Guidelines, especialmente 5.1.5: https://developer.apple.com/app-store/review/guidelines/
- No declarar validación técnica/legal de emergencia o cumplimiento Apple.
- Build nativo firmado, pruebas completas finales, incremento de versión/build, etiqueta RC e informe de revisión: pendientes.

## Salvaguardas y recuperación
- 112 autónomo real permanece desactivado hasta mecanismo técnica y legalmente validado.
- Cambios conservados en commits locales; no se ha realizado push remoto ni envío a Apple.
- Trabajo previo del usuario preservado. Backups fuera del repositorio en mediclaro_RC_WORK_BACKUP_20261002.
- Scripts de auditoría repetibles en scripts/audit-*-rc.mjs y verify-photo-unchanged-rc.mjs.
- Próximo paso externo: conectar cuenta de telefonía; después continuar desarrollo y pruebas. No llamar RC a este estado.
