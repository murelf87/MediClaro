# MediClaro · Gemini TTS production

## Implementado
- Dos voces permitidas: `Sulafat` y `Achird`.
- Preferencia independiente `readingVoice` para lectura de medicamentos/prospectos.
- Preferencia independiente `assistantVoice` para respuestas del Asistente IA.
- Valores iniciales: lectura `Sulafat`; asistente `Achird`.
- Selector y prueba de ambas voces en Accesibilidad.
- Edge Function `tts`: Gemini 3.8 Flash TTS, WAV 24 kHz mono.
- `GEMINI_API_KEY` solo en backend.
- Lista blanca de voces en servidor.
- Límite de 3200 caracteres por petición y rate-limit.
- Respaldo automático con `expo-speech` si TTS remoto falla.
- Emergencia mantiene voz local; no depende de Gemini TTS.

## Producción
```bash
supabase secrets set GEMINI_API_KEY=TU_CLAVE
supabase secrets set GEMINI_TTS_MODEL=gemini-3.8-flash-tts
supabase functions deploy tts
```

La app no debe contener ni exponer `GEMINI_API_KEY`.
