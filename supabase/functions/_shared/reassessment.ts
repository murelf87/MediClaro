// Reassess current patient statements without treating reassurance as a diagnosis.
import { norm } from './confidence.ts';
import { detectEmergency } from './safety.ts';
export type Reassessment = 'current' | 'past_serious' | 'improved' | 'none';
const RECOVERY = /\b(ya estoy bien|estoy mejor|me encuentro bien|me encuentro mejor|ya me encuentro bien|se me ha pasado|ya se me paso|ya no me duele|ya puedo respirar|me he recuperado|fue solo un mareo|puedo hablar bien|i feel better|i am fine now|i'm fine now|it has passed)\b/;
const NEGATED = /\b(?:ya )?no (?:tengo|siento) (?:dolor (?:fuerte )?(?:en el|de) pecho|dificultad para respirar)\b|\b(?:ya )?no me (?:falta el aire|ahogo)\b|\b(?:ya )?no (?:hay|tengo) (?:hinchazon|reaccion alergica)\b/g;
const SERIOUS = /\b(sobredosis|intoxicacion|envenen|he tomado demasiad|he tomado muchas|he tomado el doble|toda la caja|me he desmayado|se ha desmayado|perdida de conocimiento|convulsion|dolor (fuerte )?(en el|de) pecho|reaccion alergica|suicid|matarme|quitarme la vida|overdose|passed out|chest pain|suicide)\b/;
export function reassess(messages: { role: string; content: string }[]): Reassessment {
 const users = messages.filter(m=>m.role==='user');
 const last = norm(users.at(-1)?.content ?? '');
 const current = last.replace(NEGATED,'');
 if (detectEmergency(current)) return 'current';
 if (/\bno (estoy|me encuentro) (bien|mejor)\b|\bno puedo hablar\b|\bno se me ha pasado\b/.test(last)) return 'none';
 if (!RECOVERY.test(last) && last===current) return 'none';
 if (users.slice(0,-1).some(m=>SERIOUS.test(norm(m.content)))) return 'past_serious';
 return 'improved';
}
export function recoveryReply(state: Reassessment, country: string): string {
 if(country==='US') return state==='past_serious'
  ? 'You say you feel better. Your earlier symptoms may still need urgent medical assessment even if they have passed. Are any symptoms still present? If symptoms return or worsen, contact emergency services.'
  : 'You say you feel better. Are your symptoms completely gone, or is something still bothering you? If they return or worsen, seek medical help.';
 return state==='past_serious'
  ? 'Me dices que te encuentras mejor. Lo que describiste antes puede necesitar valoración médica urgente aunque haya pasado. ¿Ha desaparecido todo el malestar o queda algún síntoma? Si reaparece o empeora, pide ayuda de emergencia.'
  : 'Me dices que te encuentras mejor. ¿Ha desaparecido por completo el malestar o queda algún síntoma? Si vuelve o empeora, pide ayuda médica.';
}
