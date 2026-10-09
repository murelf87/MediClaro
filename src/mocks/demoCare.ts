/**
 * Cuidador/a en el MODO DEMOSTRACIÓN y en la vista previa web (datos de ejemplo, todo en memoria).
 *
 * Misma forma de datos que las funciones reales `caregiver_action` y `care_pairing_action`, para poder probar con
 * un solo teléfono el flujo completo: código de 6 números, solicitud pendiente, aceptar/rechazar, «Cuidador/a de…»,
 * desvincular, avisos (incidentes) con chat y ubicación, el chat del día a día entre la persona y su cuidador/a
 * (`care_chat_action`, con «Visto») y las llamadas de voz (`care_call_action`: sin audio, «de prueba»). La «otra
 * persona» está simulada y responde sola (contesta las llamadas y, si le pides que te llame, te llama), con textos
 * marcados como prueba. Nunca se incluye en las compilaciones de tienda (lo importa solo demoBackend.ts).
 */
import { DEMO_USER_ID } from './demoData';

type Result = { data: unknown; error: unknown };
type Role = 'patient' | 'caregiver';

interface DemoLink {
  id: string;
  patientId: string;
  caregiverId: string | null;
  patientName: string;
  caregiverName: string | null;
  accepted: boolean;
}

interface DemoMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  response_due_at: string | null;
  responded_at: string | null;
  escalated_at: string | null;
}

interface DemoIncident {
  id: string;
  patient_id: string;
  summary: string;
  state: 'active' | 'closed';
  created_at: string;
  expires_at: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  location_at: string | null;
  shareLocation: boolean;
  notificationState: string;
  messages: DemoMessage[];
  members: { receivedAt: string | null; acknowledgedAt: string | null; caregiverName: string }[];
}

interface DemoChatMessage {
  id: string;
  linkId: string;
  senderId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
  clientKey?: string;
  kind?: 'text' | 'call';
  callOutcome?: 'answered' | 'missed' | 'declined' | 'failed' | null;
  callSeconds?: number | null;
}

interface DemoCall {
  id: string;
  linkId: string;
  callerId: string;
  recipientId: string;
  state: 'ringing' | 'answered' | 'ended';
  outcome: 'answered' | 'missed' | 'declined' | 'failed' | null;
  offer: string | null;
  answer: string | null;
  createdAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  expiresAt: string;
}

export interface DemoCareOptions {
  isPremium: () => boolean;
  myName: () => string;
  /** Sin datos de ejemplo (escenario 'empty'). */
  empty?: boolean;
  /** Escenario «cuidador/a»: la cuenta ya es cuidador/a (gratis) de esta paciente, con la vinculación aceptada. */
  caregiverOf?: string;
  /** Retardos de la persona simulada (en pruebas se acortan). */
  timing?: {
    accept: number; received: number; acknowledged: number; reply: number; incoming: number;
    chatRead?: number; chatReply?: number; callAnswer?: number; callBack?: number; ring?: number;
    /** Escenario «cuidador/a»: cuánto tarda la paciente simulada en escribir al entrar (enciende el chat). */
    patientWrites?: number;
  };
}

/** Persona simulada al otro lado (sus identificadores nunca coinciden con el de la cuenta de demostración). */
const DEMO_CAREGIVER_ID = '00000000-0000-4000-8000-00000000c0d1';
/** Paciente simulada del escenario «cuidador/a» (la exporta también «Mis pastillas» de la demostración). */
export const DEMO_PATIENT_ID = '00000000-0000-4000-8000-00000000c0d2';
const DEMO_CAREGIVER_NAME = 'Javier Martín';
const DEMO_PATIENT_NAME = 'Carmen López';
/** Segunda persona que pide ser cuidadora de la paciente Premium (para probar «Aceptar / Rechazar»). */
const DEMO_SECOND_CAREGIVER_ID = '00000000-0000-4000-8000-00000000c0d3';
const DEMO_SECOND_CAREGIVER_NAME = 'Ana Ruiz';
/** Ubicación de ejemplo (Sevilla). */
const DEMO_LOCATION = { latitude: 37.3891, longitude: -5.9845, accuracy: 18 };

const fail = (code: string): Result => ({ data: null, error: { message: code } });
const ok = (data: unknown): Result => ({ data: JSON.parse(JSON.stringify(data ?? null)), error: null });

