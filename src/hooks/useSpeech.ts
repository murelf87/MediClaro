/**
 * Lectura en voz alta por secciones (expo-speech, voz del sistema en español).
 * Progreso real por secciones (no se simula una duración).
 * En Android, "pausa" detiene y reanuda desde el inicio de la sección actual.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

export interface SpeechSection {
  id: string;
  title: string;
  text: string;
}

export type SpeechStatus = 'idle' | 'loading' | 'speaking' | 'paused' | 'finished' | 'error';

export function useSectionSpeech(sections: SpeechSection[], rate: number) {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const token = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const sectionsRef = useRef(sections);
  sectionsRef.current = sections;

  const speakFrom = useCallback((i: number) => {
    const list = sectionsRef.current;
    if (i >= list.length) {
      setStatus('finished');
      return;
    }
    const my = ++token.current;
    indexRef.current = i;
    setIndex(i);
    setStatus('speaking');
    const section = list[i];
    Speech.speak(`${section.title}. ${section.text}`, {
      language: 'es-ES',
      rate: rateRef.current,
      pitch: 1,
      onDone: () => {
        if (my !== token.current) return;
        speakFrom(i + 1);
      },
      onError: () => {
        if (my !== token.current) return;
        setStatus('error');
      },
    });
  }, []);

  const play = useCallback(() => {
    if (status === 'paused' && Platform.OS === 'ios') {
      Speech.resume();
      setStatus('speaking');
      return;
    }
    token.current += 1;
    Speech.stop();
    speakFrom(status === 'finished' ? 0 : indexRef.current);
  }, [speakFrom, status]);

  const pause = useCallback(() => {
    if (Platform.OS === 'ios') {
      Speech.pause();
    } else {
      token.current += 1;
      Speech.stop();
    }
    setStatus('paused');
  }, []);

  const stop = useCallback(() => {
    token.current += 1;
    Speech.stop();
    setStatus('idle');
    indexRef.current = 0;
    setIndex(0);
  }, []);

  const goTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(sectionsRef.current.length - 1, i));
    token.current += 1;
    Speech.stop();
    speakFrom(clamped);
  }, [speakFrom]);

  // Cambiar la velocidad reinicia la sección actual con la nueva velocidad
  const setRateAndRestart = useCallback((newRate?: number) => {
    if (typeof newRate === 'number') rateRef.current = newRate;
    if (status === 'speaking') {
      token.current += 1;
      Speech.stop();
      speakFrom(indexRef.current);
    }
  }, [speakFrom, status]);

  useEffect(() => () => {
    token.current += 1;
    Speech.stop();
  }, []);

  return { status, index, play, pause, stop, goTo, restartWithNewRate: setRateAndRestart };
}

/** Lectura simple de un texto (mensajes del asistente, mensaje al operador...). */
export function useSimpleSpeech() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const token = useRef(0);

  const speak = useCallback((id: string, text: string, rate = 0.85) => {
    const my = ++token.current;
    Speech.stop();
    setSpeakingId(id);
    Speech.speak(text, {
      language: 'es-ES',
      rate,
      onDone: () => {
        if (my === token.current) setSpeakingId(null);
      },
      onStopped: () => {
        if (my === token.current) setSpeakingId(null);
      },
      onError: () => {
        if (my === token.current) setSpeakingId(null);
      },
    });
  }, []);

  const stop = useCallback(() => {
    token.current += 1;
    Speech.stop();
    setSpeakingId(null);
  }, []);

  useEffect(() => () => {
    token.current += 1;
    Speech.stop();
  }, []);

  return { speakingId, speak, stop };
}

// ─── Gemini TTS: voces naturales seleccionables ──────────────────────────────
// La lectura Premium y el asistente no sustituyen la voz natural por la voz robótica
// del dispositivo. Emergencias críticas conservan su canal de voz independiente.

import { createAudioPlayer, type AudioPlayer, type AudioSource, type AudioStatus } from 'expo-audio';
import { DemoMode, SpeechService, type GeminiVoice } from '../services';
import { configureAudioForSpeech } from '../utils/audio';
import { naturalPlaybackRate } from '../utils/playbackRate';
import { showAlert } from '../utils/dialogs';
import { isVoicePreviewText } from '../config/voicePreviews';

