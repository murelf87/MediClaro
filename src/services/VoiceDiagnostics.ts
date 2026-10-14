/**
 * Diagnóstico de la voz natural: qué paso se alcanzó y cuánto tardó, para saber DÓNDE falla en un móvil concreto
 * (preparar el audio → pedir la voz al servidor → recibirla → crear el reproductor → empezar a sonar).
 *
 * - El último fallo se guarda en el móvil y se ve en el panel → «Revisar la app».
 * - En las compilaciones de prueba (perfil preview y Expo Go), si la voz natural no suena se envía sola a «Errores
 *   notificados» del panel, con los pasos y los tiempos (como mucho una vez cada 10 minutos). En la versión de las
 *   tiendas NUNCA se envía nada sin que la persona lo pida.
 * - Solo datos técnicos: nunca el texto que se iba a leer (puede hablar de medicamentos).
 */
import { DEMO_ACCESS_ENABLED } from '../config/app';
import { localStore } from '../api/storage';

export type VoiceStep = 'inicio' | 'audio' | 'servidor' | 'respuesta' | 'reproductor' | 'sonando';

export interface VoiceTrace {
  step(name: VoiceStep, detail?: string): void;
  /** Último paso alcanzado («servidor», «reproductor»…). */
  last(): VoiceStep;
  /** «inicio 0,0 s → audio 0,1 s → servidor 0,1 s …». */
  summary(): string;
  fail(reason: string): void;
}

export interface VoiceFailure {
  text: string;
  /** Fecha ISO. */
  at: string;
}

/** Envío automático solo en compilaciones de prueba (nunca en la de las tiendas). */
const AUTO_REPORT = DEMO_ACCESS_ENABLED;
const REPORT_EVERY_MS = 10 * 60_000;
const LAST_KEY = 'mediclaro_voice_last_failure_v1';

let lastSentAt = 0;
let lastFailure: VoiceFailure | null = null;

function secs(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace('.', ',')} s`;
}

export function errorText(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return (m || 'error desconocido').replace(/\s+/g, ' ').trim().slice(0, 200);
}

export function startVoiceTrace(kind: string, voice: string, now: () => number = Date.now): VoiceTrace {
  const t0 = now();
  const steps: string[] = [];
  let lastStep: VoiceStep = 'inicio';
  let failed = false;
  const step = (name: VoiceStep, detail?: string) => {
    lastStep = name;
    steps.push(`${name}${detail ? ` (${detail})` : ''} ${secs(now() - t0)}`);
  };
  step('inicio');
  return {
    step,
    last: () => lastStep,
    summary: () => steps.join(' → '),
    fail(reason: string) {
      if (failed) return;
      failed = true;
      const text = `La voz natural (${voice}, ${kind}) no ha sonado: ${reason}. Pasos: ${steps.join(' → ')}`;
      lastFailure = { text, at: new Date(now()).toISOString() };
      void localStore.setJSON(LAST_KEY, lastFailure);
      if (!AUTO_REPORT || (lastSentAt && now() - lastSentAt < REPORT_EVERY_MS)) return;
      lastSentAt = now();
      try {
        // Carga perezosa: la voz no arrastra el servicio de mensajes (ni sus dependencias) hasta que hace falta.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { ProblemReportService } = require('./ProblemReportService') as typeof import('./ProblemReportService');
        void ProblemReportService.send(`[Automático] ${text}`.slice(0, 1900), '', { area: 'Voz (automático)' }).catch(() => undefined);
      } catch {
        // El diagnóstico nunca debe romper la voz.
      }
    },
  };
}

/** El último fallo de la voz natural en este móvil (para «Revisar la app»), o null si no ha fallado. */
export async function lastVoiceFailure(): Promise<VoiceFailure | null> {
  if (lastFailure) return lastFailure;
  const stored = await localStore.getJSON<VoiceFailure | null>(LAST_KEY, null);
  return stored && typeof stored.text === 'string' && typeof stored.at === 'string' ? stored : null;
}

/** Olvida el último fallo (desde «Revisar la app», cuando ya está resuelto). */
export async function clearVoiceFailure(): Promise<void> {
  lastFailure = null;
  await localStore.remove(LAST_KEY);
}

/** Solo para pruebas. */
export function __resetVoiceDiagnostics(): void {
  lastSentAt = 0;
  lastFailure = null;
}
