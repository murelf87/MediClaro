/**
 * Carga asíncrona con estados de pantalla: loading · success · empty · error.
 * Ignora respuestas obsoletas y permite recargar o refrescar (pull-to-refresh).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { toAppError, type AppError } from '../api/errors';

export type AsyncStatus = 'loading' | 'success' | 'empty' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: AppError | null;
  refreshing: boolean;
  /** Recarga mostrando el estado de carga completo. */
  reload: () => Promise<void>;
  /** Recarga en segundo plano manteniendo los datos (pull-to-refresh / al volver). */
  refresh: () => Promise<void>;
  setData: (updater: T | ((prev: T | null) => T)) => void;
}

export function useAsync<T>(
  loader: () => Promise<T>,
  deps: readonly unknown[],
  opts?: { isEmpty?: (data: T) => boolean; enabled?: boolean },
): AsyncState<T> {
  const enabled = opts?.enabled ?? true;
  const isEmptyRef = useRef(opts?.isEmpty);
  isEmptyRef.current = opts?.isEmpty;
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [data, setDataState] = useState<T | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const requestId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async (mode: 'reload' | 'refresh') => {
    const id = ++requestId.current;
    if (mode === 'reload') {
      setStatus('loading');
      setError(null);
    } else {
      setRefreshing(true);
    }
    try {
      const result = await loaderRef.current();
      if (!mounted.current || id !== requestId.current) return;
      setDataState(result);
      setError(null);
      const empty = isEmptyRef.current ? isEmptyRef.current(result) : false;
      setStatus(empty ? 'empty' : 'success');
    } catch (e) {
      if (!mounted.current || id !== requestId.current) return;
      const err = toAppError(e);
      setError(err);
      // En refresco con datos previos, mantenemos los datos visibles
      setStatus((prev) => (mode === 'refresh' && (prev === 'success' || prev === 'empty') ? prev : 'error'));
    } finally {
      if (mounted.current && id === requestId.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void run('reload');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const reload = useCallback(() => run('reload'), [run]);
  const refresh = useCallback(() => run('refresh'), [run]);
  const setData = useCallback((updater: T | ((prev: T | null) => T)) => {
    setDataState((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: T | null) => T)(prev) : updater;
      const empty = isEmptyRef.current ? isEmptyRef.current(next) : false;
      setStatus(empty ? 'empty' : 'success');
      return next;
    });
  }, []);

  return { status, data, error, refreshing, reload, refresh, setData };
}
