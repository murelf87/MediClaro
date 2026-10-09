# MediClaro — Production Build 26

Fecha: 2026-10-06
Versión: 1.0.1
Build iOS: 26
EAS Build ID: bec434f1-01a8-4352-9e77-d90310d6beb4
Distribución: STORE
Bundle ID: com.mediclaro.app

## Verificación automática aprobada
- Expo SDK/dependencias compatibles: PASS.
- TypeScript: PASS.
- Jest: 26 suites / 319 pruebas PASS.
- Identificación por fotografía protegida: 15 archivos sin cambios; SHA256 3a50b5953a560ca36583e555dce41b2294b58e9580f2db89f7cf2f42e8449342.
- Backend real: sesión, guardado, favoritos y limpieza PASS.
- Cuidador: 31 comprobaciones reales PASS.
- Reevaluación de emergencia: PASS.
- TTS Sulafat y Achird: HTTP 200, WAV RIFF válido tras despliegue.
- Chat: límite ampliado a 2400 tokens y regla de respuesta completa; desplegado.
- Respuestas del asistente: Markdown ligero normalizado antes de mostrar/leer.
- Tres perfiles de revisión internos añadidos y ocultos en build de App Store.

## Backend desplegado
- chat
- tts-preview

## App Store
- Credenciales Apple activas y perfil de aprovisionamiento renovado.
- Metadata es-ES/en-US validada y sincronizada para 1.0.1.
- Descripción corregida: identificación por fotografía, sin afirmar código de barras.
- Build 26 firmado correctamente.
- Envío a App Store Connect/TestFlight iniciado mediante EAS Submit.

## Pendiente antes de declarar App Review Ready
- Apple Sandbox: compra, restauración y caducidad; storeVerification sigue false hasta esa prueba real.
- TURN para audio cuidador-paciente: backend devuelve bloqueo explícito mientras falten credenciales TURN.
- Prueba física final en iPhone/segundo móvil: cámara, audio bidireccional, push con pantalla bloqueada, compra/restore y persistencia.
- Critical Alerts de Apple y background GPS/audio no se afirman como disponibles mientras no exista entitlement/implementación.
- Agente telefónico IA autónomo no forma parte de esta build.
- 112 permanece exclusivamente manual.
