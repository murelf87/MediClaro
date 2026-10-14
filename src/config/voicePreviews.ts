/**
 * Textos FIJOS que suenan con la voz natural sin necesitar una cuenta Premium (función pública `tts-preview`):
 * pruebas de voz en Accesibilidad, «Escuchar cómo funciona» del perfil cuidador (gratuito) y la muestra del
 * Modo demostración.
 *
 * Deben coincidir letra por letra con la lista permitida del servidor (supabase/functions/tts-preview/index.ts).
 * Una prueba automática lo comprueba: si cambias un texto aquí, cámbialo también allí y vuelve a desplegar
 * `tts-preview`; si no, el botón respondería «Voz natural no disponible».
 */
export const VOICE_PREVIEW_TEXTS = {
  readingTest: 'Hola. Soy la voz de MediClaro. Te acompañaré con una lectura clara, natural y tranquila.',
  assistantTest:
    'Hola. Soy el asistente de MediClaro. Estoy aquí para explicarte la información de tus medicamentos de forma sencilla y clara.',
  caregiverIntro:
    'El perfil de cuidador es gratuito. Para vincularte, un paciente con MediClaro Premium te comparte su código de seis números o su QR. Tú envías la solicitud y el paciente debe aceptarla. Solo después recibirás sus avisos y mensajes de emergencia. Puedes dejar de ser cuidador cuando quieras. Si además contratas Premium, conservarás tu perfil de cuidador y tendrás también las funciones Premium para tu propio uso.',
  /** Muestra de Sulafat en el Modo demostración (y respuesta fija de ejemplo del asistente en ese modo). */
  demoSample:
    'El paracetamol sirve para aliviar el dolor leve o moderado y para bajar la fiebre. En adultos se suele tomar 1 comprimido de 1 g cada 6 a 8 horas, sin pasar de 3 al día. Si tienes dudas, consulta a tu farmacéutico.',
} as const;

/** ¿Es uno de los textos fijos que suenan sin cuenta (tts-preview)? */
export function isVoicePreviewText(text: string): boolean {
  const exact = text.replace(/\s+/g, ' ').trim();
  return (Object.values(VOICE_PREVIEW_TEXTS) as string[]).includes(exact);
}
