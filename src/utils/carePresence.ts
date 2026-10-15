/**
 * «En línea» en el chat de cuidado (Fallos_mediclaro.pdf).
 * Funciones puras para leer el estado de presencia del canal en tiempo real de Supabase.
 */

/** Nombre del canal de presencia de una vinculación (solo lo conocen las dos personas vinculadas). */
export function carePresenceChannel(linkId: string): string {
  return `care-presence:${linkId}`;
}

/** ¿Está la otra persona en el canal? `state` es `channel.presenceState()` (claves = id de usuario). */
export function isOtherOnline(state: Record<string, unknown[] | undefined> | null | undefined, otherId: string | null | undefined): boolean {
  if (!state || !otherId) return false;
  const entries = state[otherId];
  return Array.isArray(entries) && entries.length > 0;
}

/** Texto bajo el nombre en la cabecera del chat. */
export function presenceCaption(online: boolean, fallback: string): string {
  return online ? 'En línea' : fallback;
}
