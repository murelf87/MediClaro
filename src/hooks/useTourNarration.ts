/**
 * Voz de la explicación paso a paso.
 *  - Con audio pregrabado (src/config/tourAudio.ts) → se reproduce ese archivo.
 *  - Si no hay archivo para el paso → se lee el mismo texto con la voz del sistema (es-ES).
 *  - Al cambiar de paso, silenciar o salir de la pantalla, la voz se detiene al momento.
 * En web (solo QA) se usa un <audio> simple y se respetan las reglas de reproducción automática del
 * navegador (si no deja reproducir, no pasa nada: el texto está en pantalla).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Asset } from 'expo-asset';
import * as Speech from 'expo-speech';
import { TOUR_AUDIO, type TourStepId } from '../config/tourAudio';

const WEB = Platform.OS === 'web';

function webUri(source: unknown): string | null {
  try {
    if (typeof source === 'number' || typeof source === 'string') return Asset.fromModule(source).uri;
    if (source && typeof source === 'object' && 'uri' in source) return String((source as { uri: string }).uri);
  } catch {
    // Sin URI: se usará la voz del sistema.
  }
  return null;
}

export function useTourNarration(step: { id: TourStepId; narration: string } | null, enabled: boolean, rate: number) {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  const [speaking, setSpeaking] = useState(false);
  const [webPlaying, setWebPlaying] = useState(false);
  const webAudio = useRef<HTMLAudioElement | null>(null);
  const token = useRef(0);
  const source = step ? TOUR_AUDIO[step.id] ?? null : null;

  const stopAll = useCallback(() => {
    token.current += 1;
    if (WEB) {
      webAudio.current?.pause();
      setWebPlaying(false);
    } else {
      try {
        player.pause();
      } catch {
        // El reproductor puede no estar listo todavía.
      }
    }
    Speech.stop();
    setSpeaking(false);
  }, [player]);

  const speak = useCallback(
    (text: string, my: number) => {
      setSpeaking(true);
      const finished = () => {
        if (my === token.current) setSpeaking(false);
      };
      Speech.speak(text, { language: 'es-ES', rate, onDone: finished, onStopped: finished, onError: finished });
    },
    [rate],
  );

  const start = useCallback(() => {
    if (!step) return;
    stopAll();
    const my = token.current;
    if (source && WEB) {
      const uri = webUri(source);
      if (uri && typeof Audio !== 'undefined') {
        const audio = webAudio.current ?? new Audio();
        webAudio.current = audio;
        audio.src = uri;
        audio.onended = () => my === token.current && setWebPlaying(false);
        setWebPlaying(true);
        audio.play().catch(() => {
          if (my === token.current) setWebPlaying(false);
        });
        return;
      }
    } else if (source) {
      try {
        player.replace(source);
        void player.seekTo(0).catch(() => undefined);
        player.play();
        return;
      } catch {
        // Si falla el audio, se lee con la voz del sistema.
      }
    }
    speak(step.narration, my);
  }, [step, source, player, stopAll, speak]);

  // Cada paso se narra al aparecer (tras la animación de entrada).
  useEffect(() => {
    if (!enabled || !step) {
      stopAll();
      return undefined;
    }
    const timer = setTimeout(start, 450);
    return () => {
      clearTimeout(timer);
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id, enabled]);

  // Al salir de la pantalla se libera el <audio> de la web.
  useEffect(
    () => () => {
      webAudio.current?.pause();
      webAudio.current = null;
    },
    [],
  );

  const playing = source ? (WEB ? webPlaying : status.playing) : speaking;
  return { playing, replay: start, stop: stopAll, prerecorded: !!source };
}
