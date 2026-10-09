import { buildPayload, currentEmergencyMessage, normalizeAssistantText } from '../AssistantService';
import type { AssistantMessage } from '../../types';

const msg = (role: 'user' | 'assistant', text: string, extra: Partial<AssistantMessage> = {}): AssistantMessage => ({
  id: Math.random().toString(36),
  role,
  text,
  createdAt: new Date().toISOString(),
  ...extra,
});

describe('AssistantService.buildPayload (contrato del backend: turnos alternos)', () => {
  it('empieza por el usuario (quita saludos del asistente)', () => {
    const out = buildPayload([msg('assistant', 'Hola'), msg('user', '¿Para qué sirve?')]);
    expect(out).toEqual([{ role: 'user', content: '¿Para qué sirve?' }]);
  });
  it('fusiona turnos seguidos del mismo rol', () => {
    const out = buildPayload([msg('user', 'Hola'), msg('user', '¿Y la dosis?')]);
    expect(out).toEqual([{ role: 'user', content: 'Hola\n¿Y la dosis?' }]);
  });
  it('excluye mensajes con error y avisos de urgencia', () => {
    const out = buildPayload([
      msg('user', 'fallo', { status: 'error' }),
      msg('user', 'pregunta'),
      msg('assistant', 'urgencia', { emergency: { resources: [] } }),
    ]);
    expect(out).toEqual([{ role: 'user', content: 'pregunta' }]);
  });
  it('envía como máximo los 10 últimos turnos y recorta a 1000 caracteres', () => {
    const many: AssistantMessage[] = [];
    for (let i = 0; i < 30; i += 1) many.push(msg(i % 2 === 0 ? 'user' : 'assistant', `m${i}`));
    many.push(msg('user', 'x'.repeat(1500)));
    const out = buildPayload(many);
    expect(out.length).toBeLessThanOrEqual(10);
    expect(out[out.length - 1].content.length).toBe(1000);
  });
});

describe('Assistant text normalization',()=>{
 test('removes lightweight Markdown without cutting content',()=>{
  expect(normalizeAssistantText('La **sertralina** es un medicamento.\n\n- Uso habitual')).toBe('La sertralina es un medicamento.\n\n• Uso habitual');
 });
});

describe('Current emergency navigation',()=>{
 const emergency=()=>msg('assistant','possible emergency',{emergency:{resources:[]}});
 test('latest emergency can initiate the flow',()=>{const latest=emergency();expect(currentEmergencyMessage([msg('user','symptom'),latest])).toBe(latest);});
 test('reassuring reply prevents reopening the historical alert',()=>expect(currentEmergencyMessage([emergency(),msg('user','ya estoy bien'),msg('assistant','reassessment')])).toBeNull());
 test('a new user message cancels the pending historical alert',()=>expect(currentEmergencyMessage([emergency(),msg('user','estoy mejor',{status:'sending'})])).toBeNull());
 test('empty conversation has no emergency',()=>expect(currentEmergencyMessage([])).toBeNull());
});