export function createDemoCare(opts: DemoCareOptions) {
  const uid = DEMO_USER_ID;
  const timing = opts.timing ?? { accept: 5000, received: 3000, acknowledged: 7000, reply: 5000, incoming: 12000 };
  let role: Role = 'patient';
  let myCode = '482913';
  let seq = 0;
  const id = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`;
  const now = () => new Date().toISOString();
  const later = (ms: number) => new Date(Date.now() + ms).toISOString();
  const links: DemoLink[] = [];
  const incidents: DemoIncident[] = [];

  const chats: DemoChatMessage[] = [];
  /** Hace `minutes` minutos, o ayer a una hora concreta. */
  const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
  const yesterdayAt = (h: number, m: number) => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const seedChat = (linkId: string, lines: Array<[string, string, string, boolean]>) => {
    for (const [senderId, content, createdAt, read] of lines) {
      chats.push({ id: id('chat'), linkId, senderId, content, createdAt, readAt: read ? createdAt : null });
    }
  };

  // Semilla «cuidador/a»: la cuenta cuida de una paciente Premium (vinculación ya aceptada) y se escriben a diario.
  if (opts.caregiverOf) {
    role = 'caregiver';
    links.push({ id: 'demo-link-cuidador', patientId: DEMO_PATIENT_ID, caregiverId: uid, patientName: opts.caregiverOf, caregiverName: opts.myName(), accepted: true });
    seedChat('demo-link-cuidador', [
      [DEMO_PATIENT_ID, '¿Vendrás el domingo a comer?', yesterdayAt(18, 40), true],
      [uid, 'Sí, mamá. Llevo yo el postre.', yesterdayAt(18, 52), true],
      [DEMO_PATIENT_ID, '¡Qué bien! Te espero.', yesterdayAt(18, 53), true],
      [DEMO_PATIENT_ID, 'Buenos días. Ya me he tomado las pastillas del desayuno 😊', ago(95), true],
    ]);
    // Hace más de una hora que no escribe: el chat está apagado para el cuidador/a. Al poco de entrar, la paciente
    // simulada escribe y el chat se enciende (así se ven los dos estados en la demostración).
    setTimeout(() => {
      const link = links.find((l) => l.id === 'demo-link-cuidador');
      if (!link) return;
      chats.push({ id: id('chat'), linkId: link.id, senderId: DEMO_PATIENT_ID, content: 'Hola, hijo. ¿Estás ahí? Quería contarte una cosa. (Mensaje de prueba)', createdAt: now(), readAt: null });
    }, timing.patientWrites ?? 25_000);
  }
  // Semilla: la paciente Premium tiene a su hijo como cuidador (con su conversación) y una vecina le pide vincularse.
  if (opts.isPremium() && !opts.empty && !opts.caregiverOf) {
    links.push({ id: 'demo-link-javier', patientId: uid, caregiverId: DEMO_CAREGIVER_ID, patientName: opts.myName(), caregiverName: DEMO_CAREGIVER_NAME, accepted: true });
    links.push({ id: 'demo-link-ana', patientId: uid, caregiverId: DEMO_SECOND_CAREGIVER_ID, patientName: opts.myName(), caregiverName: DEMO_SECOND_CAREGIVER_NAME, accepted: false });
    seedChat('demo-link-javier', [
      [DEMO_CAREGIVER_ID, 'Hola, mamá. ¿Qué tal ha ido el día?', yesterdayAt(19, 5), true],
      [uid, 'Muy bien, hijo. He salido a pasear con Pilar.', yesterdayAt(19, 12), true],
      [DEMO_CAREGIVER_ID, '¡Qué bien! Mañana te llamo a la hora de comer.', yesterdayAt(19, 14), true],
      [DEMO_CAREGIVER_ID, 'Buenos días, mamá. ¿Te has tomado las pastillas del desayuno?', ago(50), false],
    ]);
  }

  const visibleLinks = () => links.filter((l) => l.patientId === uid || l.caregiverId === uid);
  const visibleIncidents = () =>
    incidents.filter((i) => i.patient_id === uid || links.some((l) => l.accepted && l.caregiverId === uid && l.patientId === i.patient_id));
  const findIncident = (incidentId: unknown) => incidents.find((i) => i.id === incidentId && visibleIncidents().includes(i));
  const message = (incident: DemoIncident, sender: string, content: string, dueMs: number | null = null): DemoMessage => {
    const m: DemoMessage = { id: id('msg'), sender_id: sender, content, created_at: now(), response_due_at: dueMs ? later(dueMs) : null, responded_at: null, escalated_at: null };
    incident.messages.push(m);
    return m;
  };

  /** La paciente simulada (Carmen) envía un aviso de prueba a su cuidador/a: la cuenta de demostración. */
  const simulateIncomingIncident = (link: DemoLink) => {
    setTimeout(() => {
      if (!links.includes(link) || !link.accepted) return;
      const incident: DemoIncident = {
        id: id('incident'),
        patient_id: DEMO_PATIENT_ID,
        summary: `${DEMO_PATIENT_NAME} comunica: «Me he mareado al levantarme y estoy sentada en el salón». (Aviso de prueba)`,
        state: 'active',
        created_at: now(),
        expires_at: later(2 * 60 * 60_000),
        ...DEMO_LOCATION,
        location_at: now(),
        shareLocation: true,
        notificationState: 'provider_delivered',
        messages: [],
        members: [{ receivedAt: null, acknowledgedAt: null, caregiverName: link.caregiverName ?? 'Cuidador/a' }],
      };
      message(incident, DEMO_PATIENT_ID, 'Me he mareado al levantarme. Estoy sentada en el salón.');
      incidents.push(incident);
    }, timing.incoming);
  };

  function caregiverAction(action: string, p: Record<string, unknown>): Result {
    switch (action) {
      case 'snapshot':
        return ok({ role, links: visibleLinks(), incidents: visibleIncidents() });
      case 'role':
        role = p.role === 'caregiver' ? 'caregiver' : 'patient';
        return ok({ role });
      case 'invite':
        return ok({ code: myCode, expiresAt: later(24 * 60 * 60_000) });
      case 'accept':
        return pairingAction('request', { code: p.code, name: p.name });
      case 'revoke':
        return pairingAction('disconnect', { linkId: p.linkId });
      case 'start': {
        const link = links.find((l) => l.accepted && l.patientId === uid && l.caregiverId);
        if (!link) return fail('NO_LINKED_CAREGIVER');
        const existing = incidents.find((i) => i.patient_id === uid && i.state === 'active');
        if (existing) return ok({ incidentId: existing.id, queued: false });
        const incident: DemoIncident = {
          id: id('incident'),
          patient_id: uid,
          summary: String(p.summary ?? 'Aviso de malestar').slice(0, 2000),
          state: 'active',
          created_at: now(),
          expires_at: later(2 * 60 * 60_000),
          ...DEMO_LOCATION,
          location_at: now(),
          shareLocation: true,
          notificationState: 'provider_delivered',
          messages: [],
          members: [{ receivedAt: null, acknowledgedAt: null, caregiverName: link.caregiverName ?? DEMO_CAREGIVER_NAME }],
        };
        incidents.push(incident);
        // El cuidador simulado abre el aviso, confirma que lo atiende y escribe.
        setTimeout(() => { if (incident.state === 'active') incident.members[0].receivedAt = now(); }, timing.received);
        setTimeout(() => {
          if (incident.state !== 'active') return;
          incident.members[0].acknowledgedAt = now();
          message(incident, link.caregiverId ?? DEMO_CAREGIVER_ID, `Soy ${link.caregiverName ?? 'tu cuidador'}. He visto tu aviso y estoy pendiente de ti. (Respuesta de prueba)`);
        }, timing.acknowledged);
        return ok({ incidentId: incident.id, queued: false });
      }
      case 'received':
      case 'ack': {
        const incident = findIncident(p.incidentId);
        if (!incident) return fail('NOT_ALLOWED');
        const member = incident.members[0];
        if (member) {
          member.receivedAt ??= now();
          if (action === 'ack') member.acknowledgedAt ??= now();
        }
        return ok({ ok: true });
      }
      case 'message': {
        const incident = findIncident(p.incidentId);
        if (!incident) return fail('NOT_ALLOWED');
        if (incident.state !== 'active') return fail('INCIDENT_CLOSED');
        const text = String(p.content ?? '').trim().slice(0, 2000);
        if (!text) return fail('INVALID_REQUEST');
        const checkIn = p.checkIn === true;
        const sent = message(incident, uid, text, checkIn ? 60_000 : null);
        const otherIsPatient = incident.patient_id !== uid;
        setTimeout(() => {
          if (incident.state !== 'active') return;
          if (otherIsPatient) {
            sent.responded_at = now();
            message(incident, incident.patient_id, 'Ya estoy mejor, gracias. Sigo sentada. (Respuesta de prueba)');
          } else {
            const link = links.find((l) => l.accepted && l.patientId === uid);
            message(incident, link?.caregiverId ?? DEMO_CAREGIVER_ID, 'Recibido. Quédate tranquila, voy para allá. (Respuesta de prueba)');
          }
        }, timing.reply);
        return ok({ id: sent.id });
      }
      case 'close': {
        const incident = findIncident(p.incidentId);
        if (!incident) return fail('NOT_ALLOWED');
        incident.state = 'closed';
        incident.shareLocation = false;
        incident.notificationState = 'cancelled';
        return ok({ closed: true });
      }
      case 'location': {
        const incident = findIncident(p.incidentId);
        if (!incident) return fail('NOT_ALLOWED');
        incident.latitude = Number(p.latitude);
        incident.longitude = Number(p.longitude);
        incident.accuracy = p.accuracy === null ? null : Number(p.accuracy);
        incident.location_at = now();
        return ok({ ok: true });
      }
      default:
        return fail('INVALID_REQUEST');
    }
  }

  function pairingAction(action: string, p: Record<string, unknown>): Result {
    switch (action) {
      case 'status':
        return ok({ premium: opts.isPremium(), code: opts.isPremium() ? myCode : null, role });
      case 'my_code':
        return opts.isPremium() ? ok({ code: myCode }) : fail('PREMIUM_REQUIRED');
      case 'rotate_code':
        if (!opts.isPremium()) return fail('PREMIUM_REQUIRED');
        myCode = String(100000 + Math.floor(Math.random() * 900000));
        return ok({ code: myCode });
      case 'request': {
        const code = String(p.code ?? '').replace(/\D/g, '');
        if (!/^\d{6}$/.test(code)) return fail('INVALID_CODE');
        if (code === myCode && opts.isPremium()) return fail('SELF_LINK');
        const name = String(p.name ?? '').trim().slice(0, 80) || opts.myName() || 'Cuidador/a';
        const existing = links.find((l) => l.caregiverId === uid && l.patientId === DEMO_PATIENT_ID);
        if (existing) return ok({ linkId: existing.id, patientName: existing.patientName, status: existing.accepted ? 'accepted' : 'pending' });
        const link: DemoLink = { id: id('link'), patientId: DEMO_PATIENT_ID, caregiverId: uid, patientName: DEMO_PATIENT_NAME, caregiverName: name, accepted: false };
        links.push(link);
        // La paciente simulada acepta la solicitud al cabo de unos segundos y, después, envía un aviso de prueba.
        setTimeout(() => {
          if (!links.includes(link)) return;
          link.accepted = true;
          role = 'caregiver';
          simulateIncomingIncident(link);
        }, timing.accept);
        return ok({ linkId: link.id, patientName: link.patientName, status: 'pending' });
      }
      case 'approve': {
        const link = links.find((l) => l.id === p.linkId && l.patientId === uid && !l.accepted);
        if (!link) return fail('INVALID_REQUEST');
        link.accepted = true;
        return ok({ accepted: true, caregiverName: link.caregiverName });
      }
      case 'reject': {
        const index = links.findIndex((l) => l.id === p.linkId && l.patientId === uid && !l.accepted);
        if (index < 0) return fail('INVALID_REQUEST');
        links.splice(index, 1);
        return ok({ rejected: true });
      }
      case 'disconnect': {
        const index = links.findIndex((l) => l.id === p.linkId && (l.patientId === uid || l.caregiverId === uid));
        if (index < 0) return fail('INVALID_REQUEST');
        const [link] = links.splice(index, 1);
        // Al desvincular, la conversación deja de verse y se borra.
        for (let i = chats.length - 1; i >= 0; i -= 1) if (chats[i].linkId === link.id) chats.splice(i, 1);
        incidents
          .filter((i) => i.state === 'active' && (i.patient_id === link.patientId))
          .forEach((i) => { i.state = 'closed'; i.notificationState = 'cancelled'; });
        if (!links.some((l) => l.accepted && l.caregiverId === uid)) role = 'patient';
        return ok({ disconnected: true });
      }
      default:
        return fail('INVALID_REQUEST');
    }
  }

  // ── Chat del día a día (misma forma que la función real care_chat_action) ──
  const chatLinks = () => links.filter((l) => l.accepted && !!l.caregiverId && (l.patientId === uid || l.caregiverId === uid));
  const chatOf = (linkId: string) => chats.filter((m) => m.linkId === linkId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const chatJson = (m: DemoChatMessage) => ({
    id: m.id, linkId: m.linkId, senderId: m.senderId, content: m.content, createdAt: m.createdAt, readAt: m.readAt,
    kind: m.kind ?? 'text', callOutcome: m.callOutcome ?? null, callSeconds: m.callSeconds ?? null,
  });
  /** Hasta cuándo está encendido el chat para el cuidador/a: 1 hora desde el último mensaje escrito por la persona cuidada. */
  const openUntil = (l: DemoLink) => {
    const lastPatient = chatOf(l.id).filter((m) => m.senderId === l.patientId && (m.kind ?? 'text') === 'text').pop();
    if (!lastPatient) return null;
    const until = Date.parse(lastPatient.createdAt) + 3_600_000;
    return until > Date.now() ? new Date(until).toISOString() : null;
  };
  const conversation = (l: DemoLink) => {
    const mine = l.patientId === uid;
    const list = chatOf(l.id);
    const last = list[list.length - 1];
    // La persona cuidada simulada siempre tiene Premium; si es la cuenta de demostración, según su plan.
    const premium = mine ? opts.isPremium() : true;
    const until = openUntil(l);
    return {
      linkId: l.id,
      myRole: mine ? 'patient' : 'caregiver',
      otherId: mine ? l.caregiverId : l.patientId,
      otherName: mine ? l.caregiverName ?? 'Tu cuidador/a' : l.patientName,
      patientName: l.patientName,
      premium,
      openUntil: until,
      // Como en el servidor: la persona cuidada escribe cuando quiere; su cuidador/a, con el chat encendido.
      canSend: premium && (mine || until !== null),
      unread: list.filter((m) => m.senderId !== uid && !m.readAt).length,
      lastMessage: last ? chatJson(last) : null,
    };
  };
  /** Respuesta automática de la otra persona (marcada como prueba). */
  const demoReply = (l: DemoLink, text: string) => {
    const t = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (l.patientId === uid) {
      if (/llam/.test(t)) return 'Ahora te llamo, mamá. (Respuesta de prueba)';
      if (/ven|ayuda|necesito/.test(t)) return 'Voy para allá. Llego en un rato. (Respuesta de prueba)';
      if (/pastilla/.test(t)) return '¡Muy bien, mamá! Así me quedo tranquilo. (Respuesta de prueba)';
      return '¡Qué bien saber de ti! Luego te llamo. (Respuesta de prueba)';
    }
    if (/llam/.test(t)) return 'Vale, aquí estoy. (Respuesta de prueba)';
    if (/pastilla/.test(t)) return 'Sí, ya me las he tomado. Gracias por acordarte. (Respuesta de prueba)';
    if (/como estas|que tal/.test(t)) return 'Estoy bien. Un poco cansada, pero bien. (Respuesta de prueba)';
    return 'Gracias. Un beso. (Respuesta de prueba)';
  };

  function chatAction(action: string, p: Record<string, unknown>): Result {
    if (action === 'list') {
      const list = chatLinks().map(conversation).sort((a, b) => (b.lastMessage?.createdAt ?? '').localeCompare(a.lastMessage?.createdAt ?? ''));
      return ok({ conversations: list });
    }
    if (action === 'export') {
      return ok({ conversations: chatLinks().map((l) => ({ ...conversation(l), messages: chatOf(l.id).map(chatJson) })) });
    }
    const link = chatLinks().find((l) => l.id === p.linkId);
    if (!p.linkId) return fail('INVALID_REQUEST');
    if (!link) return fail('NOT_ALLOWED');
    switch (action) {
      case 'messages': {
        const limit = Math.min(200, Math.max(1, Number(p.limit) || 80));
        const before = typeof p.before === 'string' ? p.before : null;
        const all = chatOf(link.id).filter((m) => !before || m.createdAt < before);
        const page = all.slice(-limit);
        return ok({ conversation: conversation(link), messages: page.map(chatJson), hasMore: all.length > limit });
      }
      case 'send': {
        const conv = conversation(link);
        if (!conv.premium) return fail('PREMIUM_REQUIRED');
        if (!conv.canSend) return fail('CHAT_CLOSED');
        const clientKey = String(p.clientKey ?? '');
        if (!clientKey) return fail('INVALID_REQUEST');
        const existing = chats.find((m) => m.senderId === uid && m.clientKey === clientKey);
        if (existing) return ok({ message: chatJson(existing), replayed: true });
        const content = String(p.content ?? '').trim();
        if (!content || content.length > 1000) return fail('INVALID_CONTENT');
        const sent: DemoChatMessage = { id: id('chat'), linkId: link.id, senderId: uid, content, createdAt: now(), readAt: null, clientKey };
        chats.push(sent);
        const otherId = link.patientId === uid ? link.caregiverId ?? DEMO_CAREGIVER_ID : link.patientId;
        // La otra persona lo lee («Visto») y contesta al poco.
        setTimeout(() => { if (links.includes(link)) sent.readAt ??= now(); }, timing.chatRead ?? 2500);
        setTimeout(() => {
          if (!links.includes(link)) return;
          chats.push({ id: id('chat'), linkId: link.id, senderId: otherId, content: demoReply(link, content), createdAt: now(), readAt: null });
        }, timing.chatReply ?? 6000);
        // «¿Puedes llamarme?»: la otra persona simulada llama de verdad (llamada de prueba entrante).
        if (link.patientId === uid && /llam/i.test(content.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
          setTimeout(() => startIncomingCall(link, otherId), (timing.chatReply ?? 6000) + (timing.callBack ?? 3000));
        }
        return ok({ message: chatJson(sent), replayed: false });
      }
      case 'read': {
        let n = 0;
        for (const m of chats) {
          if (m.linkId === link.id && m.senderId !== uid && !m.readAt) {
            m.readAt = now();
            n += 1;
          }
        }
        return ok({ read: n });
      }
      default:
        return fail('INVALID_ACTION');
    }
  }

  // ── Llamadas de voz (misma forma que la función real care_call_action; aquí sin audio) ──
  const calls: DemoCall[] = [];
  const RING_MS = timing.ring ?? 45_000;
  const callJson = (c: DemoCall) => {
    const link = links.find((l) => l.id === c.linkId);
    const otherName = !link ? 'Tu familiar' : link.patientId === uid ? link.caregiverName ?? 'Tu cuidador/a' : link.patientName;
    return {
      id: c.id, linkId: c.linkId, direction: c.callerId === uid ? 'outgoing' : 'incoming', callerId: c.callerId, recipientId: c.recipientId,
      otherName, state: c.state, outcome: c.outcome,
      offer: c.recipientId === uid && c.state === 'ringing' ? c.offer : null,
      answer: c.callerId === uid && c.state === 'answered' ? c.answer : null,
      createdAt: c.createdAt, answeredAt: c.answeredAt, endedAt: c.endedAt, expiresAt: c.expiresAt,
    };
  };
  const finishCall = (c: DemoCall, outcome: 'answered' | 'missed' | 'declined' | 'failed') => {
    if (c.state === 'ended') return;
    const seconds = outcome === 'answered' && c.answeredAt ? Math.max(0, Math.round((Date.now() - Date.parse(c.answeredAt)) / 1000)) : null;
    Object.assign(c, { state: 'ended', outcome, endedAt: now(), offer: null, answer: null });
    const label = outcome === 'answered' ? 'Llamada de voz' : outcome === 'declined' ? 'Llamada rechazada' : outcome === 'failed' ? 'Llamada no conectada' : 'Llamada perdida';
    chats.push({ id: id('chat'), linkId: c.linkId, senderId: c.callerId, content: label, createdAt: now(), readAt: outcome === 'missed' ? null : now(), kind: 'call', callOutcome: outcome, callSeconds: seconds });
  };
  const expireCalls = () => {
    for (const c of calls) {
      if (c.state === 'ended') continue;
      if (!chatLinks().some((l) => l.id === c.linkId)) finishCall(c, c.state === 'answered' ? 'answered' : 'missed');
      else if (c.state === 'ringing' && Date.parse(c.expiresAt) <= Date.now()) finishCall(c, 'missed');
    }
  };
  const activeCall = (who: string[]) => calls.find((c) => c.state !== 'ended' && (who.includes(c.callerId) || who.includes(c.recipientId)));
  /** La otra persona simulada llama a la cuenta de demostración. */
  function startIncomingCall(link: DemoLink, otherId: string) {
    expireCalls();
    if (!chatLinks().includes(link) || activeCall([uid, otherId])) return;
    calls.push({ id: id('call'), linkId: link.id, callerId: otherId, recipientId: uid, state: 'ringing', outcome: null, offer: 'v=0 llamada de prueba',
      answer: null, createdAt: now(), answeredAt: null, endedAt: null, expiresAt: later(RING_MS) });
  }

  function callAction(action: string, p: Record<string, unknown>): Result {
    expireCalls();
    if (action === 'incoming') {
      const c = [...calls].reverse().find((x) => x.recipientId === uid && x.state === 'ringing');
      return ok(c ? callJson(c) : null);
    }
    if (action === 'offer') {
      const link = chatLinks().find((l) => l.id === p.linkId);
      if (!p.linkId || !p.callId) return fail('INVALID_REQUEST');
      if (!link) return fail('NOT_ALLOWED');
      if (!conversation(link).canSend) return fail('PREMIUM_REQUIRED');
      const existing = calls.find((c) => c.id === p.callId);
      if (existing) return ok(callJson(existing));
      if (!String(p.sdp ?? '').startsWith('v=0')) return fail('INVALID_SDP');
      const otherId = (link.patientId === uid ? link.caregiverId : link.patientId) ?? DEMO_CAREGIVER_ID;
      if (activeCall([uid, otherId])) return fail('CALL_BUSY');
      const c: DemoCall = { id: String(p.callId), linkId: link.id, callerId: uid, recipientId: otherId, state: 'ringing', outcome: null,
        offer: String(p.sdp), answer: null, createdAt: now(), answeredAt: null, endedAt: null, expiresAt: later(RING_MS) };
      calls.push(c);
      // La otra persona simulada contesta al poco.
      setTimeout(() => {
        if (c.state !== 'ringing') return;
        Object.assign(c, { state: 'answered', answer: 'v=0 respuesta de prueba', answeredAt: now(), expiresAt: later(2 * 60 * 60_000) });
      }, timing.callAnswer ?? 4000);
      return ok(callJson(c));
    }
    const c = calls.find((x) => x.id === p.callId && (x.callerId === uid || x.recipientId === uid));
    if (!p.callId) return fail('INVALID_REQUEST');
    if (!c) return fail('NOT_ALLOWED');
    switch (action) {
      case 'snapshot':
        return ok(callJson(c));
      case 'answer':
        if (c.recipientId !== uid) return fail('NOT_ALLOWED');
        if (c.state !== 'ringing') return fail('CALL_ENDED');
        Object.assign(c, { state: 'answered', answer: String(p.sdp ?? 'v=0'), offer: null, answeredAt: now(), expiresAt: later(2 * 60 * 60_000) });
        return ok(callJson(c));
      case 'decline':
        if (c.recipientId !== uid) return fail('NOT_ALLOWED');
        if (c.state === 'ringing') finishCall(c, 'declined');
        return ok(callJson(c));
      case 'end':
        finishCall(c, c.state === 'answered' ? 'answered' : c.callerId === uid ? 'missed' : 'declined');
        return ok(callJson(c));
      case 'fail':
        finishCall(c, 'failed');
        return ok(callJson(c));
      default:
        return fail('INVALID_ACTION');
    }
  }

  return {
    rpc(name: string, args: unknown): Result {
      const a = (args ?? {}) as { p_action?: unknown; p_payload?: unknown };
      const action = String(a.p_action ?? '');
      const payload = (a.p_payload && typeof a.p_payload === 'object' ? a.p_payload : {}) as Record<string, unknown>;
      if (name === 'caregiver_action') return caregiverAction(action, payload);
      if (name === 'care_pairing_action') return pairingAction(action, payload);
      if (name === 'care_chat_action') return chatAction(action, payload);
      if (name === 'care_call_action') return callAction(action, payload);
      // Llamada de audio por internet: en la demostración no hay ninguna en curso (la app lo explica).
      if (name === 'caregiver_call') return ok(null);
      return fail('INVALID_REQUEST');
    },
  };
}
