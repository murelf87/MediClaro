/**
 * Llamadas entrantes del chat con el cuidador/a: con MediClaro abierta, si alguien de tus vinculaciones te llama,
 * se abre la pantalla de la llamada (suena y vibra) para Aceptar o Rechazar — como en WhatsApp.
 *
 * Mira cada pocos segundos SOLO si la persona tiene alguna conversación (si no, nadie puede llamarla), y al momento
 * cuando llega el aviso «X te está llamando». Con la app cerrada avisa la notificación del teléfono.
 */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useSession } from '../providers/SessionProvider';
import { CareCallService } from '../services/CareCallService';
import { CareChatService } from '../services/CareChatService';

const POLL_MS = 4000;

export function CareCallHost() {
  const { status, session } = useSession();
  const router = useRouter();
  const uid = session?.userId;
  useEffect(() => {
    if (status !== 'signedIn' || !uid) return undefined;
    let stopped = false;
    let busy = false;
    const shown = new Set<string>();
    /** force: al llegar el aviso «X te está llamando» se mira aunque aún no se hayan cargado las conversaciones. */
    const check = async (force = false) => {
      if (stopped || busy || AppState.currentState !== 'active' || CareCallService.isScreenOpen()) return;
      if (!force && (!CareChatService.isAvailable() || !CareChatService.getSummary().length)) return;
      busy = true;
      try {
        const call = await CareCallService.incoming();
        if (stopped || !call || shown.has(call.id) || call.state !== 'ringing' || CareCallService.isScreenOpen()) return;
        shown.add(call.id);
        router.push({ pathname: '/caregiver-call', params: { link: call.linkId, call: call.id, incoming: '1' } } as Href);
      } catch {
        // sin conexión o aún sin desplegar: se vuelve a mirar más tarde
      } finally {
        busy = false;
      }
    };
    const timer = setInterval(() => void check(), POLL_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void check();
    });
    const off = CareCallService.onIncomingCheck(() => void check(true));
    void check();
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
      off();
    };
  }, [status, uid, router]);
  return null;
}
