/**
 * /pills/reminder?t=<tratamiento>&d=<fecha>&h=<hora> — el AVISO de una toma (se abre al tocar la notificación, sola
 * si la app está abierta a esa hora, o desde «Mis pastillas»). Pantalla grande y tranquila con tres botones:
 *   1. «Sí, ya la he tomado»   → se registra la toma (hora real y hora de confirmación) y se cancelan los avisos repetidos.
 *   2. «Recordármelo después»  → se aplaza el aviso (minutos de Ajustes).
 *   3. «Todavía no la he tomado» → se anota y el aviso se repetirá.
 * Si esa toma ya figura confirmada, se advierte («Atención: esta toma ya figura confirmada a las 15:49») y solo se
 * registra otra si de verdad se ha tomado: queda como toma adicional (posible incidencia) con la recomendación de
 * consultarlo con un profesional. Con la app abierta, MediClaro lee el aviso con la voz elegida.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, AppText, Card, Chip, EmptyState, Icon, InfoBanner, PrimaryButton, Screen, SecondaryButton, TextButton } from '../../components';
import { useAppTheme, usePreferences } from '../../hooks';
import { useNow, usePillPlan } from '../../hooks/usePillPlan';
import { useReminderVoice } from '../../hooks/useReminderVoice';
import { MedicationPlanService, PillReminders, remindersSupported, isAppError } from '../../services';
import {
  doseLabel,
  doseViews,
  duplicateWarning,
  formatDose,
  isLateEntry,
  medicineLabel,
  occurrenceKey,
  type DoseEvent,
  type Occurrence,
} from '../../domain/medication';
import { withPremium } from '../premium/PremiumGate';
import { PillPhoto, StatusPill, ZONE, clock, dayTitle, todayDate } from './parts';

function param(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

type Phase = 'ask' | 'duplicate' | 'skip' | 'done' | 'snoozed' | 'notyet' | 'skipped' | 'retime';

function DoseReminderScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const { prefs } = usePreferences();
  const params = useLocalSearchParams<{ t?: string; d?: string; h?: string; a?: string; prueba?: string }>();
  const t = param(params.t);
  const d = param(params.d);
  const h = param(params.h);
  // a=1: ha llegado el aviso con la app abierta → suena la alarma aquí (el teléfono no la suena encima).
  const alarm = param(params.a) === '1';
  // prueba=1: «Probar el aviso» en la vista previa (enseña el aviso como a su hora).
  const testMode = param(params.prueba) === '1';
  const { state, loading } = usePillPlan();
  const now = useNow(15_000);
  const today = todayDate(now);
  const voice = useReminderVoice();
  const [phase, setPhase] = useState<Phase>('ask');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<DoseEvent | null>(null);
  const spoken = useRef(false);

  const treatment = state?.treatments.find((x) => x.id === t) ?? null;
  const occurrence: Occurrence | null = useMemo(
    () => (treatment && d && h ? { key: occurrenceKey(treatment.id, d, h), treatmentId: treatment.id, date: d, time: h, at: ZONE.instant(d, h), treatment } : null),
    [treatment, d, h],
  );
  const view = occurrence && state ? doseViews([occurrence], state.events, now)[0] : null;
  const settings = state?.settings;
  const isFuture = d > today;
  const isPast = d < today;
  // Hoy, pero aún falta más de media hora: no es «la hora»; solo se puede anotar si ya se ha tomado.
  const notDueYet = !testMode && !isFuture && !isPast && !!occurrence && occurrence.at.getTime() - now.getTime() > 30 * 60_000;

  // Con la app abierta: si acaba de llegar el aviso, suena la ALARMA; después lo lee una vez con la voz natural
  // elegida (cada cosa si está activada en Ajustes). Si la persona pulsa un botón, todo se calla.
  useEffect(() => {
    if (spoken.current || !view || view.status === 'taken' || view.status === 'skipped' || isFuture || notDueYet || !settings) return;
    const ringNow = alarm && settings.enabled !== false && settings.sound !== false;
    if (!settings.readAloud && !ringNow) return;
    spoken.current = true;
    const t0 = occurrence!.treatment;
    const nearNow = Math.abs(now.getTime() - occurrence!.at.getTime()) < 10 * 60_000;
    const intro = testMode ? 'Es la hora de tu medicamento' : nearNow ? `Son las ${h}. Es la hora de tu medicamento` : `Toma de las ${h}`;
    const text = `${intro}: ${doseLabel(t0)}.${t0.instructions ? ` ${t0.instructions}.` : ''}`;
    void (async () => {
      const rang = ringNow ? await voice.ring() : true;
      if (rang && settings.readAloud) void voice.speak(text, prefs.assistantVoice, prefs.speechRate);
    })();
  }, [view, settings, alarm, testMode, isFuture, notDueYet, occurrence, now, h, voice, prefs.assistantVoice, prefs.speechRate]);

  const header = <AppHeader title="Aviso de tu medicamento" fallbackHref="/pills" />;

  if (!occurrence || !view) {
    return (
      <Screen header={header} testID="pill-reminder-screen">
        {loading ? null : (
          <EmptyState
            icon="medkit-outline"
            title="No encontramos esta toma"
            message="Puede que la pauta se haya cambiado. Vuelve a «Mis pastillas» para ver tus tomas de hoy."
            action={{ label: 'Ir a Mis pastillas', onPress: () => router.replace('/pills') }}
          />
        )}
      </Screen>
    );
  }

  const tr = occurrence.treatment;
  const existing = view.event?.kind === 'taken' ? view.event : null;

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(isAppError(e) ? e.message : 'No se ha podido guardar. Inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const record = (kind: 'taken' | 'skipped', takenAt?: string, note?: string) =>
    run(async () => {
      voice.stop();
      const event = await MedicationPlanService.recordDose({
        treatmentId: tr.id,
        occurrenceDate: d,
        scheduledTime: h,
        kind,
        takenAt: takenAt ?? null,
        source: isPast ? 'late' : 'reminder',
        note: note ?? null,
      });
      setRecorded(event);
      await PillReminders.resolved(tr.id, d, h).catch(() => undefined);
      setPhase(kind === 'skipped' ? 'skipped' : 'done');
    });

  const onTaken = () => {
    if (existing) {
      setPhase('duplicate');
      return;
    }
    // A posteriori (otro día): la hora declarada es la prevista; se puede cambiar después.
    void record('taken', isPast ? occurrence.at.toISOString() : undefined);
  };

  const onSnooze = () =>
    run(async () => {
      voice.stop();
      const minutes = settings?.snoozeMinutes ?? 10;
      const until = await PillReminders.snooze(tr.id, d, h, minutes);
      await MedicationPlanService.logReminder({ treatmentId: tr.id, occurrenceDate: d, scheduledTime: h, state: 'snoozed' });
      setMessage(
        remindersSupported
          ? `De acuerdo. Te lo recordaremos a las ${clock(until.toISOString())}.`
          : `De acuerdo. En el móvil te lo recordaríamos a las ${clock(until.toISOString())} (en esta vista previa no suenan avisos).`,
      );
      setPhase('snoozed');
    });

  const onNotYet = () =>
    run(async () => {
      voice.stop();
      await MedicationPlanService.logReminder({ treatmentId: tr.id, occurrenceDate: d, scheduledTime: h, state: 'not_yet' });
      const repeat = settings?.repeatAfterMinutes ?? 0;
      const repeatAt = new Date(occurrence.at.getTime() + repeat * 60_000);
      setMessage(
        repeat > 0 && repeatAt.getTime() > Date.now()
          ? `De acuerdo. Te lo volveremos a recordar a las ${clock(repeatAt.toISOString())}. Cuando te la tomes, confírmalo aquí.`
          : 'De acuerdo. Cuando te la tomes, confírmalo aquí o en «Mis pastillas».',
      );
      setPhase('notyet');
    });

  const retime = (minutesAgo: number | 'scheduled') =>
    run(async () => {
      const target = recorded ?? existing;
      if (!target) return;
      const when = minutesAgo === 'scheduled' ? occurrence.at : new Date(Date.now() - minutesAgo * 60_000);
      await MedicationPlanService.correctDose({ eventId: target.id, action: 'change_time', newTakenAt: when.toISOString(), reason: 'La persona indicó otra hora de la toma' });
      const fresh = MedicationPlanService.getState()?.events.find((e) => e.correctsEventId === target.id) ?? null;
      setRecorded(fresh);
      setPhase('done');
    });

  // Lo registrado, tal como está ahora (pasa de «guardado en el móvil» a sincronizado sin salir de la pantalla).
  const live = recorded ? state?.events.find((e) => e.id === recorded.id) ?? recorded : null;
  const shown = live && live.status === 'active' ? live : existing;

  return (
    <Screen header={header} testID="pill-reminder-screen">
      <View style={{ gap: theme.spacing.md }}>
        {testMode ? (
          <InfoBanner
            tone="info"
            icon="notifications-outline"
            title="Aviso de prueba"
            message="Así suena y se ve el aviso a la hora de cada toma. En tu móvil llega también con la app cerrada."
            testID="pill-reminder-test"
          />
        ) : null}
        <View style={styles.center}>
          <View style={[styles.bell, { backgroundColor: view.status === 'taken' ? c.successSoft : c.primaryTint }]}>
            <Icon name={view.status === 'taken' ? 'checkmark-circle' : 'alarm'} size={40} color={view.status === 'taken' ? c.successStrong : c.primary} />
          </View>
          <AppText variant="small" color="textSecondary" style={styles.upper}>
            {dayTitle(d, today)}
          </AppText>
          <AppText variant="display" color="heading" accessibilityRole="header" testID="pill-reminder-time">
            {h}
          </AppText>
          <AppText variant="heading" color="heading" align="center">
            {phase === 'done' || view.status === 'taken' ? 'Toma confirmada' : isFuture || notDueYet ? 'Toma programada' : isPast ? 'Toma sin confirmar' : 'Es la hora de tu medicamento'}
          </AppText>
        </View>

        <Card>
          <View style={styles.medRow}>
            <PillPhoto treatment={tr} width={104} height={84} />
            <View style={styles.flex}>
              <AppText variant="heading" color="heading">
                {medicineLabel(tr)}
              </AppText>
              <AppText variant="bodyStrong" color="text">
                {formatDose(tr.doseAmount, tr.doseUnit)}
              </AppText>
              {tr.instructions ? (
                <AppText variant="caption" color="textSecondary">
                  {tr.instructions}
                </AppText>
              ) : null}
            </View>
          </View>
          <View style={{ marginTop: theme.spacing.sm }}>
            <StatusPill view={view} testID="pill-reminder-status" />
          </View>
        </Card>

        {error ? <InfoBanner tone="danger" message={error} testID="pill-reminder-error" /> : null}

        {phase === 'done' && shown ? (
          <Card tone="success" testID="pill-reminder-done">
            <AppText variant="bodyStrong" color="heading">
              {`${medicineLabel(tr)} — ${formatDose(shown.doseAmount, shown.doseUnit)} — toma confirmada a las ${clock(shown.takenAt)}.`}
            </AppText>
            {shown.kind === 'extra' ? (
              <AppText variant="caption" color="dangerText" style={{ marginTop: 4 }}>
                Se ha guardado como toma adicional. Coméntalo con tu médico o farmacéutico, sobre todo si notas algo raro.
              </AppText>
            ) : null}
            {isLateEntry(shown) ? (
              <AppText variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
                {`Registrada a posteriori (anotada a las ${clock(shown.clientRecordedAt)}).`}
              </AppText>
            ) : null}
            {shown.pending ? (
              <AppText variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
                Guardada en este móvil: se enviará en cuanto haya conexión.
              </AppText>
            ) : null}
          </Card>
        ) : null}

        {phase === 'retime' ? (
          <Card testID="pill-reminder-retime">
            <AppText variant="bodyStrong" color="heading">
              ¿A qué hora te la tomaste?
            </AppText>
            <AppText variant="caption" color="textSecondary">
              Se corrige el registro y se guarda la corrección (nunca se borra el original).
            </AppText>
            <View style={styles.chips}>
              <Chip label={`A las ${h} (la prevista)`} onPress={() => void retime('scheduled')} />
              <Chip label="Hace 15 minutos" onPress={() => void retime(15)} />
              <Chip label="Hace 30 minutos" onPress={() => void retime(30)} />
              <Chip label="Hace 1 hora" onPress={() => void retime(60)} />
            </View>
            <TextButton label="Cancelar" onPress={() => setPhase('done')} />
          </Card>
        ) : null}

        {phase === 'duplicate' && existing ? (
          <Card tone="warning" testID="pill-reminder-duplicate">
            <AppText variant="bodyStrong" color="heading">
              {duplicateWarning(existing, ZONE)}
            </AppText>
            <AppText variant="body" color="text" style={{ marginTop: 4 }}>
              No tomes otra dosis por si acaso. Regístrala solo si de verdad te la has vuelto a tomar: quedará anotada como
              toma adicional para que lo valore tu médico o farmacéutico.
            </AppText>
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <PrimaryButton label="No, me había equivocado" icon="arrow-undo" onPress={() => setPhase('ask')} testID="pill-reminder-duplicate-cancel" />
              <SecondaryButton
                label="Sí, me he tomado otra dosis"
                icon="alert-circle-outline"
                onPress={() => void record('taken', undefined, 'La persona indica que tomó otra dosis')}
                testID="pill-reminder-duplicate-confirm"
              />
            </View>
          </Card>
        ) : null}

        {phase === 'skip' ? (
          <Card tone="warning" testID="pill-reminder-skip">
            <AppText variant="bodyStrong" color="heading">
              ¿Anotamos que hoy no te la vas a tomar?
            </AppText>
            <AppText variant="caption" color="textSecondary">
              Si no sabes qué hacer al saltarte una toma, consulta con tu médico o farmacéutico.
            </AppText>
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <PrimaryButton label="Sí, anotar como no tomada" tone="danger" icon="close-circle" onPress={() => void record('skipped', undefined, 'La persona indica que no la toma')} testID="pill-reminder-skip-confirm" />
              <TextButton label="Volver" onPress={() => setPhase('ask')} />
            </View>
          </Card>
        ) : null}

        {(phase === 'snoozed' || phase === 'notyet') && message ? <InfoBanner tone="info" icon="alarm-outline" message={message} testID="pill-reminder-message" /> : null}
        {phase === 'skipped' ? (
          <InfoBanner tone="warning" message="Anotada como no tomada. Si tienes dudas sobre la siguiente toma, consulta con tu farmacéutico." testID="pill-reminder-skipped" />
        ) : null}

        {isFuture ? (
          <InfoBanner tone="info" message="Esta toma todavía no ha llegado. Te avisaremos a su hora." />
        ) : phase === 'ask' && notDueYet && view.status !== 'taken' && view.status !== 'skipped' ? (
          <View style={{ gap: theme.spacing.sm }}>
            <InfoBanner tone="info" icon="time-outline" message={`Todavía no es la hora (${h}). Te avisaremos entonces. Si ya te la has tomado, puedes anotarlo ahora.`} testID="pill-reminder-notdue" />
            <PrimaryButton label="Ya me la he tomado" icon="checkmark-circle" tone="success" onPress={onTaken} loading={busy} testID="pill-reminder-taken" />
            <SecondaryButton label="Volver a Mis pastillas" icon="list" onPress={() => router.replace('/pills')} />
          </View>
        ) : phase === 'ask' && view.status !== 'taken' && view.status !== 'skipped' ? (
          <View style={{ gap: theme.spacing.sm }}>
            <PrimaryButton label={isPast ? 'Sí, la tomé' : 'Sí, ya la he tomado'} icon="checkmark-circle" tone="success" onPress={onTaken} loading={busy} testID="pill-reminder-taken" />
            {!isPast ? <SecondaryButton label="Recordármelo después" icon="alarm-outline" onPress={() => void onSnooze()} disabled={busy} testID="pill-reminder-snooze" /> : null}
            {!isPast ? <SecondaryButton label="Todavía no la he tomado" icon="hourglass-outline" onPress={() => void onNotYet()} disabled={busy} testID="pill-reminder-notyet" /> : null}
            <TextButton label="No me la voy a tomar" tone="muted" onPress={() => setPhase('skip')} />
          </View>
        ) : null}

        {(phase === 'ask' && view.status === 'taken') || phase === 'done' ? (
          <View style={{ gap: theme.spacing.sm }}>
            {phase === 'ask' && existing ? (
              <InfoBanner
                tone="success"
                message={`Ya figura confirmada a las ${clock(existing.takenAt)}${existing.recordedByRole === 'caregiver' ? ` por ${existing.recordedByName ?? 'tu cuidador/a'}` : ''}.`}
              />
            ) : null}
            <PrimaryButton label="Volver a Mis pastillas" icon="list" onPress={() => router.replace('/pills')} testID="pill-reminder-back" />
            <SecondaryButton label="Me la tomé a otra hora" icon="time-outline" onPress={() => setPhase('retime')} testID="pill-reminder-retime-open" />
            {phase === 'ask' ? <TextButton label="He tomado otra dosis" tone="muted" onPress={() => setPhase('duplicate')} /> : null}
          </View>
        ) : null}

        {phase === 'snoozed' || phase === 'notyet' || phase === 'skipped' || (phase === 'ask' && view.status === 'skipped') ? (
          <PrimaryButton label="Volver a Mis pastillas" icon="list" onPress={() => router.replace('/pills')} testID="pill-reminder-back" />
        ) : null}
      </View>
    </Screen>
  );
}

export default withPremium(DoseReminderScreen, 'pills');

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', gap: 2 },
  bell: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.6 },
  medRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
});
