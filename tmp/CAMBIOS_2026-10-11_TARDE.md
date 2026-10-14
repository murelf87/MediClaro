# MediClaro · Cambios del 11/10/2026 (tarde-noche)

Todo se publica como actualización gratuita (canales preview y expo-go, runtime 1.0.1), sin build nueva. Se aplica al abrir la app, esperar 30 s, cerrarla del todo y volver a abrirla (dos veces). Última build instalada: 1.0.1 (35).

## Voz de toda la app (Panel → Voz)
- El propietario elige la voz de toda la app: **natural** (Google: Sulafat = mujer, Achird = hombre; cada persona elige) o **la del teléfono**. Migración `20261011180000_voice_mode.sql` (aplicada).
- La voz del teléfono sigue el género elegido según el nombre de las voces de Apple.

## Tope mensual de la voz natural
- Contador en el servidor (`voice_budget_take`, mes de Madrid, estimación 30 $ por millón de caracteres). Tope por defecto **25 $** (se cambia en Panel → Voz: 0, 10, 20, 25, 30, 50).
- Al llegar al tope (o si Google falla), todas las lecturas pasan solas a la voz del teléfono; nunca silencio. También la lectura larga de pantalla (VoiceScreen).
- Migración `20261011200000_voice_budget.sql` (aplicada). **Pendiente del propietario:** desplegar `npx supabase functions deploy tts` y `npx supabase functions deploy tts-preview --no-verify-jwt`.
- Facturación de Google: nivel de pago de la API de Gemini activado el 11/10 con prepago (30 €), **recarga automática desactivada** (sin crédito, Google corta la API y entra la voz del teléfono).

## Chat de IA
- Botón «Repetir explicación» en cada respuesta.
- Varias conversaciones: abrir una nueva y volver a las anteriores (se guardan).
- En cada globo, 3 botones grandes con animales: 🐌 muy muy lento, 🐢 lento, 🐇 normal. El elegido queda encendido y se recuerda.
- Al abrir el chat se va al último mensaje.

## Panel → Estado del sistema → «IA este mes»
- Preguntas al chat y personas distintas, fotos analizadas, coste estimado de IA (€), voz natural en $ frente al tope y preguntas de quienes más usan el chat (sin nombres, para ver si el límite diario es justo).
- Migración `20261011210000_ai_usage.sql` (aplicada y comprobada: anon sin acceso, solo propietarios con el panel abierto).

## Añadir medicamento: «Cada 4, 6, 8 o 12 horas»
- En «¿A qué horas?»: elegir el intervalo y la hora de la primera toma; la app calcula todas las horas del día (cada 8 h desde las 07:00 → 07:00, 15:00, 23:00; cruza la medianoche). Máximo 8 tomas al día (límite del servidor).
- Cada medicamento tiene sus propios avisos, independientes entre sí, que se programan solos al guardar.
- Cálculo en `timesEveryHours` (`supabase/functions/_shared/medicationCore.ts`) con pruebas.

## Pendiente
- Desplegar `tts` y `tts-preview`; probar la voz natural y los botones nuevos en el móvil; decir «sube» solo cuando todo vaya bien (la siguiente build sería 1.0.1 (36), con permiso previo).
- Apple: suscripciones en App Store Connect + clave de la API del servidor de App Store → activar la verificación de compras; activar GitHub Pages (Settings → Pages → main → /docs); datos legales del titular; cuenta de prueba para el revisor; claves de Stripe para Bizum y pago por familiar.
- Opcional: ajustar el límite diario de preguntas de Premium (hace falta un número) y, si se quiere, horas extra de IA por compra.
