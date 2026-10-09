/**
 * /pills — «Mis pastillas»: lo que toca hoy, la próxima toma, el calendario de la semana, el estado de cada toma
 * (verde confirmada · naranja pendiente · gris más tarde · rojo requiere atención), acceso al historial, a los avisos
 * y a MediClaro (el asistente responde con las tomas confirmadas de verdad).
 * Nada se marca como tomado solo: cada toma la confirma la persona (o su cuidador/a autorizado).
 */
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActionRow,
  AppHeader,
  AppText,
  Card,
  EmptyState,
  Icon,
  IconButton,
  InfoBanner,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SkeletonList,
} from '../../components';
import { useAppTheme } from '../../hooks';
import { useNow, usePillPlan } from '../../hooks/usePillPlan';
import {
  MedicationPlanService,
  PillReminders,
  reminderPermission,
  remindersSupported,
  requestReminderPermission,
  type ReminderPermission,
} from '../../services';
import { openAppSettings } from '../../utils/device';
import {
  addDays,
  doseViews,
  formatDose,
  frequencyLabel,
  medicineLabel,
  nextDose,
  normalizeTimes,
  occurrencesForDate,
  type DoseView,
} from '../../domain/medication';
import { withPremium } from '../premium/PremiumGate';
import { DoseRow, Legend, PillPhoto, StatusPill, WeekStrip, ZONE, dayTitle, todayDate } from './parts';

function PillsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const { state, loading, error, refresh } = usePillPlan();
  const now = useNow();
  const today = todayDate(now);
  const [selected, setSelected] = useState(today);
  const [permission, setPermission] = useState<ReminderPermission>(remindersSupported ? 'undetermined' : 'unsupported');
  const [pulling, setPulling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void reminderPermission().then(setPermission).catch(() => undefined);
    }, []),
  );

  const treatments = useMemo(() => (state?.treatments ?? []).filter((t) => t.active), [state?.treatments]);
  const events = state?.events ?? [];
  const viewsFor = useCallback((date: string) => doseViews(occurrencesForDate(treatments, date, ZONE), events, now), [treatments, events, now]);
  const days = useMemo(() => [-3, -2, -1, 0, 1, 2, 3].map((d) => addDays(today, d)), [today]);
  const dots = useMemo(() => Object.fromEntries(days.map((d) => [d, viewsFor(d).map((v) => v.color)])), [days, viewsFor]);
  const todays = useMemo(() => viewsFor(today), [viewsFor, today]);
  const views = selected === today ? todays : viewsFor(selected);
  const next = nextDose(todays);

  const open = (v: DoseView) =>
    router.push({ pathname: '/pills/reminder', params: { t: v.occurrence.treatmentId, d: v.occurrence.date, h: v.occurrence.time } });

  const enableReminders = async () => {
    const result = await requestReminderPermission();
    setPermission(result);
    if (result === 'granted') await PillReminders.reschedule();
  };

  const header = (
    <AppHeader
      title="Mis pastillas"
      right={<IconButton icon="settings-outline" accessibilityLabel="Avisos y ajustes" onPress={() => router.push('/pills/settings')} />}
    />
  );

  if (loading && !state) {
    return (
      <Screen header={header} testID="pills-screen">
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  const confirmedCount = views.filter((v) => v.status === 'taken').length;

  return (
    <Screen
      header={header}
      testID="pills-screen"
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          onRefresh={() => {
            setPulling(true);
            void refresh().finally(() => setPulling(false));
          }}
        />
      }
    >
      <View style={{ gap: theme.spacing.md }}>
        {state?.notice ? (
          <InfoBanner tone="warning" message={state.notice} action={{ label: 'Entendido', onPress: () => MedicationPlanService.clearNotice() }} testID="pills-notice" />
        ) : null}
        {error && !state?.offline ? <InfoBanner tone="danger" message={error.message} action={{ label: 'Reintentar', onPress: () => void refresh() }} /> : null}
        {state?.offline || (state?.pending ?? 0) > 0 ? (
          <InfoBanner
            tone="info"
            icon="cloud-offline-outline"
            title={state?.offline ? 'Sin conexión' : 'Enviando…'}
            message={
              (state?.pending ?? 0) > 0
                ? `Lo que confirmas se guarda en este móvil y se enviará al recuperar la conexión (${state?.pending} pendiente${state?.pending === 1 ? '' : 's'}).`
                : 'Ves lo último guardado en este móvil. Los avisos siguen funcionando.'
            }
            testID="pills-offline"
          />
        ) : null}
        {treatments.length > 0 && permission !== 'granted' ? (
          <InfoBanner
            tone={permission === 'unsupported' ? 'info' : 'warning'}
            icon="notifications-outline"
            title={permission === 'unsupported' ? 'Vista previa' : 'Activa los avisos'}
            message={
              permission === 'unsupported'
                ? 'Aquí el teléfono no avisa. En tu móvil, MediClaro te avisará a la hora de cada toma.'
                : permission === 'denied'
                  ? 'Los avisos están desactivados para MediClaro. Actívalos en los ajustes del teléfono para que te avise a su hora.'
                  : 'Así el teléfono te avisará a la hora de cada toma, también sin internet.'
            }
            action={
              permission === 'unsupported'
                ? { label: 'Ver cómo es el aviso', onPress: () => router.push('/pills/settings') }
                : permission === 'denied'
                  ? { label: 'Abrir ajustes', onPress: () => void openAppSettings() }
                  : { label: 'Activar avisos', onPress: () => void enableReminders() }
            }
            testID="pills-permission"
          />
        ) : null}

        {treatments.length === 0 ? (
          <EmptyState
            icon="medkit-outline"
            title="Añade tu primer medicamento"
            message="Escribe la pauta que te indicó tu médico o farmacéutico y MediClaro te avisará a su hora con alarma y voz. También puedes añadirlo desde la foto de la caja."
            action={{ label: 'Añadir un medicamento', onPress: () => router.push('/pills/edit') }}
          />
        ) : (
          <>
            {next ? (
              <Card style={[styles.hero, { borderColor: next.status === 'pending' ? c.warning : c.primarySoft }]} testID="pills-next">
                <AppText variant="captionStrong" color={next.status === 'pending' ? 'warningText' : 'primary'} style={styles.upper}>
                  {next.status === 'pending' ? 'Ahora toca' : `Próxima toma · ${next.occurrence.time}`}
                </AppText>
                <View style={styles.heroRow}>
                  <PillPhoto treatment={next.occurrence.treatment} width={96} height={78} />
                  <View style={styles.flex}>
                    <AppText variant="heading" color="heading">
                      {medicineLabel(next.occurrence.treatment)}
                    </AppText>
                    <AppText variant="body" color="textSecondary">
                      {`${formatDose(next.occurrence.treatment.doseAmount, next.occurrence.treatment.doseUnit)} a las ${next.occurrence.time}`}
                    </AppText>
                    {next.occurrence.treatment.instructions ? (
                      <AppText variant="caption" color="textSecondary">
                        {next.occurrence.treatment.instructions}
                      </AppText>
                    ) : null}
                  </View>
                </View>
                <StatusPill view={next} />
                <PrimaryButton
                  label={next.status === 'pending' ? 'Registrar esta toma' : 'Ver esta toma'}
                  icon={next.status === 'pending' ? 'checkmark-circle' : 'eye-outline'}
                  tone={next.status === 'pending' ? 'success' : 'primary'}
                  onPress={() => open(next)}
                  testID="pills-next-open"
                />
              </Card>
            ) : (
              <Card tone="success" testID="pills-done">
                <AppText variant="bodyStrong" color="heading">
                  {todays.length ? 'Hoy ya no te quedan tomas' : 'Hoy no tienes tomas programadas'}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {todays.length ? 'Revisa abajo cómo han quedado las de hoy.' : 'Según tu pauta registrada.'}
                </AppText>
              </Card>
            )}

            <View style={{ gap: theme.spacing.sm }}>
              <AppText variant="subheading" color="heading" accessibilityRole="header">
                Calendario
              </AppText>
              <WeekStrip days={days} selected={selected} today={today} onSelect={setSelected} dots={dots} />
              <Legend />
            </View>

            <View style={{ gap: theme.spacing.sm }} testID="pills-day-list">
              <View style={styles.dayHead}>
                <AppText variant="subheading" color="heading" accessibilityRole="header" style={styles.flex}>
                  {dayTitle(selected, today)}
                </AppText>
                {views.length ? (
                  <AppText variant="caption" color="textSecondary">
                    {`${confirmedCount} de ${views.length} confirmada${views.length === 1 ? '' : 's'}`}
                  </AppText>
                ) : null}
              </View>
              {views.length === 0 ? (
                <AppText variant="body" color="textSecondary">
                  No hay tomas programadas este día.
                </AppText>
              ) : (
                views.map((v) => (
                  <DoseRow
                    key={v.occurrence.key}
                    view={v}
                    onPress={v.occurrence.date <= today ? () => open(v) : undefined}
                    testID={`pills-dose-${v.occurrence.time}-${v.occurrence.treatment.name.split(' ')[0]}`}
                  />
                ))
              )}
            </View>
          </>
        )}

        {/* Qué es y qué se puede hacer: siempre a mano (explicado paso a paso con dibujos). */}
        <Card style={styles.howCard} testID="pills-how">
          <View style={styles.heroRow}>
            <View style={[styles.howIcon, { backgroundColor: c.primaryTint }]}>
              <Icon name="help-circle" size={28} color={c.primary} />
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyStrong" color="heading">¿Cómo funciona Mis pastillas?</AppText>
              <AppText variant="caption" color="textSecondary">
                Apuntas tus medicamentos, el móvil te avisa a su hora con alarma y voz, y tú confirmas cada toma. Calendario, historial, aviso a tu cuidador/a y preguntas al asistente.
              </AppText>
            </View>
          </View>
          <SecondaryButton label="Ver cómo funciona, paso a paso" icon="book-outline" variant="outline" size="md" onPress={() => router.push('/pills/help')} testID="pills-how-open" />
        </Card>

        <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          <ActionRow icon="add-circle" label="Añadir un medicamento" sublabel="Con la pauta que te indicó tu médico" tone="primary" onPress={() => router.push('/pills/edit')} testID="pills-add" />
          <ActionRow icon="time" label="Historial de tomas" sublabel="Hoy, ayer, esta semana, este mes…" tone="info" onPress={() => router.push('/pills/history')} testID="pills-history" />
          <ActionRow
            icon="chatbubbles"
            label="Preguntar a MediClaro"
            sublabel="«¿Qué pastillas me quedan hoy?»"
            tone="ai"
            onPress={() => router.push({ pathname: '/assistant', params: { question: '¿Qué pastillas me quedan hoy?' } })}
            testID="pills-ask"
          />
        </View>

        {treatments.length > 0 ? (
          <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
            <AppText variant="subheading" color="heading" accessibilityRole="header">
              Mis tratamientos
            </AppText>
            {treatments.map((t) => (
              <Card key={t.id} padding={theme.spacing.sm}>
                <View style={styles.heroRow}>
                  <PillPhoto treatment={t} width={56} height={46} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" color="heading">
                      {medicineLabel(t)}
                    </AppText>
                    <AppText variant="caption" color="textSecondary">
                      {`${formatDose(t.doseAmount, t.doseUnit)} · ${frequencyLabel(t)} a las ${normalizeTimes(t.times).join(', ')}${t.endDate ? ` · hasta el ${t.endDate.split('-').reverse().join('/')}` : ''}`}
                    </AppText>
                    {!t.remindersEnabled ? (
                      <AppText variant="small" color="textMuted">
                        Sin avisos
                      </AppText>
                    ) : null}
                  </View>
                </View>
                <SecondaryButton label="Cambiar la pauta" icon="create-outline" size="md" onPress={() => router.push({ pathname: '/pills/edit', params: { id: t.id } })} testID={`pills-edit-${t.id}`} />
              </Card>
            ))}
          </View>
        ) : null}

        <AppText variant="small" color="textMuted" align="center" style={styles.disclaimer}>
          MediClaro te ayuda a recordar y registrar tus tomas. No sustituye las indicaciones de tu médico o farmacéutico.
        </AppText>
      </View>
    </Screen>
  );
}

export default withPremium(PillsScreen, 'pills');

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.6 },
  hero: { gap: 10, borderWidth: 2 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  dayHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  howCard: { gap: 10, marginTop: 4 },
  howIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  disclaimer: { fontWeight: '400', marginTop: 16 },
});
