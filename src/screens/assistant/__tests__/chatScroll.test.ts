/**
 * El chat de IA va SIEMPRE a lo último que se habló y solo se queda quieto si la persona sube a releer.
 * Estas reglas no dependen de la distancia al final en cada momento (animaciones, teclado o respuestas que crecen la
 * cambian sin que la persona haya hecho nada): solo la mueven los gestos y las llegadas al final.
 */
import fs from 'fs';
import path from 'path';
import {
  LATEST_BUTTON_FROM_PX,
  NEAR_END_PX,
  distanceToEnd,
  pinnedAfterScroll,
  pinnedWhenSettled,
  showLatestButton,
} from '../chatScroll';

describe('distanceToEnd', () => {
  test('0 cuando se ve lo último, positiva cuando falta por bajar y negativa si hay rebote', () => {
    expect(distanceToEnd({ y: 500, contentHeight: 1000, viewHeight: 500 })).toBe(0);
    expect(distanceToEnd({ y: 100, contentHeight: 1000, viewHeight: 500 })).toBe(400);
    expect(distanceToEnd({ y: 520, contentHeight: 1000, viewHeight: 500 })).toBe(-20);
  });
});

describe('pinnedAfterScroll', () => {
  const base = { pinned: true, lastY: 500, y: 500, distance: 0, touching: false };

  test('abajo y sin dedo: sigue pegado', () => {
    expect(pinnedAfterScroll(base)).toBe(true);
    expect(pinnedAfterScroll({ ...base, pinned: false, distance: NEAR_END_PX })).toBe(true);
  });

  test('mientras el dedo (o su inercia) mueve la lista no se la lleva nadie, ni siquiera cerca del final', () => {
    expect(pinnedAfterScroll({ ...base, touching: true })).toBe(false);
    expect(pinnedAfterScroll({ ...base, touching: true, distance: 400, y: 100 })).toBe(false);
  });

  test('una respuesta que crece o el teclado alejan el final sin que la persona haga nada: sigue pegado', () => {
    // La lista no se ha movido (y igual) pero el final queda a 150 o a 300 puntos.
    expect(pinnedAfterScroll({ ...base, distance: 150 })).toBe(true);
    expect(pinnedAfterScroll({ ...base, distance: 300 })).toBe(true);
    // Un evento a mitad de una animación hacia el final (y sube, falta por llegar): tampoco lo suelta.
    expect(pinnedAfterScroll({ ...base, lastY: 380, y: 450, distance: 200 })).toBe(true);
  });

  test('si el contenido se encoge y la lista retrocede hasta el final, sigue pegado', () => {
    expect(pinnedAfterScroll({ ...base, lastY: 560, y: 500, distance: 0 })).toBe(true);
  });

  test('subir con la rueda o el trackpad (sin dedo) lo suelta cuando se aleja del final', () => {
    expect(pinnedAfterScroll({ ...base, lastY: 500, y: 380, distance: 120 })).toBe(false);
  });

  test('una vez suelto, solo vuelve a pegarse al llegar abajo', () => {
    const loose = { ...base, pinned: false };
    expect(pinnedAfterScroll({ ...loose, distance: 400, lastY: 300, y: 300 })).toBe(false);
    expect(pinnedAfterScroll({ ...loose, distance: 400, lastY: 300, y: 340 })).toBe(false);
    expect(pinnedAfterScroll({ ...loose, distance: 30, lastY: 300, y: 340 })).toBe(true);
  });
});

describe('pinnedWhenSettled', () => {
  test('al soltar: pegado solo si ha quedado abajo', () => {
    expect(pinnedWhenSettled(0)).toBe(true);
    expect(pinnedWhenSettled(NEAR_END_PX)).toBe(true);
    expect(pinnedWhenSettled(NEAR_END_PX + 1)).toBe(false);
    expect(pinnedWhenSettled(900)).toBe(false);
  });
});

describe('showLatestButton', () => {
  test('el botón «Ir al último mensaje» solo sale si la persona se alejó del final', () => {
    expect(showLatestButton(true, 2000)).toBe(false);
    expect(showLatestButton(false, LATEST_BUTTON_FROM_PX)).toBe(false);
    expect(showLatestButton(false, LATEST_BUTTON_FROM_PX + 1)).toBe(true);
    expect(showLatestButton(false, 0)).toBe(false);
  });
});

describe('pantalla del asistente (regresión)', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../AssistantScreen.tsx'), 'utf8');
  const readingBar = fs.readFileSync(path.resolve(__dirname, '../ReadingBar.tsx'), 'utf8');

  function bubbleSource(): string {
    const start = source.indexOf('function AssistantBubbleBase');
    const end = source.indexOf('function UserMessageBase');
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    return source.slice(start, end);
  }

  test('los animales de la velocidad y «Repetir explicación» salen desde que empieza la respuesta, no al acabar de escribirla', () => {
    const bubble = bubbleSource();
    expect(bubble).toContain('<ReadingBar');
    expect(readingBar).toContain('assistant-speed-');
    expect(readingBar).toContain('assistant-repeat');
    expect(readingBar).toContain('assistant-stop');
    // Antes la fila de animales colgaba de `done` (texto ya escrito del todo) y quedaba fuera de pantalla durante ~20 s.
    expect(bubble).not.toMatch(/done\s*&&\s*message\.text\.trim\(\)/);
    // La barra solo depende de que haya texto, no de que se haya acabado de escribir.
    expect(bubble).toMatch(/hasText\s*\?\s*\(\s*<ReadingBar/);
  });

  test('la barra de lectura va FUERA del globo (debajo del texto) y con animales pequeños', () => {
    const bubble = bubbleSource();
    // Lo primero que se cierra tras el texto de la respuesta es el globo; la barra viene después.
    const afterReply = bubble.slice(bubble.indexOf('</Pressable>'));
    const closesBubble = afterReply.indexOf('</View>');
    const opensBar = afterReply.indexOf('<ReadingBar');
    expect(closesBubble).toBeGreaterThan(-1);
    expect(opensBar).toBeGreaterThan(closesBubble);
    // Antes los dibujos eran de 32 puntos dentro de botones grandes con borde grueso.
    expect(readingBar).not.toMatch(/fontSize:\s*(3\d|[4-9]\d)/);
  });

  test('el chat se pega al final por gestos de la persona, no por la distancia (y no usa animaciones al seguir)', () => {
    expect(source).toContain('pinnedAfterScroll');
    expect(source).toContain('onScrollBeginDrag');
    expect(source).toContain('assistant-go-latest');
    expect(source).not.toContain('stickToBottom');
    expect(source).not.toMatch(/scrollToEnd\(\{\s*animated:\s*true/);
  });
});
