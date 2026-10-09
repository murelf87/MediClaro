/**
 * Chat con el cuidador/a: días («Hoy», «Ayer», «Lunes 6 de octubre»), grupos de burbujas y mensajes que aún están
 * saliendo del teléfono (nunca se ven dos iguales).
 */
import { buildChatRows, chatDayLabel, mergeChat, sortChat, type ChatItem } from '../chatTimeline';

// Viernes 9 de octubre de 2026, 13:00 (hora del teléfono).
const NOW = new Date(2026, 9, 9, 13, 0, 0);
const at = (day: number, h: number, m: number) => new Date(2026, 9, day, h, m, 0).toISOString();
const msg = (id: string, senderId: string, createdAt: string, extra: Partial<ChatItem> = {}): ChatItem => ({
  id, linkId: 'L1', senderId, content: `Mensaje ${id}`, createdAt, readAt: null, status: 'sent', ...extra,
});

test('días: Hoy, Ayer, el día de la semana y el año si no es el actual', () => {
  expect(chatDayLabel(at(9, 8, 0), NOW)).toBe('Hoy');
  expect(chatDayLabel(at(8, 23, 59), NOW)).toBe('Ayer');
  expect(chatDayLabel(at(5, 10, 0), NOW)).toBe('Lunes 5 de octubre');
  expect(chatDayLabel(new Date(2025, 11, 31, 10, 0).toISOString(), NOW)).toBe('Miércoles 31 de diciembre de 2025');
  expect(chatDayLabel('no es una fecha', NOW)).toBe('');
});

test('filas: un separador por día y burbujas agrupadas por persona (menos de 5 minutos)', () => {
  const rows = buildChatRows(
    [
      msg('c', 'yo', at(9, 9, 3)),
      msg('a', 'ella', at(8, 19, 5)),
      msg('b', 'ella', at(8, 19, 7)),
      msg('d', 'yo', at(9, 9, 20)),
      msg('e', 'ella', at(9, 9, 21)),
    ],
    'yo',
    NOW,
  );
  expect(rows.map((r) => (r.kind === 'day' ? `[${r.label}]` : r.key))).toEqual(['[Ayer]', 'a', 'b', '[Hoy]', 'c', 'd', 'e']);
  const byKey = Object.fromEntries(rows.filter((r) => r.kind === 'message').map((r) => [r.key, r]));
  expect(byKey.a).toMatchObject({ mine: false, firstInGroup: true, lastInGroup: false });
  expect(byKey.b).toMatchObject({ firstInGroup: false, lastInGroup: true });
  // Misma persona pero 17 minutos después: otro grupo.
  expect(byKey.c).toMatchObject({ mine: true, firstInGroup: true, lastInGroup: true });
  expect(byKey.d).toMatchObject({ mine: true, firstInGroup: true, lastInGroup: true });
  expect(byKey.e).toMatchObject({ mine: false, firstInGroup: true });
});

test('orden estable: por hora y, a la misma hora, por identificador', () => {
  const same = at(9, 10, 0);
  expect(sortChat([msg('b', 'x', same), msg('a', 'x', same), msg('0', 'x', at(9, 9, 0))]).map((m) => m.id)).toEqual(['0', 'a', 'b']);
});

test('mensajes que aún salen: se ven al momento; si uno «fallido» sí llegó, no se duplica', () => {
  const server = [
    { id: 's1', linkId: 'L1', senderId: 'ella', content: '¿Cómo estás?', createdAt: at(9, 12, 0), readAt: null },
    { id: 's2', linkId: 'L1', senderId: 'yo', content: 'Estoy bien', createdAt: at(9, 12, 1), readAt: at(9, 12, 2) },
    { id: 's3', linkId: 'L1', senderId: 'yo', content: 'Ya me he tomado las pastillas', createdAt: at(9, 12, 3), readAt: null },
  ];
  const local: ChatItem[] = [
    // Falló la respuesta, pero el servidor sí lo guardó (s3): se queda el del servidor.
    msg('local-1', 'yo', at(9, 12, 3), { content: 'Ya me he tomado las pastillas', status: 'failed', clientKey: 'k1' }),
    // Aún saliendo.
    msg('local-2', 'yo', at(9, 12, 5), { content: '¿Puedes llamarme?', status: 'sending', clientKey: 'k2' }),
    // Fallido de verdad: se queda para «Reintentar».
    msg('local-3', 'yo', at(9, 12, 6), { content: 'Necesito que vengas', status: 'failed', clientKey: 'k3' }),
  ];
  const merged = mergeChat(server, local, 'yo');
  expect(merged.map((m) => `${m.id}:${m.status}`)).toEqual(['s1:sent', 's2:read', 's3:sent', 'local-2:sending', 'local-3:failed']);
});
