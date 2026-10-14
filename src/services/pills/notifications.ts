/**
 * Avisos LOCALES de «Mis pastillas» con expo-notifications (funcionan sin internet y con la app cerrada, dentro de
 * lo que permite cada sistema; también en Expo Go). La voz NO suena sola en segundo plano: el teléfono muestra el
 * aviso con su sonido y, al abrirlo con la app en primer plano, MediClaro lo lee con la voz elegida.
 *
 *  - Sonido de ALARMA propio (assets/sounds/mediclaro_alarma.wav, 10 s de «din-don» en tonos medios): suena como un
 *    despertador para que la persona lo oiga. En Expo Go no se pueden añadir sonidos: allí suena el tono normal.
 *  - Android: canal «Alarma de medicación» con ese sonido por el canal de ALARMAS (usa el volumen de alarma y suena
 *    aunque el móvil esté en «No molestar» si las alarmas están permitidas) y canal sin sonido.
 *  - iOS: el mismo sonido (hasta 30 s permitidos); las alertas críticas (que suenan en silencio) necesitan un permiso
 *    especial de Apple (APPLE_CRITICAL_ALERTS_REQUEST.md) y NO se usan aquí.
 *  - Web (vista previa): no hay avisos programables; la app lo explica y permite «Probar el aviso» dentro de la app.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { IS_EXPO_GO } from '../../utils/runtime';
import type { PlannedReminder, ReminderAdapter } from './reminderPlan';

/** Canal con el sonido de alarma (los canales de Android no pueden cambiar de sonido: por eso es uno nuevo). */
export const CHANNEL_SOUND = 'medication-alarm';
export const CHANNEL_SILENT = 'medication-reminders-silent';
/** Canal anterior (tono normal). Se borra al crear el nuevo para que no aparezcan dos en los ajustes del móvil. */
const OLD_CHANNEL_SOUND = 'medication-reminders';
/** Sonido de alarma incluido en la app (app.json → expo-notifications → sounds). */
export const ALARM_SOUND_FILE = 'mediclaro_alarma.wav';
/** En Expo Go no hay sonidos propios: tono normal del teléfono. */
const ALARM_SOUND: string = IS_EXPO_GO ? 'default' : ALARM_SOUND_FILE;

export type ReminderPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export const remindersSupported = Platform.OS === 'ios' || Platform.OS === 'android';

export async function ensureReminderChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.deleteNotificationChannelAsync(OLD_CHANNEL_SOUND).catch(() => undefined);
  await Notifications.setNotificationChannelAsync(CHANNEL_SOUND, {
    name: 'Alarma de medicación',
    description: 'Suena como una alarma a la hora de cada toma de «Mis pastillas».',
    importance: Notifications.AndroidImportance.MAX,
    sound: ALARM_SOUND,
    vibrationPattern: [0, 700, 300, 700, 300, 700],
    enableVibrate: true,
    audioAttributes: {
      usage: Notifications.AndroidAudioUsage.ALARM,
      contentType: Notifications.AndroidAudioContentType.SONIFICATION,
    },
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_SILENT, {
    name: 'Recordatorios de medicación (sin sonido)',
    importance: Notifications.AndroidImportance.HIGH,
    sound: null,
    vibrationPattern: [0, 500, 250, 500],
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
  });
}

export async function reminderPermission(): Promise<ReminderPermission> {
  if (!remindersSupported) return 'unsupported';
  const p = await Notifications.getPermissionsAsync();
  if (p.status === 'granted') return 'granted';
  return p.canAskAgain === false || p.status === 'denied' ? 'denied' : 'undetermined';
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (!remindersSupported) return 'unsupported';
  await ensureReminderChannels();
  const p = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return p.status === 'granted' ? 'granted' : 'denied';
}

export const expoReminderAdapter: ReminderAdapter = {
  async scheduledIds() {
    if (!remindersSupported) return [];
    return (await Notifications.getAllScheduledNotificationsAsync()).map((n) => n.identifier);
  },
  async schedule(r: PlannedReminder) {
    if (!remindersSupported) return;
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: {
        title: r.title,
        body: r.body,
        sound: r.sound ? ALARM_SOUND : false,
        data: { kind: 'dose', treatmentId: r.treatmentId, date: r.date, time: r.time, reminder: r.kind },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: r.at,
        channelId: r.sound ? CHANNEL_SOUND : CHANNEL_SILENT,
      },
    });
  },
  async cancel(id: string) {
    if (!remindersSupported) return;
    await Notifications.cancelScheduledNotificationAsync(id);
  },
};

export interface DoseNotificationData {
  treatmentId: string;
  date: string;
  time: string;
}

/** Datos de un aviso de toma (null si es otro tipo de aviso, p. ej. de un familiar). */
export function doseDataOf(n: Notifications.Notification | null | undefined): DoseNotificationData | null {
  const data = n?.request.content.data as Record<string, unknown> | undefined;
  if (!data || data.kind !== 'dose') return null;
  const { treatmentId, date, time } = data;
  return typeof treatmentId === 'string' && typeof date === 'string' && typeof time === 'string' ? { treatmentId, date, time } : null;
}

/** Avisos de toma que siguen en el centro de notificaciones (entregados y aún sin abrir). */
export async function presentedDoseNotifications(): Promise<DoseNotificationData[]> {
  if (!remindersSupported) return [];
  const list = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  return list.map((n) => doseDataOf(n)).filter((d): d is DoseNotificationData => !!d);
}

/** Quita del centro de notificaciones los avisos de una toma ya resuelta. */
export async function dismissDoseNotifications(treatmentId: string, date: string, time: string): Promise<void> {
  if (!remindersSupported) return;
  const list = await Notifications.getPresentedNotificationsAsync().catch(() => []);
  for (const n of list) {
    const d = doseDataOf(n);
    if (d && d.treatmentId === treatmentId && d.date === date && d.time === time) {
      await Notifications.dismissNotificationAsync(n.request.identifier).catch(() => undefined);
    }
  }
}

/** Un aviso de prueba dentro de 5 segundos (para comprobar sonido y permisos en el propio teléfono). */
export async function scheduleTestReminder(sound: boolean): Promise<void> {
  if (!remindersSupported) throw new Error('unsupported');
  await ensureReminderChannels();
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'MediClaro',
      body: 'Prueba: así sonará el aviso de tu medicamento. No es un aviso real.',
      sound: sound ? ALARM_SOUND : false,
      data: { kind: 'dose-test' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: sound ? CHANNEL_SOUND : CHANNEL_SILENT },
  });
}
