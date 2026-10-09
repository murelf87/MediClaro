/**
 * «Mis pastillas» en segundo plano (se monta una vez en app/_layout.tsx):
 *  - al abrir la app, al volver a ella y cada 15 minutos: envía lo pendiente, lee del servidor y deja programados los
 *    avisos que tocan (también tras un cambio de zona horaria o de hora);
 *  - al tocar un aviso (también con la app cerrada): registra «abierto» y abre la pantalla del aviso;
 *  - si llega un aviso con la app abierta: registra «entregado» y abre la pantalla del aviso, que hace sonar la ALARMA
 *    y después lo lee en voz alta (el teléfono no suena encima: ver CaregiverNotifications);
 *  - los avisos que siguen en el centro de notificaciones se registran como «entregados» (nunca como tomas).
 * Sin Premium, los avisos se cancelan (la pauta y el historial se conservan).
 */
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useSession } from '../providers/SessionProvider';
import { useEntitlement } from '../providers/EntitlementProvider';
import { MedicationPlanService, PillReminders } from '../services/MedicationPlanService';
import { doseDataOf, presentedDoseNotifications, type DoseNotificationData } from '../services/pills/notifications';

const logged = new Set<string>();

export function PillReminderHost() {
  const { session } = useSession();
  const entitlement = useEntitlement();
  const router = useRouter();
  const uid = session?.userId ?? null;
  const unlocked = entitlement.unlocked;
  const ready = entitlement.status === 'ready';

  useEffect(() => {
    if (!uid) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const log = (d: DoseNotificationData, state: 'delivered' | 'opened') => {
      const key = `${d.treatmentId}|${d.date}|${d.time}|${state}`;
      if (logged.has(key)) return;
      logged.add(key);
      void MedicationPlanService.logReminder({ treatmentId: d.treatmentId, occurrenceDate: d.date, scheduledTime: d.time, state }).catch(() => undefined);
    };
    const open = (d: DoseNotificationData, ring = false) => {
      router.push({ pathname: '/pills/reminder', params: { t: d.treatmentId, d: d.date, h: d.time, ...(ring ? { a: '1' } : {}) } });
    };
    const reschedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!stopped && ready) void PillReminders.reschedule(unlocked).catch(() => undefined);
      }, 600);
    };
    const onActive = async () => {
      try {
        await MedicationPlanService.load();
        if (unlocked) await MedicationPlanService.sync().catch(() => undefined);
        await PillReminders.zoneChanged().catch(() => false);
        for (const d of await presentedDoseNotifications()) log(d, 'delivered');
      } finally {
        if (!stopped) reschedule();
      }
    };

    void onActive();
    const unsubscribe = MedicationPlanService.subscribe(() => reschedule());
    const appState = AppState.addEventListener('change', (s) => {
      if (s === 'active') void onActive();
    });
    const interval = setInterval(() => void onActive(), 15 * 60_000);

    let subs: Array<{ remove: () => void }> = [];
    if (Platform.OS !== 'web') {
      subs = [
        Notifications.addNotificationResponseReceivedListener((r) => {
          const d = doseDataOf(r.notification);
          if (!d) return;
          log(d, 'opened');
          open(d);
        }),
        Notifications.addNotificationReceivedListener((n) => {
          const d = doseDataOf(n);
          if (!d) return;
          log(d, 'delivered');
          if (AppState.currentState === 'active') open(d, true);
        }),
      ];
      // App abierta tocando un aviso (estaba cerrada).
      void Notifications.getLastNotificationResponseAsync()
        .then((r) => {
          const d = doseDataOf(r?.notification);
          if (!stopped && d) {
            log(d, 'opened');
            open(d);
            void Notifications.clearLastNotificationResponseAsync().catch(() => undefined);
          }
        })
        .catch(() => undefined);
    }

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      clearInterval(interval);
      unsubscribe();
      appState.remove();
      subs.forEach((s) => s.remove());
    };
  }, [uid, unlocked, ready, router]);

  return null;
}
