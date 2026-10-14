import { buildPayload } from '../AssistantService';
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
