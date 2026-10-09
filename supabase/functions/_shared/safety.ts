// Detección de posibles emergencias ANTES de llamar a la IA.
// Si salta, no se mantiene conversación: la app muestra la pantalla de emergencia.
import { norm } from './confidence.ts';

const PATTERNS: RegExp[] = [
  /\b(he|ha|hemos|han) tomado (demasiad|muchas|varias|mas de la cuenta|el doble|toda la caja|un monton)/,
  /\bme he (equivocado|confundido) de (pastilla|medicamento|dosis|pildora|comprimido)/,
  /\b(sobredosis|intoxicad|envenenad|intoxicacion)/,
  /\bno (responde|reacciona|respira|se despierta|contesta)\b/,
  /\bme encuentro (muy|fatal|super) mal\b|\bme estoy muriendo\b|\bme muero\b/,
  /\b(dolor (fuerte )?(en el|de) pecho|no puedo respirar|me ahogo|me falta el aire)\b/,
  /\b(se ha desmayado|me he desmayado|perdida de conocimiento|convulsion)/,
  /\b(se me hincha|hinchazon de (la )?(cara|lengua|garganta)|reaccion alergica)/,
  /\b(un nino|mi nieto|mi nieta|el nino|la nina) (se ha tomado|ha tomado|se ha comido)/,
  /\b(quiero|voy a) (matarme|quitarme la vida|suicid)/,
  /\b(overdose|poisoned|too many pills|too much medicine)\b/,
  /\b(chest pain|cannot breathe|can't breathe|difficulty breathing|passed out|unconscious|seizure)\b/,
  /\b(swelling (of )?(the )?(face|tongue|throat)|severe allergic reaction)\b/,
  /\b(kill myself|suicide|end my life)\b/,
];

export function detectEmergency(text: string): boolean {
  const t = norm(text);
  return PATTERNS.some(p => p.test(t));
}

/** Recursos de emergencia por país (configurables). */
export const EMERGENCY: Record<string, { label: string; phone: string }[]> = {
  ES: [
    { label: 'Emergencias', phone: '112' },
    { label: 'Instituto Nacional de Toxicología', phone: '915620420' },
    { label: 'Línea de atención a la conducta suicida', phone: '024' },
  ],
  US: [
    { label: 'Emergency services', phone: '911' },
    { label: 'Poison Control', phone: '18002221222' },
    { label: 'Suicide & Crisis Lifeline', phone: '988' },
  ],
};
