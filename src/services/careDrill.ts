/**
 * Simulacro de emergencia («Probar la emergencia completa»).
 *
 * Reproduce un aviso completo —el aviso, que el cuidador/a lo abre y lo atiende, y el chat— con la OTRA persona
 * simulada, para ver cómo funciona sin esperar a una emergencia. Todo ocurre en este teléfono: no se llama al
 * servidor, no se avisa a nadie, no se envía ninguna notificación ni se comparte la ubicación.
 * Usa la misma forma de datos que los avisos reales (CareIncident) para que la pantalla lo muestre igual.
 */
import type { CareIncident, CareMessage } from './CaregiverService';

export type DrillRole = 'patient' | 'caregiver';

export interface DrillTiming {
  /** Paciente: el cuidador/a simulado abre el aviso. */
  received: number;
  /** Paciente: el cuidador/a simulado confirma que lo atiende y escribe. */
  acknowledged: number;
  /** La otra persona contesta a cada mensaje. */
  reply: number;
}

export interface CareDrill {
  /** El aviso del simulacro tal como lo vería un aviso real. */
  incident(): CareIncident;
  subscribe(listener: () => void): () => void;
  /** El cuidador/a ve el aviso (lo marca como abierto). */
  received(): void;
  /** «Estoy atendiendo este aviso». */
  acknowledge(): void;
  message(text: string, checkIn?: boolean): void;
  /** Termina el simulacro y cancela lo pendiente. */
  stop(): void;
}

export const DRILL_PREFIX = 'drill-';
export const isDrillIncident = (incidentId: string | null | undefined): boolean => !!incidentId && incidentId.startsWith(DRILL_PREFIX);

const DEFAULT_TIMING: DrillTiming = { received: 2500, acknowledged: 5500, reply: 3500 };

export function startCareDrill(opts: {
  role: DrillRole;
  /** Identificador de la cuenta (para que «Tú» salga en tus mensajes). */
  me: string;
  /** Tu nombre (cuidador/a) tal como lo vería el paciente. */
  myName?: string | null;
  /** Nombre de la otra persona (simulada). */
  otherName: string;
  timing?: Partial<DrillTiming>;
  now?: () => number;
}): CareDrill {
  const timing = { ...DEFAULT_TIMING, ...opts.timing };
  const clock = opts.now ?? Date.now;
  const iso = (ms = 0) => new Date(clock() + ms).toISOString();
  const otherId = `${DRILL_PREFIX}${opts.role === 'patient' ? 'caregiver' : 'patient'}`;
  const patientId = opts.role === 'patient' ? opts.me : otherId;
  let seq = 0;
  const id = (kind: string) => `${DRILL_PREFIX}${kind}-${clock().toString(36)}-${(seq += 1)}`;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();
  let stopped = false;

  const incident: CareIncident = {
    id: id('incident'),
    patient_id: patientId,
    summary:
      opts.role === 'patient'
        ? 'Simulacro: has avisado de que te encuentras mal («Me he mareado al levantarme y estoy sentado/a en el salón»).'
        : `Simulacro: ${opts.otherName} comunica «Me he mareado al levantarme y estoy sentada en el salón».`,
    state: 'active',
    created_at: iso(),
    expires_at: iso(2 * 60 * 60_000),
    // En un simulacro nunca se comparte una ubicación (ni real ni inventada).
    latitude: null,
    longitude: null,
    accuracy: null,
    location_at: null,
    shareLocation: false,
    notificationState: 'drill',
    messages: [],
    members: [{ receivedAt: null, acknowledgedAt: null, caregiverName: opts.role === 'patient' ? opts.otherName : opts.myName || 'Tú' }],
  };

  const emit = () => listeners.forEach((l) => l());
  const later = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!stopped) {
        fn();
        emit();
      }
    }, ms);
    timers.add(t);
  };
  const push = (sender: string, content: string, dueMs: number | null = null): CareMessage => {
    const m: CareMessage = {
      id: id('msg'),
      sender_id: sender,
      content,
      created_at: iso(),
      response_due_at: dueMs ? iso(dueMs) : null,
      responded_at: null,
      escalated_at: null,
    };
    incident.messages = [...incident.messages, m];
    return m;
  };
  const member = () => incident.members[0];

  if (opts.role === 'patient') {
    // Tu cuidador/a simulado abre el aviso, confirma que lo atiende y te escribe.
    later(timing.received, () => {
      member().receivedAt ??= iso();
    });
    later(timing.acknowledged, () => {
      member().receivedAt ??= iso();
      member().acknowledgedAt ??= iso();
      push(otherId, `Soy ${opts.otherName}. He visto tu aviso y estoy pendiente de ti. ¿Cómo te encuentras?`);
    });
  } else {
    push(otherId, 'Me he mareado al levantarme. Estoy sentada en el salón.');
  }

  return {
    incident: () => incident,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    received() {
      if (stopped || opts.role !== 'caregiver' || member().receivedAt) return;
      member().receivedAt = iso();
      emit();
    },
    acknowledge() {
      if (stopped || opts.role !== 'caregiver' || member().acknowledgedAt) return;
      member().receivedAt ??= iso();
      member().acknowledgedAt = iso();
      emit();
      later(timing.reply, () => {
        push(otherId, 'Gracias por atenderme. Sigo sentada y un poco mejor.');
      });
    },
    message(text, checkIn = false) {
      const content = text.trim().slice(0, 2000);
      if (stopped || incident.state !== 'active' || !content) return;
      const sent = push(opts.me, content, checkIn && opts.role === 'caregiver' ? 60_000 : null);
      emit();
      later(timing.reply, () => {
        if (opts.role === 'caregiver') {
          sent.responded_at = iso();
          incident.messages = [...incident.messages];
          push(otherId, 'Ya estoy mejor, gracias. Sigo sentada.');
        } else {
          push(otherId, 'Recibido. Quédate tranquilo/a, voy para allá.');
        }
      });
    },
    stop() {
      if (stopped) return;
      stopped = true;
      timers.forEach(clearTimeout);
      timers.clear();
      incident.state = 'closed';
      emit();
      listeners.clear();
    },
  };
}
