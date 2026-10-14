/**
 * Qué versión de las pantallas (el JavaScript) está funcionando en este móvil: la que venía con la build o una
 * actualización publicada después sin build nueva (expo-updates, canal «preview»). Se muestra en «Revisar la app» y
 * acompaña a los errores notificados, para saber si un arreglo ya ha llegado al móvil.
 */
export interface JsVersion {
  /** true = la incluida en la build (aún no ha llegado ninguna actualización). */
  embedded: boolean;
  id: string | null;
  createdAt: Date | null;
  channel: string | null;
}

type UpdatesModule = typeof import('expo-updates');

export function jsVersion(load: () => UpdatesModule | null = defaultLoad): JsVersion | null {
  try {
    const updates = load();
    if (!updates || !updates.isEnabled) return null;
    return {
      embedded: !!updates.isEmbeddedLaunch || !updates.updateId,
      id: updates.updateId ?? null,
      createdAt: updates.createdAt ?? null,
      channel: updates.channel ?? null,
    };
  } catch {
    return null;
  }
}

function defaultLoad(): UpdatesModule | null {
  // Carga perezosa: en Expo Go, en la web y en las pruebas puede no existir el módulo nativo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-updates') as UpdatesModule;
}

/** «la de la build» o «actualizada el 11/10 a las 16:20 (1a2b3c4d)». null si no hay actualizaciones (Expo Go, web). */
export function jsVersionLabel(v: JsVersion | null = jsVersion()): string | null {
  if (!v) return null;
  if (v.embedded || !v.id) return 'la de la build';
  const when = v.createdAt
    ? ` el ${v.createdAt.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })} a las ${v.createdAt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`
    : '';
  return `actualizada${when} (${v.id.slice(0, 8)})`;
}

/** Identificador corto para los datos técnicos de un error notificado («build» o los 8 primeros caracteres). */
export function jsVersionTag(v: JsVersion | null = jsVersion()): string | null {
  if (!v) return null;
  return v.embedded || !v.id ? 'build' : v.id.slice(0, 8);
}
