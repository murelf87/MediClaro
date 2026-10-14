# MediClaro — Voces y vista previa en Expo Go (08/10/2026)

Trabajo hecho sobre el snapshot del 08/10/2026 (commit base `aa69d84` + cambios sin confirmar). No se ha reconstruido nada ni cambiado el diseño. La identificación por foto no se ha tocado (hash `3a50b595…49342`, igual que antes).

Todos los cambios están también en `100_CAMBIOS_VOCES_EXPO_GO_2026-10-08.patch` (en tu repositorio: `git apply 100_CAMBIOS_VOCES_EXPO_GO_2026-10-08.patch`).

## 1. Voces: qué fallaba y qué se ha corregido

| Problema | Causa | Corrección |
|---|---|---|
| **«Hablar con Lucía» no grababa en iPhone** (aviso «Micrófono no disponible») | En el último cambio se quitó la activación de la grabación en la sesión de audio. En iPhone, expo-audio rechaza `record()` sin ella (`RecordingDisabledException`). | `configureAudioForRecording()` antes de grabar y vuelta al altavoz al terminar (`src/utils/audio.ts`, `AssistantScreen.tsx`). El mensaje se envía solo al minuto. Prueba de regresión incluida. |
| **«Escuchar cómo funciona» del cuidador nunca sonaba** | El texto no estaba en la lista permitida de `tts-preview` (respondía 403). | Texto añadido al servidor y centralizado en `src/config/voicePreviews.ts`. Una prueba comprueba que todos los textos públicos coinciden con el servidor. |
| **Acento**: la lectura y Lucía podían salir con acento no castellano (la explicación inicial sí es castellana) | La función `tts` no pedía español de España; `tts-preview` sí. | Las tres voces piden «Spanish from Spain (Castilian accent, es-ES)». |
| **Unidades y siglas mal leídas** («500 mg c/8 h», «llama al 112», enlaces, emojis) | El texto se enviaba tal cual. | `src/utils/speechText.ts`: «500 miligramos cada 8 horas», «6 a 8 horas», «250 miligramos por cada 5 mililitros», «llama al uno, uno, dos» (una dosis «Eutirox 112 microgramos» NO se toca), sin enlaces ni emojis, pausa al final de cada línea. Solo cambia lo que se oye, no lo que se ve. |
| **Palabras partidas** al final de respuestas largas de Lucía | Un texto de más de 3.200 caracteres se recortaba a mitad de palabra. | Nunca se recorta: si es largo se divide por frases y el servidor devuelve un único audio, con una pausa natural de 0,28 s entre trozos. |
| **Restos de la voz anterior al cambiar de pantalla** en «Cómo funciona» | Un único reproductor reutilizado; iOS conservaba unas décimas en el búfer. | Un reproductor nuevo por pantalla; el anterior se silencia, se para y se libera antes de empezar. Pausar antes de que empiece ya no la deja sonar. |
| **Voz «estirada» en la explicación inicial** | Se reproducía a 0,85× (velocidad pensada para la voz del sistema). | Misma escala que el resto de voces naturales: Normal = 1×. |
| **Lectura de prospectos muy largos** (cuando no hay resumen sencillo) | El prospecto completo superaba los límites (28.000 caracteres o el tiempo máximo del servidor) y la lectura fallaba. | Se leen los primeros apartados (unos 5 min) y se avisa: «El texto completo está en la ficha». |
| **Lectura «Preparando…» sin fin** si el audio no llegaba a sonar | Sin vigilancia de arranque. | Aviso a los 15 s y botón «Reintentar». |
| Selector «Voz de lectura» engañoso | Decía «medicamentos y prospectos», pero la lectura de medicamentos usa siempre Sulafat. | Ahora: «Voz de la explicación de la app» (Sulafat/Achird, las grabadas) y «Voz de Lucía» (Sulafat/Achird/Aoede). |
| Mensajes contradictorios | «Usaremos la voz del teléfono» y «No voy a sustituirla por la voz robótica…». | Mensajes claros y sin voz robótica: «No se ha podido preparar la voz. Comprueba tu conexión…». |
| Modo demostración: la lectura y el micrófono fallaban con error técnico | Sin servidor no se genera audio nuevo. | Muestra breve de Sulafat con aviso; el micrófono explica que necesita la cuenta real. |

Voces que se usan (sin cambios de criterio): **medicamentos = Sulafat siempre**; **Lucía = la elegida (Aoede por defecto)**; explicación inicial = Sulafat o Achird; emergencias críticas = canal propio con respaldo local (no depende de la red).

## 2. Hay que desplegar en el servidor (lo hago yo NO: este entorno no llega a Supabase)

```
npx supabase functions deploy tts tts-preview --project-ref ldonnvkysjalpmystoeq
```

Sin este despliegue la app funciona igual, pero el acento castellano en lectura/Lucía, la pausa entre trozos y la voz de «Escuchar cómo funciona» del cuidador no se activan.

## 3. Ver la app en tu iPhone con Expo Go

1. En el iPhone: instala o actualiza **Expo Go** (App Store). Debe admitir el SDK 57 (la versión actual de la App Store lo admite).
2. En el PC: descomprime el ZIP y haz doble clic en **`VER_EN_IPHONE_EXPO_GO.bat`**. La primera vez instala lo necesario (unos minutos).
3. Aparece un **QR** en la ventana: apúntalo con la Cámara del iPhone → «Abrir en Expo Go».
4. Deja la ventana abierta mientras lo usas. Usa túnel (funciona con datos móviles); si el túnel falla, prueba por la WiFi (iPhone y PC en la misma red).

Para oír las voces naturales reales entra con tu número (Premium de propietario) o pon tu `EXPO_PUBLIC_QA_ACCESS_TOKEN` en un `.env` en esa carpeta y usa «Probar MediClaro por perfil → Paciente Premium». Sin cuenta real, el Modo demostración solo reproduce muestras.

**En Expo Go NO funcionan** (sí en la build instalada de EAS): compras de Apple/Google (la pantalla de pago lo explica), llamadas de audio por internet con el cuidador (WebRTC: se avisa; chat y ubicación sí), y los permisos/plist propios de la app (Expo Go usa los suyos). Las notificaciones push en Expo Go son limitadas.

## 4. Verificado aquí

- TypeScript: 0 errores.
- Jest: **30 suites / 356 pruebas OK** (antes 26/320). Nuevas: texto para voz, sincronía con `tts-preview`, sesión de audio para grabar, SpeechService, narración sin solapes.
- Paquete iOS (Hermes) generado sin errores (1.927 módulos).
- Pantallas cambiadas abiertas en la versión web de QA sin errores (lectura, accesibilidad, Lucía, pago, perfil, inicio).

**No verificado aquí** (no se puede desde este entorno): voces reales de Gemini (el servidor no es accesible desde aquí) y prueba física en iPhone. Eso queda para tu prueba con Expo Go o con la próxima build interna.

## 5. Pendientes reales (sin cambios)

Apple IAP Sandbox (compra, restauración, caducidad; `storeVerification=false`), TURN para la llamada al cuidador, prueba física completa en iPhone y segundo móvil, inspección del Info.plist de la próxima IPA (micrófono y movimiento), 112 solo manual. La función `courtesy-access` (nueva, sin confirmar en git) no está conectada a ninguna pantalla ni desplegada por mí.
