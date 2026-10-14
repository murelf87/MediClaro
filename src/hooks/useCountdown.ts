/**
 * Cuenta atrás en segundos (reenviar código, preparar llamada...).
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export function useCountdown(initialSeconds: number, opts?: { autoStart?: boolean; onDone?: () => void }) {
  const [remaining, setRemaining] = useState(opts?.autoStart === false ? 0 : initialSeconds);
  const [running, setRunning] = useState(opts?.autoStart !== false);
  const endAt = useRef<number>(Date.now() + initialSeconds * 1000);
  const onDoneRef = useRef(opts?.onDone);
  onDoneRef.current = opts?.onDone;

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((endAt.current - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        onDoneRef.current?.();
      }
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback((seconds: number = initialSeconds) => {
    endAt.current = Date.now() + seconds * 1000;
    setRemaining(seconds);
    setRunning(true);
  }, [initialSeconds]);

  const stop = useCallback(() => setRunning(false), []);

  return { remaining, running, start, stop };
}

/** Segundos transcurridos desde una fecha ISO (para "Llamada en curso 00:12"). */
export function useElapsedSeconds(sinceIso: string | null): number {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!sinceIso) {
      setElapsed(0);
      return;
    }
    const since = new Date(sinceIso).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - since) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [sinceIso]);
  return elapsed;
}
