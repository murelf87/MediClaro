/**
 * «Mis pastillas» en las pantallas: estado de la pauta y de las tomas (al instante desde el teléfono y luego desde el
 * servidor), y la hora actual que avanza sola para que los colores (pendiente, sin confirmar…) estén al día.
 */
import { useCallback, useEffect, useState } from 'react';
import { MedicationPlanService, type PlanSnapshot, type PlanState } from '../services';
import { toAppError, type AppError } from '../api/errors';

export function usePillPlan() {
  const [state, setState] = useState<PlanState | null>(MedicationPlanService.getState());
  const [loading, setLoading] = useState(!state);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    let alive = true;
    const unsubscribe = MedicationPlanService.subscribe((s) => {
      if (alive) setState(s);
    });
    void (async () => {
      try {
        const local = await MedicationPlanService.load();
        if (alive) setState(local);
        await MedicationPlanService.refresh();
      } catch (e) {
        if (alive) setError(toAppError(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      await MedicationPlanService.refresh();
    } catch (e) {
      setError(toAppError(e));
    }
  }, []);

  return { state, loading, error, refresh };
}

/** Pauta de un familiar (cuidador/a autorizado). Siempre del servidor: nada se guarda en este teléfono. */
export function usePatientPlan(patientId: string | null) {
  const [plan, setPlan] = useState<PlanSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const reload = useCallback(async () => {
    if (!patientId) return;
    setError(null);
    try {
      setPlan(await MedicationPlanService.loadPatient(patientId));
    } catch (e) {
      setError(toAppError(e));
    } finally {
      setLoading(false);
    }
  }, [patientId]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { plan, loading, error, reload };
}

/** Hora actual que se actualiza cada `everyMs` (por defecto, 30 s). */
export function useNow(everyMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

/** Solo lo guardado en el teléfono, sin pedir nada al servidor (para el resumen de Inicio). */
export function usePillState(): PlanState | null {
  const [state, setState] = useState<PlanState | null>(MedicationPlanService.getState());
  useEffect(() => {
    let alive = true;
    const unsubscribe = MedicationPlanService.subscribe((s) => {
      if (alive) setState(s);
    });
    void MedicationPlanService.load()
      .then((s) => {
        if (alive) setState(s);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);
  return state;
}
