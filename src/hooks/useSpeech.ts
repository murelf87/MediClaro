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

export type SpeechStatus = 'idle' | 'speaking' | 'paused' | 'finished' | 'error';

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
