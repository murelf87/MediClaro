/**
 * Clip del chat («Explicar un documento»): la cámara y la galería tienen que abrirse en el iPhone.
 *
 * Causa del fallo anterior: la hoja del clip era un `Modal` y, al elegir una opción, se cerraba y se pedía el selector a la
 * vez. El iPhone no presenta una ventana nativa (galería o cámara) mientras otra aún se está cerrando: no pasaba nada, la
 * llamada se quedaba esperando para siempre y el botón quedaba bloqueado. Estas pruebas fijan las reglas nuevas.
 */
import fs from 'fs';
import path from 'path';
import { AppError } from '../../../api/errors';
import {
  CAMERA_DENIED_CODE,
  CAMERA_DENIED_MESSAGE,
  PICK_FAILED_MESSAGE,
  PICK_FAILED_TITLE,
  SETTINGS_FAILED_TITLE,
  choosePhotosForDocument,
  type DocumentFlowDeps,
} from '../documentFlow';

function makeDeps(overrides: Partial<DocumentFlowDeps> = {}) {
  const deps = {
    aiConsentGranted: jest.fn(async () => true),
    pick: jest.fn(async () => ['foto1', 'foto2']),
    alert: jest.fn(async () => undefined),
    confirm: jest.fn(async () => false),
    openSettings: jest.fn(async () => true),
    ...overrides,
  };
  return deps as typeof deps & DocumentFlowDeps;
}

describe('choosePhotosForDocument', () => {
  test('con el permiso de la IA concedido, abre la cámara o la galería y devuelve las fotos sin molestar con avisos', async () => {
    const deps = makeDeps();
    await expect(choosePhotosForDocument('library', deps)).resolves.toEqual(['foto1', 'foto2']);
    expect(deps.pick).toHaveBeenCalledWith('library');
    await expect(choosePhotosForDocument('camera', deps)).resolves.toEqual(['foto1', 'foto2']);
    expect(deps.pick).toHaveBeenLastCalledWith('camera');
    expect(deps.alert).not.toHaveBeenCalled();
    expect(deps.confirm).not.toHaveBeenCalled();
  });

  test('sin el permiso de la IA no se abre ni la cámara ni la galería (y no se muestra ninguna pantalla encima)', async () => {
    const deps = makeDeps({ aiConsentGranted: jest.fn(async () => false) });
    await expect(choosePhotosForDocument('camera', deps)).resolves.toEqual([]);
    expect(deps.pick).not.toHaveBeenCalled();
    expect(deps.alert).not.toHaveBeenCalled();
    expect(deps.confirm).not.toHaveBeenCalled();
  });

  test('si la persona cancela el selector no pasa nada', async () => {
    const deps = makeDeps({ pick: jest.fn(async () => []) });
    await expect(choosePhotosForDocument('library', deps)).resolves.toEqual([]);
    expect(deps.alert).not.toHaveBeenCalled();
    expect(deps.confirm).not.toHaveBeenCalled();
  });

  describe('cámara denegada', () => {
    const denied = () => new AppError('permission_denied', CAMERA_DENIED_MESSAGE, { code: CAMERA_DENIED_CODE });

    test('se explica y «Abrir ajustes» lleva a los ajustes del teléfono', async () => {
      const deps = makeDeps({ pick: jest.fn(async () => { throw denied(); }), confirm: jest.fn(async () => true) });
      await expect(choosePhotosForDocument('camera', deps)).resolves.toEqual([]);
      expect(deps.confirm).toHaveBeenCalledTimes(1);
      const options = deps.confirm.mock.calls[0][0];
      expect(options.confirmText).toBe('Abrir ajustes');
      expect(options.message).toMatch(/galería/); // la galería sigue siendo una salida
      expect(deps.openSettings).toHaveBeenCalledTimes(1);
      expect(deps.alert).not.toHaveBeenCalled();
    });

    test('«Ahora no» no abre nada más', async () => {
      const deps = makeDeps({ pick: jest.fn(async () => { throw denied(); }), confirm: jest.fn(async () => false) });
      await expect(choosePhotosForDocument('camera', deps)).resolves.toEqual([]);
      expect(deps.openSettings).not.toHaveBeenCalled();
      expect(deps.alert).not.toHaveBeenCalled();
    });

    test('si no se pueden abrir los ajustes, se dice dónde están', async () => {
      const deps = makeDeps({
        pick: jest.fn(async () => { throw denied(); }),
        confirm: jest.fn(async () => true),
        openSettings: jest.fn(async () => false),
      });
      await expect(choosePhotosForDocument('camera', deps)).resolves.toEqual([]);
      expect(deps.alert).toHaveBeenCalledWith(SETTINGS_FAILED_TITLE, expect.any(String));
    });
  });

  describe('otros fallos', () => {
    test('un fallo con mensaje ya escrito para la persona lo enseña tal cual', async () => {
      const deps = makeDeps({
        pick: jest.fn(async () => { throw new AppError('unknown', 'No se ha podido abrir la galería. Inténtalo de nuevo.'); }),
      });
      await expect(choosePhotosForDocument('library', deps)).resolves.toEqual([]);
      expect(deps.alert).toHaveBeenCalledWith(PICK_FAILED_TITLE, 'No se ha podido abrir la galería. Inténtalo de nuevo.');
    });

    test('un fallo técnico nunca se enseña: se dice algo sencillo en español', async () => {
      const deps = makeDeps({ pick: jest.fn(async () => { throw new Error('ERR_MISSING_CURRENT_VIEW_CONTROLLER'); }) });
      await expect(choosePhotosForDocument('library', deps)).resolves.toEqual([]);
      expect(deps.alert).toHaveBeenCalledWith(PICK_FAILED_TITLE, PICK_FAILED_MESSAGE);
    });

    test('nunca lanza, pase lo que pase en el selector', async () => {
      const deps = makeDeps({ pick: jest.fn(async () => { throw 'algo raro'; }) });
      await expect(choosePhotosForDocument('camera', deps)).resolves.toEqual([]);
    });
  });
});

