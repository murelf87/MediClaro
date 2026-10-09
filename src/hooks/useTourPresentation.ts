import { useCallback, useEffect, useRef, useState } from 'react';
import { createAudioPlayer, type AudioPlayer, type AudioSource, type AudioStatus } from 'expo-audio';
import { configureAudioForSpeech } from '../utils/audio';
import { naturalPlaybackRate } from '../utils/playbackRate';

/** Espera antes de empezar a hablar al abrir la pantalla (que dé tiempo a verla). */
export const TOUR_START_DELAY_MS = 600;
/** Si la voz no arranca en este tiempo, la presentación sigue sin voz (con aviso y «Reintentar»). */
export const TOUR_VOICE_STARTUP_MS = 12_000;
const TICK_MS = 250;

export interface TourPresentation {
  /** Segundo actual de la presentación (con voz o sin ella: las imágenes siguen el mismo reloj). */
  position: number;
  duration: number;
  /** La voz está sonando ahora mismo. */
  speaking: boolean;
  /** Preparando la voz (aún no ha sonado). */
  loading: boolean;
  paused: boolean;
  finished: boolean;
  /** La voz no se ha podido reproducir: la presentación sigue sola, sin voz. */
  voiceError: boolean;
  pause: () => void;
  resume: () => void;
  /** Va a un segundo concreto (p. ej. el principio de una parte) y sigue. */
  seek: (seconds: number) => void;
  /** Vuelve a empezar desde el principio. */
  restart: () => void;
  retryVoice: () => void;
}

/**
 * Presentación continua de «Conocer MediClaro»: UNA sola pista de voz de principio a fin (sin cortes entre
 * pantallas) y un reloj que dice qué imagen toca. Con la voz activada el reloj es la posición real del audio;
 * sin voz (o si el audio falla) el reloj avanza solo, a la misma velocidad, y las imágenes siguen pasando.
 */
