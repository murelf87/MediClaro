/**
 * Estado "Guardado" y "Favorito" de un medicamento (resultado, ficha y lectura).
 * - Corazón: si no está guardado, lo guarda como favorito; si ya lo está, cambia el favorito.
 * - Guardar: lo añade a "Mis medicamentos"; si ya estaba, pregunta antes de quitarlo.
 * Se actualiza al volver a la pantalla (otra pantalla pudo cambiarlo).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MedicationService, isAppError } from '../../services';
import { confirmAsync, showAlert } from '../../utils/dialogs';
import type { Medication } from '../../types';

export interface SavedMedicationState {
  /** Ya sabemos si está guardado (hasta entonces los controles esperan). */
  known: boolean;
  saved: boolean;
  favorite: boolean;
  busy: boolean;
  toggleFavorite: () => Promise<void>;
  toggleSaved: () => Promise<void>;
}

function errorMessage(e: unknown): string {
  return isAppError(e) ? e.message : 'Inténtalo de nuevo dentro de un momento.';
}

export function useSavedMedication(med: Medication | null): SavedMedicationState {
  const id = med?.id ?? null;
  const [known, setKnown] = useState(false);
  const [saved, setSaved] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [busy, setBusy] = useState(false);

  const medRef = useRef(med);
  medRef.current = med;
  const stateRef = useRef({ saved, favorite, busy });
  stateRef.current = { saved, favorite, busy };
  const mounted = useRef(true);
  /** Cada cambio del usuario invalida las lecturas que estuvieran en curso. */
  const version = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    const v = version.current;
    try {
      const s = await MedicationService.isSaved(id);
      if (!mounted.current || v !== version.current) return;
      setSaved(s.saved);
      setFavorite(s.favorite);
    } catch {
      // Sin conexión: se asume "no guardado". Guardar es idempotente, así que no hay riesgo.
    } finally {
      if (mounted.current) setKnown(true);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const toggleFavorite = useCallback(async () => {
    const m = medRef.current;
    const prev = stateRef.current;
    if (!m || prev.busy) return;
    const nextFavorite = !(prev.saved && prev.favorite);
    version.current += 1;
    setBusy(true);
    setSaved(true);
    setFavorite(nextFavorite);
    try {
      if (!prev.saved) await MedicationService.saveMedication(m, { favorite: true });
      else await MedicationService.setFavorite(m.id, nextFavorite);
      AccessibilityInfo.announceForAccessibility(nextFavorite ? 'Añadido a favoritos' : 'Quitado de favoritos');
    } catch (e) {
      if (mounted.current) {
        setSaved(prev.saved);
        setFavorite(prev.favorite);
      }
      await showAlert('No se ha podido cambiar el favorito', errorMessage(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  const toggleSaved = useCallback(async () => {
    const m = medRef.current;
    const prev = stateRef.current;
    if (!m || prev.busy) return;
    if (prev.saved) {
      const ok = await confirmAsync({
        title: '¿Quitar de Mis medicamentos?',
        message: `${m.name} dejará de aparecer en tu lista. Podrás volver a guardarlo cuando quieras.`,
        confirmText: 'Quitar',
        cancelText: 'Cancelar',
        destructive: true,
      });
      if (!ok || !mounted.current) return;
    }
    version.current += 1;
    setBusy(true);
    setSaved(!prev.saved);
    if (prev.saved) setFavorite(false);
    try {
      if (prev.saved) await MedicationService.removeMedication(m.id);
      else await MedicationService.saveMedication(m);
      AccessibilityInfo.announceForAccessibility(prev.saved ? 'Quitado de Mis medicamentos' : 'Guardado en Mis medicamentos');
    } catch (e) {
      if (mounted.current) {
        setSaved(prev.saved);
        setFavorite(prev.favorite);
      }
      await showAlert(prev.saved ? 'No se ha podido quitar' : 'No se ha podido guardar', errorMessage(e));
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  return { known, saved, favorite, busy, toggleFavorite, toggleSaved };
}