/** El código sin comentarios (los comentarios de cabecera explican la regla y nombran el `Modal`). */
function code(file: string): string {
  const source = fs.readFileSync(path.resolve(__dirname, file), 'utf8');
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
/** Texto de una función de la pantalla, desde su declaración hasta la siguiente. */
function between(source: string, from: string, to: string): string {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
}

describe('orden de las ventanas en la pantalla del asistente (regresión del iPhone)', () => {
  const screen = code('../AssistantScreen.tsx');

  test('la hoja del clip NO es un Modal: es una capa de la pantalla que desaparece al instante', () => {
    const sheet = code('../DocumentSheet.tsx');
    expect(sheet).not.toMatch(/<Modal\b/);
    expect(sheet).not.toMatch(/import\s*\{[^}]*\bModal\b[^}]*\}\s*from\s*'react-native'/);
    // Se pinta con la capa superior de Screen, no como hijo suelto del contenido.
    expect(screen).toMatch(/overlay=\{\s*<DocumentSheet/);
    expect(code('../../../components/Screen.tsx')).toContain('{overlay}');
  });

  test('el permiso de la IA se pide ANTES de abrir la hoja, con nada más abierto', () => {
    const open = between(screen, 'const openDocSheet = useCallback', 'const closeDocSheet');
    const ensure = open.indexOf('AiConsentService.ensure()');
    const show = open.indexOf('setDocOpen(true)');
    expect(ensure).toBeGreaterThan(-1);
    expect(show).toBeGreaterThan(ensure);
    // El teclado se baja primero: la hoja no puede quedar tapada por él.
    expect(open.indexOf('Keyboard.dismiss()')).toBeGreaterThan(-1);
    expect(open.indexOf('Keyboard.dismiss()')).toBeLessThan(ensure);
  });

  test('al elegir cámara o galería la hoja se cierra ANTES de abrir el selector y no se pide ningún permiso de pantalla entre medias', () => {
    const attach = between(screen, 'const attachDocument = useCallback', 'const beginVoiceMessage');
    const close = attach.indexOf('setDocOpen(false)');
    const pick = attach.indexOf('choosePhotosForDocument(');
    expect(close).toBeGreaterThan(-1);
    expect(pick).toBeGreaterThan(close);
    expect(attach).not.toContain('AiConsentService.ensure');
    // El botón no se queda bloqueado para siempre si algo falla.
    expect(attach).toMatch(/finally\s*\{\s*setDocBusy\(false\)/);
  });

  test('el botón del clip pide el permiso y abre la hoja con openDocSheet (no con setDocOpen directo)', () => {
    expect(screen).toMatch(/onPress=\{\(\) => void openDocSheet\(\)\}/);
    expect(screen).not.toMatch(/onPress=\{\(\) => setDocOpen\(true\)\}/);
  });

  test('en el navegador no se pide permiso de cámara (abre el selector de archivos); en el teléfono sí', () => {
    const photos = code('../documentPhotos.ts');
    expect(photos).toMatch(/source === 'camera' && Platform\.OS !== 'web'/);
    expect(photos).toContain('requestCameraPermissionsAsync');
    // Cuando la cámara está denegada lanza el error que la pantalla reconoce para ofrecer «Abrir ajustes».
    expect(photos).toMatch(/new AppError\('permission_denied', CAMERA_DENIED_MESSAGE, \{ code: CAMERA_DENIED_CODE \}\)/);
  });
});