export function useTourPresentation({
  source,
  rate,
  active,
  soundOn,
  duration,
}: {
  /** La pista de la explicación (TOUR_TRACK). Si cambia, se carga la nueva y se sigue en el mismo segundo. */
  source: AudioSource;
  /** Velocidad de lectura elegida por la persona (se traduce a una velocidad natural). */
  rate: number;
  /** Pantalla visible y app en primer plano. */
  active: boolean;
  soundOn: boolean;
  duration: number;
}): TourPresentation {
  const [position, setPosition] = useState(0);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [started, setStarted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [voiceError, setVoiceError] = useState(false);

  const positionRef = useRef(0);
  const playerRef = useRef<AudioPlayer | null>(null);
  const playerSource = useRef<AudioSource | null>(null);
  const listener = useRef<{ remove: () => void } | null>(null);
  const audioMode = useRef(false);
  const session = useRef(0);
  const playback = naturalPlaybackRate(rate);

  const moveTo = useCallback(
    (t: number) => {
      const clamped = Math.max(0, Math.min(duration, t));
      positionRef.current = clamped;
      setPosition(clamped);
    },
    [duration],
  );

  /** Silencia, para y libera el reproductor (nada queda sonando ni en ningún búfer). */
  const release = useCallback(() => {
    try { listener.current?.remove(); } catch { /* noop */ }
    listener.current = null;
    const player = playerRef.current;
    playerRef.current = null;
    playerSource.current = null;
    if (!player) return;
    try { player.volume = 0; } catch { /* noop */ }
    try { player.pause(); } catch { /* noop */ }
    try { player.remove(); } catch { /* noop */ }
  }, []);

  useEffect(() => release, [release]);

  // Primera vez: una pequeña espera antes de empezar.
  useEffect(() => {
    if (!active || started) return undefined;
    const timer = setTimeout(() => setStarted(true), TOUR_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active, started]);

  const running = active && started && !paused && !finished;
  const withVoice = soundOn && !voiceError;

  // ── Con voz: el reloj es la posición real del audio ──────────────────────
  useEffect(() => {
    if (!running || !withVoice) return undefined;
    const my = ++session.current;
    audioMode.current = true;
    let watchdog: ReturnType<typeof setTimeout> | null = null;
    let startAt = positionRef.current;
    let heard = false;
    const fail = () => {
      if (my !== session.current) return;
      setSpeaking(false);
      setLoading(false);
      release();
      setVoiceError(true);
    };
    const onStatus = (s: AudioStatus) => {
      if (my !== session.current) return;
      if (s.error) return fail();
      if (s.didJustFinish) {
        setSpeaking(false);
        setLoading(false);
        moveTo(duration);
        setFinished(true);
        return;
      }
      if (typeof s.playing === 'boolean') setSpeaking(s.playing);
      if (typeof s.currentTime === 'number' && s.playing) {
        moveTo(s.currentTime);
        if (!heard && s.currentTime > startAt + 0.05) {
          heard = true;
          setLoading(false);
          if (watchdog) clearTimeout(watchdog);
        }
      }
    };
    // «Preparando la voz» solo la primera vez (al reanudar suena al momento: sin parpadeos).
    if (!playerRef.current || playerSource.current !== source) setLoading(true);
    void (async () => {
      try {
        await configureAudioForSpeech();
        if (my !== session.current) return;
        let player = playerRef.current;
        if (!player || playerSource.current !== source) {
          release();
          player = createAudioPlayer(source, { updateInterval: TICK_MS });
          playerRef.current = player;
          playerSource.current = source;
          player.shouldCorrectPitch = true;
        }
        try { listener.current?.remove(); } catch { /* noop */ }
        listener.current = player.addListener('playbackStatusUpdate', onStatus);
        player.volume = 1;
        player.setPlaybackRate(playback);
        const target = positionRef.current;
        if (Math.abs((player.currentTime || 0) - target) > 0.3) {
          if (!player.isLoaded) await waitLoaded(player, TOUR_VOICE_STARTUP_MS);
          if (my !== session.current) return;
          await player.seekTo(target);
        }
        if (my !== session.current) return;
        startAt = target;
        player.play();
        watchdog = setTimeout(() => { if (!heard) fail(); }, TOUR_VOICE_STARTUP_MS);
      } catch {
        fail();
      }
    })();
    return () => {
      session.current += 1;
      audioMode.current = false;
      if (watchdog) clearTimeout(watchdog);
      try { playerRef.current?.pause(); } catch { /* noop */ }
      setSpeaking(false);
      setLoading(false);
    };
  }, [running, withVoice, source, playback, duration, moveTo, release]);

  // ── Sin voz: el reloj avanza solo, a la misma velocidad ──────────────────
  useEffect(() => {
    if (!running || withVoice) return undefined;
    let last = Date.now();
    const timer = setInterval(() => {
      const now = Date.now();
      const next = positionRef.current + ((now - last) / 1000) * playback;
      last = now;
      if (next >= duration) {
        moveTo(duration);
        setFinished(true);
      } else moveTo(next);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [running, withVoice, playback, duration, moveTo]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => {
    setStarted(true);
    setPaused(false);
  }, []);

  const seek = useCallback(
    (seconds: number) => {
      moveTo(seconds);
      setFinished(false);
      setStarted(true);
      setPaused(false);
      const player = playerRef.current;
      if (player && audioMode.current) void player.seekTo(positionRef.current).catch(() => undefined);
    },
    [moveTo],
  );

  const restart = useCallback(() => seek(0), [seek]);
  const retryVoice = useCallback(() => setVoiceError(false), []);

  return { position, duration, speaking, loading, paused, finished, voiceError, pause, resume, seek, restart, retryVoice };
}

/** Espera a que el audio esté cargado (para poder ir a un segundo concreto). */
function waitLoaded(player: AudioPlayer, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (player.isLoaded) return resolve();
    const timer = setTimeout(() => {
      sub.remove();
      reject(new Error('TOUR_AUDIO_NOT_LOADED'));
    }, timeoutMs);
    const sub = player.addListener('playbackStatusUpdate', (s: AudioStatus) => {
      if (!s.isLoaded) return;
      clearTimeout(timer);
      sub.remove();
      resolve();
    });
  });
}
