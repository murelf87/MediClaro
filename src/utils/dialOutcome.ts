import { AppState, Platform } from 'react-native';

/** Sin ningún cambio de estado en este tiempo, se da por hecho que el teléfono marcó sin preguntar. */
const DIAL_PROMPT_GRACE_MS = 1500;
/** Si el aviso del sistema estuvo abierto más que esto, se trata como llamada hecha (nunca se oculta una llamada real). */
const DIAL_PROMPT_LONG_MS = 20000;

/**
 * iOS pregunta «Cancelar / Llamar 112» antes de marcar. Este aviso deja la app «inactive»:
 *  - si se pulsa Llamar, la app pasa a segundo plano («background») → llamada hecha;
 *  - si se pulsa Cancelar, la app vuelve a «active» sin pasar por segundo plano → no se llamó,
 *    y la persona se queda en la pantalla donde estaba.
 * En Android se abre el marcador (la app pasa a segundo plano), así que siempre cuenta como hecha.
 * Ante cualquier duda se responde «hecha»: como mucho se muestra «¿Has podido hablar con el 112?».
 */
export function waitForDialOutcome(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(true);
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let inactiveSince: number | null = null;
    const finish = (placed: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(grace);
      sub.remove();
      resolve(placed);
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') finish(true);
      else if (state === 'inactive') inactiveSince ??= Date.now();
      else if (state === 'active' && inactiveSince !== null) {
        finish(Date.now() - inactiveSince > DIAL_PROMPT_LONG_MS);
      }
    });
    const grace = setTimeout(() => {
      if (inactiveSince === null) finish(true);
    }, DIAL_PROMPT_GRACE_MS);
  });
}
