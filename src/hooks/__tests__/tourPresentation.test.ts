/**
 * «Conocer MediClaro» como presentación continua: una sola pista de voz de principio a fin y un reloj que dice
 * qué imagen toca. Sin voz (o si el audio falla) el reloj avanza solo y las imágenes siguen.
 */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import type { AudioStatus } from 'expo-audio';
import { TOUR_START_DELAY_MS, TOUR_VOICE_STARTUP_MS, useTourPresentation, type TourPresentation } from '../useTourPresentation';

type Listener = (s: Partial<AudioStatus>) => void;
interface MockPlayer {
  source: string;
  currentTime: number;
  isLoaded: boolean;
  volume: number;
  shouldCorrectPitch: boolean;
  listeners: Listener[];
  play: jest.Mock;
  pause: jest.Mock;
  remove: jest.Mock;
  seekTo: jest.Mock;
  setPlaybackRate: jest.Mock;
  addListener: jest.Mock;
  emit: (s: Partial<AudioStatus>) => void;
}

const mockPlayers: MockPlayer[] = [];
jest.mock('expo-audio', () => ({
  createAudioPlayer: (source: string) => {
    const p: MockPlayer = {
      source,
      currentTime: 0,
      isLoaded: true,
      volume: 1,
      shouldCorrectPitch: false,
      listeners: [],
      play: jest.fn(),
      pause: jest.fn(),
      remove: jest.fn(),
      seekTo: jest.fn(async (t: number) => {
        p.currentTime = t;
      }),
      setPlaybackRate: jest.fn(),
      addListener: jest.fn((_event: string, fn: Listener) => {
        p.listeners.push(fn);
        return { remove: () => { p.listeners = p.listeners.filter((l) => l !== fn); } };
      }),
      emit: (s) => p.listeners.forEach((l) => l(s)),
    };
    mockPlayers.push(p);
    return p;
  },
}));
jest.mock('../../utils/audio', () => ({ configureAudioForSpeech: async () => undefined }));

const DURATION = 20;
let out: TourPresentation;
let tree: ReactTestRenderer | null = null;
type Props = { source?: string; soundOn?: boolean; active?: boolean };
function Probe(props: Props) {
  out = useTourPresentation({ source: props.source ?? 'full-sulafat', rate: 0.85, active: props.active ?? true, soundOn: props.soundOn ?? true, duration: DURATION });
  return null;
}
const last = () => mockPlayers[mockPlayers.length - 1];
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
};
async function mount(props: Props = {}) {
  await act(async () => {
    tree = create(React.createElement(Probe, props));
  });
  await act(async () => {
    jest.advanceTimersByTime(TOUR_START_DELAY_MS);
  });
  await flush();
}
const update = async (props: Props) => {
  await act(async () => tree!.update(React.createElement(Probe, props)));
  await flush();
};
const status = async (s: Partial<AudioStatus>) => act(async () => last().emit(s));

beforeEach(() => {
  jest.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mockPlayers.length = 0;
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = null;
  jest.useRealTimers();
});

test('empieza tras una breve espera con UNA sola pista para toda la explicación', async () => {
  await act(async () => {
    tree = create(React.createElement(Probe, {}));
  });
  await flush();
  expect(mockPlayers).toHaveLength(0);
  await act(async () => jest.advanceTimersByTime(TOUR_START_DELAY_MS));
  await flush();
  expect(mockPlayers).toHaveLength(1);
  expect(last().source).toBe('full-sulafat');
  expect(last().play).toHaveBeenCalledTimes(1);
  expect(last().shouldCorrectPitch).toBe(true);
  expect(last().setPlaybackRate).toHaveBeenCalledWith(1);
  expect(out.loading).toBe(true);
});

test('el reloj de las imágenes es la posición real de la voz', async () => {
  await mount();
  await status({ playing: true, currentTime: 3.25 });
  expect(out.position).toBe(3.25);
  expect(out.speaking).toBe(true);
  expect(out.loading).toBe(false);
  await status({ playing: true, currentTime: 9.5 });
  expect(out.position).toBe(9.5);
});