/** Si el reproductor no arranca en este tiempo, se avisa (nunca se queda «Preparando…» para siempre). */
const PLAYER_STARTUP_MS = 15_000;

function inDemoMode(): boolean {
  try {
    return DemoMode?.isActive?.() === true;
  } catch {
    return false;
  }
}

const NATURAL_VOICE_UNAVAILABLE = 'No se ha podido preparar la voz. Comprueba tu conexión a internet y vuelve a intentarlo.';
const DEMO_VOICE_UNAVAILABLE =
  'En el modo demostración solo suenan los ejemplos de voz. Entra con tu cuenta de MediClaro para escuchar todas las respuestas con voz natural.';

type GeminiPlayerRef = {
  player: AudioPlayer;
  subscription: { remove: () => void };
  cleanupFile: () => void;
  startupTimer?: ReturnType<typeof setTimeout>;
};

const playbackRate = naturalPlaybackRate;

function releaseGeminiPlayer(ref: { current: GeminiPlayerRef | null }) {
  const current = ref.current;
  ref.current = null;
  if (!current) return;
  if (current.startupTimer) clearTimeout(current.startupTimer);
  try { current.subscription.remove(); } catch { /* noop */ }
  try { current.player.remove(); } catch { /* noop */ }
  try { current.cleanupFile(); } catch { /* noop */ }
}

