/** «Revisar la app» y los errores notificados dicen qué versión de las pantallas funciona en el móvil. */
import { jsVersion, jsVersionLabel, jsVersionTag } from '../appUpdate';

type Fake = Partial<typeof import('expo-updates')>;
const load = (fake: Fake | null) => () => fake as typeof import('expo-updates') | null;

test('sin actualizaciones (Expo Go, web o módulo ausente) no se muestra nada', () => {
  expect(jsVersion(load(null))).toBeNull();
  expect(jsVersion(load({ isEnabled: false } as Fake))).toBeNull();
  expect(
    jsVersion(() => {
      throw new Error('Cannot find native module ExpoUpdates');
    }),
  ).toBeNull();
  expect(jsVersionLabel(null)).toBeNull();
  expect(jsVersionTag(null)).toBeNull();
});

test('la de la build', () => {
  const v = jsVersion(load({ isEnabled: true, isEmbeddedLaunch: true, updateId: 'abcdef12-3456', createdAt: null, channel: 'preview' } as Fake));
  expect(v).toEqual({ embedded: true, id: 'abcdef12-3456', createdAt: null, channel: 'preview' });
  expect(jsVersionLabel(v)).toBe('la de la build');
  expect(jsVersionTag(v)).toBe('build');
});

test('una actualización publicada después (sin build nueva)', () => {
  const createdAt = new Date(2026, 9, 11, 16, 20);
  const v = jsVersion(load({ isEnabled: true, isEmbeddedLaunch: false, updateId: '1a2b3c4d-5e6f', createdAt, channel: 'preview' } as Fake));
  expect(v?.embedded).toBe(false);
  expect(jsVersionLabel(v)).toMatch(/^actualizada el 11\/10 a las 16:20 \(1a2b3c4d\)$/);
  expect(jsVersionTag(v)).toBe('1a2b3c4d');
});