test('pausa y continúa con el mismo reproductor, sin volver a empezar', async () => {
  await mount();
  const p = last();
  await status({ playing: true, currentTime: 5 });
  p.currentTime = 5;
  await act(async () => out.pause());
  await flush();
  expect(p.pause).toHaveBeenCalled();
  expect(out.paused).toBe(true);
  await act(async () => jest.advanceTimersByTime(5000));
  expect(out.position).toBe(5);
  await act(async () => out.resume());
  await flush();
  expect(mockPlayers).toHaveLength(1);
  expect(p.seekTo).not.toHaveBeenCalled();
  expect(p.play).toHaveBeenCalledTimes(2);
});

test('ir a una parte salta en el audio y sigue sonando', async () => {
  await mount();
  await status({ playing: true, currentTime: 2 });
  await act(async () => out.seek(12));
  await flush();
  expect(last().seekTo).toHaveBeenCalledWith(12);
  expect(out.position).toBe(12);
});

test('al terminar la voz se muestra el final; «Ver otra vez» vuelve al principio', async () => {
  await mount();
  const p = last();
  await status({ playing: true, currentTime: 19.8 });
  p.currentTime = DURATION;
  await status({ playing: false, didJustFinish: true, currentTime: DURATION });
  expect(out.finished).toBe(true);
  expect(out.position).toBe(DURATION);
  await act(async () => out.restart());
  await flush();
  expect(out.finished).toBe(false);
  expect(p.seekTo).toHaveBeenCalledWith(0);
  expect(p.play).toHaveBeenCalledTimes(2);
});

test('sin voz no se crea audio y las imágenes avanzan solas hasta el final', async () => {
  await mount({ soundOn: false });
  expect(mockPlayers).toHaveLength(0);
  await act(async () => jest.advanceTimersByTime(4000));
  expect(out.position).toBeGreaterThan(3.5);
  expect(out.position).toBeLessThan(4.5);
  await act(async () => jest.advanceTimersByTime(20_000));
  expect(out.finished).toBe(true);
  expect(out.position).toBe(DURATION);
});

test('quitar la voz a mitad sigue sin cortes; al volver a ponerla suena desde el mismo punto', async () => {
  await mount();
  const p = last();
  await status({ playing: true, currentTime: 6 });
  p.currentTime = 6;
  await update({ soundOn: false });
  expect(p.pause).toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(3000));
  expect(out.position).toBeGreaterThan(8.5);
  const at = out.position;
  await update({ soundOn: true });
  expect(mockPlayers).toHaveLength(1);
  expect(p.seekTo).toHaveBeenCalledWith(at);
});

test('si el audio falla, la presentación sigue sin voz y se puede reintentar', async () => {
  await mount();
  const p = last();
  await status({ error: 'decode failed' });
  expect(out.voiceError).toBe(true);
  expect(p.remove).toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(2000));
  expect(out.position).toBeGreaterThan(1.5);
  await act(async () => out.retryVoice());
  await flush();
  expect(mockPlayers).toHaveLength(2);
  expect(last().play).toHaveBeenCalled();
});

test('si la voz no llega a sonar, no se queda la pantalla parada', async () => {
  await mount();
  await act(async () => jest.advanceTimersByTime(TOUR_VOICE_STARTUP_MS + 10));
  expect(out.voiceError).toBe(true);
  await act(async () => jest.advanceTimersByTime(1000));
  expect(out.position).toBeGreaterThan(0.5);
});

test('al salir de la pantalla (o bloquear el móvil) se para; al volver, sigue', async () => {
  await mount();
  const p = last();
  await status({ playing: true, currentTime: 4 });
  p.currentTime = 4;
  await update({ active: false });
  expect(p.pause).toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(3000));
  expect(out.position).toBe(4);
  await update({ active: true });
  expect(p.play).toHaveBeenCalledTimes(2);
});

test('una actualización vieja del audio no mueve la presentación tras cambiar de pista', async () => {
  await mount();
  const first = last();
  const stale = first.listeners[0];
  await update({ source: 'full-nueva' });
  expect(first.remove).toHaveBeenCalled();
  expect(last().source).toBe('full-nueva');
  await act(async () => stale({ playing: true, currentTime: 15 }));
  expect(out.position).not.toBe(15);
});
