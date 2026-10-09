/**
 * /pills/settings — avisos, sonido, voz, privacidad y permisos del cuidador/a de «Mis pastillas».
 *
 * Dice la verdad sobre lo que el teléfono permite: los avisos llegan aunque la app esté cerrada o no haya internet,
 * con el sonido del sistema; la voz de MediClaro suena al abrir el aviso con la app en primer plano (iOS y Android no
 * dejan que una app hable sola en segundo plano). Los permisos del cuidador/a los decide SOLO el paciente.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  Card,
  InfoBanner,
  ListGroup,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionHeader,
  SegmentedControl,
  SettingRow,
  TextButton,
} from '../../components';
import { useAppTheme, usePreferences } from '../../hooks';
import { usePillPlan } from '../../hooks/usePillPlan';
import { useReminderVoice } from '../../hooks/useReminderVoice';
import {
  MedicationPlanService,
  PillReminders,
  isAppError,
  reminderPermission,
  remindersSupported,
  requestReminderPermission,
  scheduleTestReminder,
  type CarePermission,
  type ReminderPermission,
  type ReminderSettings,
} from '../../services';
import { openAppSettings } from '../../utils/device';
import { withPremium } from '../premium/PremiumGate';
import { doseViews, nextDose, occurrencesForDate } from '../../domain/medication';
import { ZONE, todayDate } from './parts';

const REPEAT = [
  { value: '0', label: 'No' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
  { value: '60', label: '1 hora' },
];
const SNOOZE = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '30', label: '30 min' },
];

function PillSettingsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { prefs } = usePreferences();
  const { state } = usePillPlan();
  const voice = useReminderVoice();
  const [permission, setPermission] = useState<ReminderPermission>(remindersSupported ? 'undetermined' : 'unsupported');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void reminderPermission().then(setPermission).catch(() => undefined);
    }, []),
  );

  const settings = state?.settings;
  const update = async (patch: Partial<ReminderSettings>) => {
    setError(null);
    try {
      await MedicationPlanService.saveSettings(patch);
      await PillReminders.reschedule();
    } catch (e) {
      setError(isAppError(e) ? e.message : 'No se ha podido guardar.');
    }
  };

  const test = async () => {
    setMessage(null);
    if (!remindersSupported) {
      // Vista previa web: no hay avisos del sistema; se enseña el aviso dentro de la app (la próxima toma de hoy sin
      // confirmar) con su alarma y su voz, como sonaría a su hora.
      const now = new Date();
      const d = todayDate(now);
      const views = state ? doseViews(occurrencesForDate(state.treatments.filter((x) => x.active), d, ZONE), state.events, now) : [];
      const next = nextDose(views) ?? views.find((v) => v.status !== 'taken' && v.status !== 'skipped') ?? null;
      if (next) {
        router.push({ pathname: '/pills/reminder', params: { t: next.occurrence.treatmentId, d, h: next.occurrence.time, a: '1', prueba: '1' } });
      } else {
        void (async () => {
          if (settings?.sound !== false) await voice.ring();
          void voice.speak('Es la hora de tu medicamento.', prefs.assistantVoice, prefs.speechRate);
        })();
      }
      return;
    }
    try {
      const granted = permission === 'granted' ? 'granted' : await requestReminderPermission();
      setPermission(granted);
      if (granted !== 'granted') {
        setError('Permite los avisos de MediClaro en los ajustes del teléfono.');
        return;
      }
      await scheduleTestReminder(settings?.sound !== false);
      setMessage('En 5 segundos llegará un aviso de prueba. Puedes bloquear el teléfono para ver cómo aparece.');
    } catch {
      setError('No se ha podido programar el aviso de prueba.');
    }
  };

  const setPermissionFor = async (p: CarePermission, patch: Partial<CarePermission>) => {
    setError(null);
    try {
      const next = { ...p, ...patch };
      if (!next.canView) {
        next.canConfirm = false;
        next.missedDoseAlerts = false;
      }
      await MedicationPlanService.setCarePermissions(p.linkId, {
        canView: next.canView,
        canConfirm: next.canConfirm,
        missedDoseAlerts: next.missedDoseAlerts,
        alertAfterMinutes: next.alertAfterMinutes,
      });
    } catch (e) {
      setError(isAppError(e) ? e.message : 'Necesitas conexión para cambiar los permisos.');
    }
  };

  const deleteAll = async () => {
    setBusy(true);
    setError(null);
    try {
      await MedicationPlanService.deleteAll();
      await PillReminders.reschedule(false);
      setConfirmDelete(false);
      setMessage('Se han borrado todos tus datos de medicación de tu cuenta y de este móvil.');
    } catch (e) {
      setError(isAppError(e) ? e.message : 'Necesitas conexión para borrar tus datos.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen header={<AppHeader title="Avisos de Mis pastillas" fallbackHref="/pills" />} testID="pills-settings-screen">
      <View style={{ gap: theme.spacing.md }}>
        {message ? <InfoBanner tone="success" message={message} testID="pills-settings-message" /> : null}
        {error ? <InfoBanner tone="danger" message={error} /> : null}

        <Card tone={permission === 'granted' ? 'success' : 'warning'} testID="pills-settings-permission">
          <AppText variant="bodyStrong" color="heading">
            {permission === 'granted'
              ? 'Los avisos están activados'
              : permission === 'unsupported'
                ? 'Vista previa: el teléfono no avisa aquí'
                : 'Los avisos no están activados'}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {permission === 'unsupported'
              ? 'En tu móvil, MediClaro suena como una alarma a la hora de cada toma, también con la app cerrada y sin internet. Aquí puedes oír y ver cómo es el aviso.'
              : 'El teléfono avisa a la hora de cada toma aunque la app esté cerrada y sin internet, con el sonido del sistema. La voz de MediClaro suena al abrir el aviso.'}
          </AppText>
          <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
            {permission === 'undetermined' ? (
              <PrimaryButton label="Activar avisos" icon="notifications" onPress={() => void requestReminderPermission().then(async (p) => { setPermission(p); if (p === 'granted') await PillReminders.reschedule(); })} testID="pills-settings-enable" />
            ) : null}
            {permission === 'denied' ? <SecondaryButton label="Abrir ajustes del teléfono" icon="settings-outline" onPress={() => void openAppSettings()} /> : null}
            <SecondaryButton label="Probar el aviso" icon="play-circle-outline" onPress={() => void test()} testID="pills-settings-test" />
          </View>
        </Card>

        <ListGroup>
          <SettingRow
            icon="help-circle-outline"
            label="Cómo funciona Mis pastillas"
            description="Qué hace y todo lo que puedes hacer, paso a paso"
            onPress={() => router.push('/pills/help')}
            testID="pills-settings-help"
          />
        </ListGroup>

        <ListGroup>
          <SettingRow
            icon="notifications-outline"
            label="Avisarme de mis tomas"
            description="Si lo desactivas, no sonará ningún aviso (tu pauta y tu historial se conservan)."
            toggle={{ value: settings?.enabled !== false, onChange: (v) => void update({ enabled: v }) }}
            testID="pills-settings-enabled"
          />
          <SettingRow
            icon="volume-high-outline"
            label="Con sonido"
            description="Suena una alarma de MediClaro (unos 10 segundos). Sube el volumen del teléfono para oírla bien."
            toggle={{ value: settings?.sound !== false, onChange: (v) => void update({ sound: v }) }}
            testID="pills-settings-sound"
          />
          <SettingRow
            icon="mic-outline"
            label="Leer el aviso en voz alta"
            description="Con la app abierta, MediClaro lee el aviso con la voz que elegiste."
            toggle={{ value: settings?.readAloud !== false, onChange: (v) => void update({ readAloud: v }) }}
            testID="pills-settings-voice"
          />
          <SettingRow
            icon="eye-off-outline"
            label="Mostrar el nombre del medicamento"
            description="En la pantalla bloqueada. Desactivado, otras personas no verán qué tomas."
            toggle={{ value: settings?.showMedicineName === true, onChange: (v) => void update({ showMedicineName: v }) }}
            testID="pills-settings-name"
          />
        </ListGroup>

        <View style={{ gap: theme.spacing.xs }}>
          <SectionHeader title="Si no confirmo la toma, repetir el aviso a los…" />
          <SegmentedControl options={REPEAT} value={String(settings?.repeatAfterMinutes ?? 30)} onChange={(v) => void update({ repeatAfterMinutes: Number(v) })} accessibilityLabel="Repetir el aviso" />
        </View>
        <View style={{ gap: theme.spacing.xs }}>
          <SectionHeader title="«Recordármelo después» aplaza el aviso…" />
          <SegmentedControl options={SNOOZE} value={String(settings?.snoozeMinutes ?? 10)} onChange={(v) => void update({ snoozeMinutes: Number(v) })} accessibilityLabel="Aplazar el aviso" />
        </View>

        <ListGroup>
          <SettingRow icon="text-outline" label="Tamaño de letra y voces" description="Accesibilidad" onPress={() => router.push('/accessibility')} showChevron />
        </ListGroup>

        {state && state.access === 'owner' ? (
          <View style={{ gap: theme.spacing.sm }} testID="pills-settings-care">
            <SectionHeader title="Tu cuidador/a" />
            {state.permissions.length === 0 ? (
              <AppText variant="caption" color="textSecondary">
                Cuando tengas un cuidador/a vinculado (Perfil › Mi cuidador/a), aquí podrás decidir si puede ver tus tomas, confirmarlas por ti y
                recibir un aviso si no confirmas una toma.
              </AppText>
            ) : (
              state.permissions.map((p) => (
                <ListGroup key={p.linkId}>
                  <SettingRow icon="person-circle-outline" label={p.caregiverName ?? 'Tu cuidador/a'} description="Nadie más puede ver tu medicación." />
                  <SettingRow label="Puede ver mis tomas" toggle={{ value: p.canView, onChange: (v) => void setPermissionFor(p, { canView: v }) }} testID={`pills-care-view-${p.linkId}`} />
                  <SettingRow label="Puede confirmar tomas por mí" description="Quedará anotado que las confirmó él o ella." toggle={{ value: p.canConfirm, onChange: (v) => void setPermissionFor(p, { canConfirm: v }), disabled: !p.canView }} testID={`pills-care-confirm-${p.linkId}`} />
                  <SettingRow label="Avisarle si no confirmo una toma" description={`Pasada ${p.alertAfterMinutes === 60 ? '1 hora' : `${p.alertAfterMinutes} minutos`} sin confirmar. El aviso no dice qué medicamento es.`} toggle={{ value: p.missedDoseAlerts, onChange: (v) => void setPermissionFor(p, { missedDoseAlerts: v }), disabled: !p.canView }} testID={`pills-care-alerts-${p.linkId}`} />
                </ListGroup>
              ))
            )}
          </View>
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          <SectionHeader title="Tus datos de medicación" />
          <AppText variant="caption" color="textSecondary">
            Son datos de salud: se guardan cifrados en este móvil y en tu cuenta, solo los ves tú (y tu cuidador/a si se lo permites). Puedes
            descargarlos desde el Historial de tomas («Compartir mi historial») o borrarlos.
          </AppText>
          {confirmDelete ? (
            <Card tone="danger">
              <AppText variant="bodyStrong" color="heading">
                ¿Borrar toda tu medicación?
              </AppText>
              <AppText variant="caption" color="textSecondary">
                Se borrarán tus pautas, tomas, correcciones y avisos de tu cuenta y de este móvil. No se puede deshacer.
              </AppText>
              <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
                <PrimaryButton label="Sí, borrar todo" tone="danger" icon="trash" loading={busy} onPress={() => void deleteAll()} testID="pills-settings-delete-confirm" />
                <TextButton label="Cancelar" onPress={() => setConfirmDelete(false)} />
              </View>
            </Card>
          ) : (
            <TextButton label="Borrar todos mis datos de medicación" tone="danger" icon="trash-outline" onPress={() => setConfirmDelete(true)} testID="pills-settings-delete" />
          )}
        </View>
        <AppText variant="small" color="textMuted" align="center" style={styles.thin}>
          Los avisos ayudan a recordar, pero no sustituyen las indicaciones de tu médico o farmacéutico.
        </AppText>
      </View>
    </Screen>
  );
}

export default withPremium(PillSettingsScreen, 'pills');

const styles = StyleSheet.create({
  thin: { fontWeight: '400' },
});