/** Reproducción continua: genera toda la explicación y la reproduce como un único audio. */
export function useGeminiContinuousSpeech(parts: string[], rate: number, voice: GeminiVoice = 'Sulafat') {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const playerRef = useRef<GeminiPlayerRef | null>(null);
  const token = useRef(0);
  const partsRef = useRef(parts);
  const rateRef = useRef(rate);
  const voiceRef = useRef(voice);
  const statusRef = useRef<SpeechStatus>('idle');
  partsRef.current = parts;
  rateRef.current = rate;
  voiceRef.current = voice;
  statusRef.current = status;

  const setSpeechStatus = useCallback((next: SpeechStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const durationRef = useRef(0);

  const fail = useCallback((my: number, message: string) => {
    if (my !== token.current) return;
    releaseGeminiPlayer(playerRef);
    setSpeechStatus('error');
    void showAlert(`${voiceRef.current} no está disponible`, message);
  }, [setSpeechStatus]);

  const prepareAndPlay = useCallback(async () => {
    const cleanParts = partsRef.current.map((p) => p.trim()).filter(Boolean);
    if (!cleanParts.length) return;
    const my = ++token.current;
    releaseGeminiPlayer(playerRef);
    Speech.stop();
    durationRef.current = 0;
    setCurrentTime(0);
    setDuration(0);
    setSpeechStatus('loading');
    try {
      await configureAudioForSpeech();
      const audio = await SpeechService.synthesizeContinuous(cleanParts, voiceRef.current);
      if (my !== token.current) { audio.cleanup(); return; }

      const player = createAudioPlayer(audio.uri, { downloadFirst: true, updateInterval: 200 });
      player.playbackRate = playbackRate(rateRef.current);
      player.shouldCorrectPitch = true;
      const subscription = player.addListener('playbackStatusUpdate', (s: AudioStatus) => {
        if (my !== token.current) return;
        if (s.error) {
          fail(my, 'No se ha podido reproducir la explicación completa. Comprueba la conexión y vuelve a intentarlo.');
          return;
        }
        if (Number.isFinite(s.currentTime)) setCurrentTime(Math.max(0, s.currentTime));
        if (Number.isFinite(s.duration) && s.duration > 0) {
          durationRef.current = s.duration;
          setDuration(s.duration);
        }
        if (s.playing) {
          const startup = playerRef.current?.startupTimer;
          if (startup) {
            clearTimeout(startup);
            if (playerRef.current) playerRef.current.startupTimer = undefined;
          }
          if (statusRef.current !== 'paused') setSpeechStatus('speaking');
        }
        if (s.didJustFinish) {
          setCurrentTime(s.duration || durationRef.current);
          setSpeechStatus('finished');
        }
      });
      playerRef.current = {
        player,
        subscription,
        cleanupFile: audio.cleanup,
        // Si el audio no llega a sonar, se avisa en lugar de quedarse «Preparando…» para siempre.
        startupTimer: setTimeout(() => fail(my, NATURAL_VOICE_UNAVAILABLE), PLAYER_STARTUP_MS),
      };
      player.play();
    } catch {
      fail(my, NATURAL_VOICE_UNAVAILABLE);
    }
  }, [fail, setSpeechStatus]);

  const play = useCallback(() => {
    const current = playerRef.current?.player;
    if (statusRef.current === 'paused' && current) {
      current.play();
      setSpeechStatus('speaking');
      return;
    }
    if (statusRef.current === 'finished' && current) {
      void current.seekTo(0).then(() => {
        setCurrentTime(0);
        current.play();
        setSpeechStatus('speaking');
      }).catch(() => void prepareAndPlay());
      return;
    }
    void prepareAndPlay();
  }, [prepareAndPlay, setSpeechStatus]);

  const pause = useCallback(() => {
    const current = playerRef.current;
    if (!current) return;
    if (current.startupTimer) {
      clearTimeout(current.startupTimer);
      current.startupTimer = undefined;
    }
    current.player.pause();
    setSpeechStatus('paused');
  }, [setSpeechStatus]);

  const replay = useCallback(() => {
    const current = playerRef.current?.player;
    if (!current) { void prepareAndPlay(); return; }
    void current.seekTo(0).then(() => {
      setCurrentTime(0);
      current.play();
      setSpeechStatus('speaking');
    }).catch(() => void prepareAndPlay());
  }, [prepareAndPlay, setSpeechStatus]);

  useEffect(() => {
    if (!playerRef.current) return;
    playerRef.current.player.playbackRate = playbackRate(rate);
    playerRef.current.player.shouldCorrectPitch = true;
  }, [rate]);

  useEffect(() => {
    token.current += 1;
    releaseGeminiPlayer(playerRef);
    setCurrentTime(0);
    setDuration(0);
    setSpeechStatus('idle');
  }, [parts]);

  useEffect(() => () => {
    token.current += 1;
    releaseGeminiPlayer(playerRef);
    Speech.stop();
  }, []);

  return {
    status,
    currentTime,
    duration,
    progress: duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0,
    play,
    pause,
    replay,
  };
}

/** Lectura por secciones con Gemini TTS. Conservada para otros usos internos. */
export function useGeminiSectionSpeech(sections: SpeechSection[], rate: number, voice: GeminiVoice) {
  const [status, setStatus] = useState<SpeechStatus>('idle');
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const token = useRef(0);
  const statusRef = useRef<SpeechStatus>('idle');
  const deviceVoiceRef = useRef(false);
  const preparationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPreparation = () => {
    if (preparationRef.current) clearTimeout(preparationRef.current);
    preparationRef.current = null;
  };
  const playerRef = useRef<GeminiPlayerRef | null>(null);
  const rateRef = useRef(rate);
  const voiceRef = useRef(voice);
  const sectionsRef = useRef(sections);
  rateRef.current = rate;
  voiceRef.current = voice;
  sectionsRef.current = sections;
  statusRef.current = status;

  const setSpeechStatus = useCallback((next: SpeechStatus) => {
    statusRef.current = next;
    setStatus(next);
  }, []);

  const speakFrom = useCallback(async (i: number, deviceOnly = false) => {
    const list = sectionsRef.current;
    if (i >= list.length) {
      setSpeechStatus('finished');
      return;
    }
    const my = ++token.current;
    clearPreparation();
    releaseGeminiPlayer(playerRef);
    Speech.stop();
    indexRef.current = i;
    setIndex(i);
    setSpeechStatus('loading');
    const section = list[i];
    const text = `${section.title ? `${section.title}. ` : ''}${section.text}`.trim();
    deviceVoiceRef.current = deviceOnly;
    let fallbackStarted = false;
    let pendingCleanup: (() => void) | undefined;
    const fallback = () => {
      if (my !== token.current || fallbackStarted) return;
      fallbackStarted = true;
      clearPreparation();
      releaseGeminiPlayer(playerRef);
      pendingCleanup?.();
      pendingCleanup = undefined;
      deviceVoiceRef.current = false;
      setSpeechStatus('error');
      void showAlert(
        'Sulafat no está disponible',
        'No se ha podido preparar la voz. Comprueba tu conexión a internet y pulsa reproducir para intentarlo de nuevo.',
      );
    };
    if (deviceOnly) { fallback(); return; }
    preparationRef.current = setTimeout(fallback, 20_000);
    try {
      await configureAudioForSpeech();
      const audio = await SpeechService.synthesize(text, voiceRef.current, 'reading');
      if (my === token.current) clearPreparation();
      if (my !== token.current || fallbackStarted || statusRef.current === 'paused') {
        audio.cleanup();
        return;
      }
      pendingCleanup = audio.cleanup;
      const player = createAudioPlayer(audio.uri, { downloadFirst: true, updateInterval: 200 });
      playerRef.current = { player, subscription: { remove: () => undefined }, cleanupFile: audio.cleanup };
      pendingCleanup = undefined;
      player.playbackRate = playbackRate(rateRef.current);
      player.shouldCorrectPitch = true;
      const subscription = player.addListener('playbackStatusUpdate', (s: AudioStatus) => {
        if (my !== token.current) return;
        if (s.error) {
          fallback();
          return;
        }
        if (fallbackStarted) return;
        if (s.playing) {
          if (playerRef.current?.startupTimer) clearTimeout(playerRef.current.startupTimer);
          if (statusRef.current !== 'paused') setSpeechStatus('speaking');
        }
        if (s.didJustFinish) {
          releaseGeminiPlayer(playerRef);
          void speakFrom(i + 1);
        }
      });
      playerRef.current = { player, subscription, cleanupFile: audio.cleanup, startupTimer: setTimeout(fallback, 10_000) };
      player.play();
    } catch {
      if (my !== token.current) { pendingCleanup?.(); return; }
      clearPreparation();
      fallback();
    }
  }, [setSpeechStatus]);

  const play = useCallback(() => {
    if (statusRef.current === 'paused' && playerRef.current) {
      playerRef.current.player.play();
      setSpeechStatus('loading');
      return;
    }
    void speakFrom(statusRef.current === 'finished' ? 0 : indexRef.current, statusRef.current === 'paused' && deviceVoiceRef.current);
  }, [speakFrom, setSpeechStatus]);

  const pause = useCallback(() => {
    clearPreparation();
    if (deviceVoiceRef.current) { token.current += 1; Speech.stop(); }
    else if (statusRef.current === 'loading' && !playerRef.current) token.current += 1;
    if (playerRef.current?.startupTimer) clearTimeout(playerRef.current.startupTimer);
    if (playerRef.current) playerRef.current.player.pause();
    setSpeechStatus('paused');
  }, [setSpeechStatus]);

  const stop = useCallback(() => {
    token.current += 1;
    clearPreparation();
    releaseGeminiPlayer(playerRef);
    Speech.stop();
    indexRef.current = 0;
    setIndex(0);
    setSpeechStatus('idle');
  }, [setSpeechStatus]);

  const goTo = useCallback((i: number) => {
    const clamped = Math.max(0, Math.min(sectionsRef.current.length - 1, i));
    token.current += 1;
    clearPreparation();
    releaseGeminiPlayer(playerRef);
    Speech.stop();
    void speakFrom(clamped);
  }, [speakFrom]);

  const restartWithNewRate = useCallback((newRate?: number) => {
    if (typeof newRate === 'number') rateRef.current = newRate;
    if (playerRef.current) {
      playerRef.current.player.playbackRate = playbackRate(rateRef.current);
      playerRef.current.player.shouldCorrectPitch = true;
    } else if (statusRef.current === 'speaking') {
      token.current += 1;
      Speech.stop();
      void speakFrom(indexRef.current, deviceVoiceRef.current);
    }
  }, [speakFrom]);

  // Si se cambia Sulafat/Achird mientras está hablando, reinicia el trozo actual.
  useEffect(() => {
    if (!['speaking', 'paused', 'loading'].includes(statusRef.current)) return;
    const wasPaused = statusRef.current === 'paused';
    token.current += 1;
    clearPreparation();
    releaseGeminiPlayer(playerRef);
    Speech.stop();
    if (!wasPaused) void speakFrom(indexRef.current);
  }, [voice, speakFrom]);

  useEffect(() => () => {
    token.current += 1;
    clearPreparation();
    releaseGeminiPlayer(playerRef);
    Speech.stop();
  }, []);

  return { status, index, play, pause, stop, goTo, restartWithNewRate };
}

/**
 * ¿Se puede leer sola (al llegar) esta respuesta del asistente? Sin cuenta (Modo demostración) solo suenan con voz natural
 * los textos de ejemplo permitidos: las demás respuestas no se leen solas, para no mostrar un aviso tras cada una
 * (su botón «Escuchar» explica por qué no suenan).
 */
export function canAutoSpeak(text: string): boolean {
  return !inDemoMode() || isVoicePreviewText(text);
}

/** Voz natural (Sulafat · Achird) para el asistente, pruebas de voz y explicaciones. Sin respaldo robótico: si falla, se avisa. */
export function useGeminiSimpleSpeech() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const token = useRef(0);
  const playerRef = useRef<GeminiPlayerRef | null>(null);
  const preparationRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearPreparation = () => {
    if (preparationRef.current) clearTimeout(preparationRef.current);
    preparationRef.current = null;
  };
  const stop = useCallback(() => {
    token.current += 1;
    clearPreparation();
    releaseGeminiPlayer(playerRef);
    Speech.stop();
    setSpeakingId(null);
    setLoadingId(null);
  }, []);

  const speak = useCallback((
    id: string,
    text: string,
    rate = 0.85,
    voice: GeminiVoice = 'Sulafat',
    purpose: 'assistant' | 'preview' = 'assistant',
    localPreviewSource?: AudioSource,
  ) => {
    const my = ++token.current;
    clearPreparation();
    releaseGeminiPlayer(playerRef);
    Speech.stop();
    setSpeakingId(null);
    setLoadingId(id);
    let fallbackStarted = false;
    let pendingCleanup: (() => void) | undefined;
    const current = () => my === token.current;
    const finish = () => {
      if (!current()) return;
      setSpeakingId(null);
      setLoadingId(null);
    };
    const fallback = () => {
      if (!current() || fallbackStarted) return;
      fallbackStarted = true;
      clearPreparation();
      releaseGeminiPlayer(playerRef);
      pendingCleanup?.();
      pendingCleanup = undefined;
      finish();
      void showAlert('Voz natural no disponible', inDemoMode() ? DEMO_VOICE_UNAVAILABLE : NATURAL_VOICE_UNAVAILABLE);
    };
    // Las respuestas largas se generan por frases en el servidor (un único audio): necesitan más tiempo.
    preparationRef.current = setTimeout(fallback, text.length > 2800 ? 120_000 : 35_000);
    void (async () => {
      try {
        await configureAudioForSpeech();
        if (!current() || fallbackStarted) return;
        let source: AudioSource = localPreviewSource ?? null;
        let cleanup = () => undefined as void;
        if (!localPreviewSource) {
          const audio = await SpeechService.synthesize(text, voice, purpose);
          if (!current() || fallbackStarted) { audio.cleanup(); return; }
          source = audio.uri;
          cleanup = audio.cleanup;
        }
        pendingCleanup = cleanup;
        clearPreparation();
        const player = createAudioPlayer(source, { downloadFirst: true, updateInterval: 200 });
        playerRef.current = { player, subscription: { remove: () => undefined }, cleanupFile: cleanup };
        pendingCleanup = undefined;
        player.playbackRate = playbackRate(rate);
        player.shouldCorrectPitch = true;
        const subscription = player.addListener('playbackStatusUpdate', (s: AudioStatus) => {
          if (!current() || fallbackStarted) return;
          if (s.error) { fallback(); return; }
          if (s.playing) {
            if (playerRef.current?.startupTimer) clearTimeout(playerRef.current.startupTimer);
            setLoadingId(null);
            setSpeakingId(id);
          }
          if (s.didJustFinish) { releaseGeminiPlayer(playerRef); finish(); }
        });
        playerRef.current.subscription = subscription;
        playerRef.current.startupTimer = setTimeout(fallback, 10_000);
        player.play();
      } catch {
        if (!current()) { pendingCleanup?.(); return; }
        fallback();
      }
    })();
  }, []);

  useEffect(() => () => stop(), [stop]);
  return { speakingId, loadingId, speak, stop };
}
