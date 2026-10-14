/**
 * Estado de una emergencia en curso, compartido entre las pantallas del flujo
 * (confirmación → asistente → información preparada → llamada → resultado).
 * Vive en memoria; se reinicia al terminar o cancelar.
 */
import { canTransition } from './emergency/stateMachine';
import type { ActivationMode, EmergencyState, EmergencyStatement, QuickSymptomId } from './emergency/types';
import { QUICK_SYMPTOMS } from './emergency/types';
import { EmergencyService, type PreparedEmergency } from './EmergencyService';

export type CallTarget = 'private' | 'official' | 'caregiver';

export interface EmergencySessionState {
  state: EmergencyState;
  mode: ActivationMode | null;
  startedAt: string | null;
  symptoms: QuickSymptomId[];
  statements: EmergencyStatement[];
  noResponseDetected: boolean;
  noResponseAt: string | null;
  prepared: PreparedEmergency | null;
  preparing: boolean;
  callTarget: CallTarget | null;
  callStartedAt: string | null;
  lastCallOutcome: 'answered' | 'no_answer' | null;
  caregiverNotifiedAt: string | null;
}

const INITIAL: EmergencySessionState = {
  state: 'IDLE',
  mode: null,
  startedAt: null,
  symptoms: [],
  statements: [],
  noResponseDetected: false,
  noResponseAt: null,
  prepared: null,
  preparing: false,
  callTarget: null,
  callStartedAt: null,
  lastCallOutcome: null,
  caregiverNotifiedAt: null,
};

let current: EmergencySessionState = { ...INITIAL };
const listeners = new Set<() => void>();
let preparePromise: Promise<PreparedEmergency> | null = null;
/** Generación de la sesión: descarta resultados de una emergencia anterior. */
let generation = 0;

function set(patch: Partial<EmergencySessionState>): void {
  current = { ...current, ...patch };
  listeners.forEach((l) => l());
}

/** Aplica una transición validada por la máquina de estados. */
function go(to: EmergencyState): void {
  if (current.state === to) return;
  if (canTransition(current.state, to)) set({ state: to });
}

export const EmergencySession = {
  getSnapshot(): EmergencySessionState {
    return current;
  },

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  start(mode: ActivationMode): void {
    generation += 1;
    preparePromise = null;
    current = { ...INITIAL, startedAt: new Date().toISOString(), mode };
    go('ACTIVATED');
    listeners.forEach((l) => l());
  },

  ensureStarted(): void {
    if (current.state === 'IDLE') EmergencySession.start(current.mode ?? 'unsure');
  },

  listen(): void {
    EmergencySession.ensureStarted();
    go('LISTENING');
  },

  toggleSymptom(id: QuickSymptomId): void {
    const selected = current.symptoms.includes(id);
    const symptom = QUICK_SYMPTOMS.find((s) => s.id === id);
    const statements = !selected && symptom
      ? [
          ...current.statements,
          {
            timestamp: new Date().toISOString(),
            speaker: 'user' as const,
            transcript: symptom.label.replace(/\n/g, ' '),
            confidence: 1,
            provenance: 'USER_SELECTED' as const,
            isQuickButton: true,
          },
        ]
      : current.statements;
    set({
      symptoms: selected ? current.symptoms.filter((s) => s !== id) : [...current.symptoms, id],
      statements,
      prepared: null,
    });
  },

  /** 60 s sin interacción en el asistente. NO llama a nadie: solo lo registra. */
  markNoResponse(): void {
    set({ noResponseDetected: true, noResponseAt: new Date().toISOString(), prepared: null });
    go('NO_RESPONSE');
  },

  /** La persona vuelve a interactuar. */
  markResponsive(): void {
    if (current.state === 'NO_RESPONSE') go('LISTENING');
    set({ noResponseDetected: false, noResponseAt: null, prepared: null });
  },

  /** Prepara (o reutiliza) la información para la emergencia. */
  async prepare(force = false): Promise<PreparedEmergency> {
    if (!force && current.prepared) return current.prepared;
    if (preparePromise) return preparePromise;
    EmergencySession.ensureStarted();
    if (current.state === 'ACTIVATED' || current.state === 'LISTENING' || current.state === 'NO_RESPONSE') {
      go('COLLECTING_CONTEXT');
    }
    set({ preparing: true });
    const myGeneration = generation;
    const promise = EmergencyService.prepareEmergencyContext({
      symptoms: current.symptoms,
      statements: current.statements,
      noResponseDetected: current.noResponseDetected,
      noResponseAt: current.noResponseAt,
    });
    preparePromise = promise;
    try {
      const prepared = await promise;
      // Si mientras tanto empezó o terminó otra emergencia, no se mezcla.
      if (myGeneration === generation) {
        set({ prepared, preparing: false });
        if (current.state === 'COLLECTING_CONTEXT') go('REPORT_READY');
      }
      return prepared;
    } catch (e) {
      if (myGeneration === generation) set({ preparing: false });
      throw e;
    } finally {
      if (preparePromise === promise) preparePromise = null;
    }
  },

  /**
   * Registra que se ha abierto una llamada (el sistema la muestra en su pantalla).
   * DIALING = "llamada en curso" (servicio privado o 112). El resultado lo indica
   * después la persona ("me han atendido" / "no contestan").
   */
  callStarted(target: CallTarget): void {
    set({ callTarget: target, callStartedAt: new Date().toISOString(), lastCallOutcome: null });
    if (target === 'private' || target === 'official') go('DIALING');
  },

  /** Resultado que indica la persona al volver de la llamada. */
  callAnswered(): void {
    set({ lastCallOutcome: 'answered' });
    go('CALL_TRANSFERRED');
  },

  /** El servicio privado no contestó. NUNCA deriva al 112 automáticamente. */
  callNotAnswered(): void {
    set({ lastCallOutcome: 'no_answer' });
    go('ASSISTANCE_FAILED');
  },

  caregiverNotified(): void {
    set({ caregiverNotifiedAt: new Date().toISOString() });
  },

  /** Termina la emergencia y borra el contexto temporal. */
  async finish(): Promise<void> {
    EmergencyService.stopSpeaking();
    generation += 1;
    preparePromise = null;
    current = { ...INITIAL };
    listeners.forEach((l) => l());
    await EmergencyService.finishSession();
  },
};
