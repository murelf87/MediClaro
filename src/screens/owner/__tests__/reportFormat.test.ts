import { contactAction, reportFacts, reportPlace } from '../reportFormat';

const ctx = {
  platform: 'ios',
  osVersion: '18.1',
  appVersion: '1.0.0',
  build: '35',
  runtime: 'app',
  account: 'anonymous',
  premium: false,
  area: 'Voz',
  screen: '/medication/[id]',
  screens: '/ → /medication/[id] → /help',
  fontSize: 'muy_grande',
  easyMode: true,
  readingVoice: 'Sulafat',
  assistantVoice: 'Achird',
  payments: 'store,card',
  preview: 'free',
  timeZone: 'Europe/Madrid',
};

describe('bandeja «Errores notificados»', () => {
  test('resumen corto para la lista', () => {
    expect(reportPlace(ctx)).toBe('iPhone · v1.0.0 (build 35)');
    expect(reportPlace({ platform: 'android', appVersion: '1.0.0', runtime: 'expo-go' })).toBe('Android · v1.0.0 · Expo Go');
    expect(reportPlace(null)).toBe('');
  });
  test('datos técnicos en español', () => {
    const facts = Object.fromEntries(reportFacts(ctx).map((f) => [f.label, f.value]));
    expect(facts).toMatchObject({
      'Parte de la app': 'Voz',
      'Pantalla anterior': '/medication/[id]',
      'Versión de MediClaro': '1.0.0 · build 35',
      Dónde: 'App instalada',
      Sistema: 'iPhone · iOS 18.1',
      Cuenta: 'Básico (sin teléfono)',
      Premium: 'No',
      'Tamaño de letra': 'Muy grande',
      'Modo fácil': 'Activado',
      'Voz de lectura': 'Sulafat',
      'Voz del asistente': 'Achird',
      'Pagos en esta versión': 'Apple/Google y tarjeta',
      'Vista previa del propietario': 'Básico',
      'Zona horaria': 'Europe/Madrid',
    });
    expect(Object.fromEntries(reportFacts({ platform: 'android', osVersion: '34' }).map((f) => [f.label, f.value])).Sistema).toBe('Android · API 34');
    expect(reportFacts({})).toEqual([]);
  });
  test('contestar: llamar o escribir', () => {
    expect(contactAction('600 123 456')).toEqual({ kind: 'tel', url: 'tel:600123456', label: 'Llamar al 600 123 456' });
    expect(contactAction('+34 600-123-456')).toMatchObject({ kind: 'tel', url: 'tel:+34600123456' });
    expect(contactAction('ana@example.com')).toEqual({ kind: 'mail', url: 'mailto:ana@example.com', label: 'Escribir a ana@example.com' });
    expect(contactAction('llamadme por la tarde')).toBeNull();
    expect(contactAction('')).toBeNull();
    expect(contactAction(null)).toBeNull();
  });
});
