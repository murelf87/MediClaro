/**
 * Desplazamiento del chat de IA (reglas puras, para poder probarlas sin pantalla).
 *
 * El chat SIGUE lo último que se habló: se queda pegado al final y baja solo cuando llega algo (la pregunta, la respuesta
 * que se va escribiendo, los botones de debajo…). Solo lo suelta la persona cuando arrastra la lista hacia arriba para
 * releer; vuelve a pegarse cuando llega otra vez abajo, y siempre al enviar, al llegar una respuesta, al abrir el chat y al
 * cambiar de conversación.
 *
 * «Pegado» NO se deduce de la distancia al final en cada momento: una animación de desplazamiento, el teclado o una
 * respuesta que crece hacen que esa distancia cambie sin que la persona haya hecho nada (y en el iPhone el último evento de
 * una animación puede perderse). Por eso solo lo cambian los gestos de la persona y las llegadas al final.
 */

/** A esta distancia (en puntos) del final se considera que la persona está «abajo». */
export const NEAR_END_PX = 80;
/** Si la persona se ha alejado más que esto del final, aparece el botón «Ir al último mensaje». */
export const LATEST_BUTTON_FROM_PX = 160;

export interface ScrollMetrics {
  /** Posición actual de la lista (0 = arriba del todo). */
  y: number;
  /** Alto de todo el contenido. */
  contentHeight: number;
  /** Alto de la parte visible. */
  viewHeight: number;
}

/** Lo que falta por bajar hasta el final (0 = se ve lo último; negativo = ya se ha pasado por rebote). */
export function distanceToEnd({ y, contentHeight, viewHeight }: ScrollMetrics): number {
  return contentHeight - (y + viewHeight);
}

export interface ScrollEventInfo {
  /** ¿Seguía pegado al final antes de este evento? */
  pinned: boolean;
  /** Posición del evento anterior. */
  lastY: number;
  /** Posición de este evento. */
  y: number;
  /** Distancia al final en este evento. */
  distance: number;
  /** El dedo (o su inercia) está moviendo la lista ahora mismo. */
  touching: boolean;
}

/** ¿Debe seguir pegado al final después de este evento de desplazamiento? */
export function pinnedAfterScroll({ pinned, lastY, y, distance, touching }: ScrollEventInfo): boolean {
  // Mientras el dedo (o la inercia) mueve la lista, nadie se la lleva: se decide al soltar (ver `pinnedWhenSettled`).
  if (touching) return false;
  // Ha llegado abajo (o sigue abajo): pegado.
  if (distance <= NEAR_END_PX) return true;
  // Subió sin dedo (rueda del ratón o trackpad en el navegador): quiere releer.
  if (y < lastY - 4) return false;
  // Lo demás (el teclado se abre, la respuesta crece, cambia el tamaño…) no es cosa de la persona: no cambia nada.
  return pinned;
}

/** Al soltar la lista (o acabar la inercia): pegado si ha quedado abajo. */
export function pinnedWhenSettled(distance: number): boolean {
  return distance <= NEAR_END_PX;
}

/** ¿Se ofrece el botón «Ir al último mensaje»? Solo si la persona se ha alejado del final. */
export function showLatestButton(pinned: boolean, distance: number): boolean {
  return !pinned && distance > LATEST_BUTTON_FROM_PX;
}
