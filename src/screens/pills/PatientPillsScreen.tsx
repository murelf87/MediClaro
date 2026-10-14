/**
 * /pills/patient?id=<paciente>&name=<nombre> — vista AUTORIZADA del cuidador/a: el calendario de tomas del familiar,
 * las pendientes y confirmadas, las incidencias y, si el paciente lo permite, «Confirmar que la ha tomado» (queda
 * anotado quién confirmó). Solo con permiso del paciente (lo comprueba el servidor) y siempre con conexión: nada de la
 * medicación del familiar se guarda en este teléfono.
 */
import { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, AppText, Card, EmptyState, InfoBanner, PrimaryButton, Screen, SkeletonList, TextButton } from '../../components';
import { useAppTheme } from '../../hooks';
import { useNow, usePatientPlan } from '../../hooks/usePillPlan';
import { MedicationPlanService, isAppError } from '../../services';
import { addDays, doseLabel, doseViews, occurrencesForDate, zoneFor, type DoseView } from '../../domain/medication';
import { DoseRow, Legend, WeekStrip, dayTitle } from './parts';

function param(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default function PatientPillsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ id?: string; name?: string }>();
  const patientId = param(params.id);
  const name = param(params.name) || 'tu familiar';
  const { plan, loading, error, reload } = usePatientPlan(patientId || null);
  const now = useNow();
  const zone = useMemo(() => zoneFor(plan?.treatments.find((t) => t.active)?.timezone), [plan]);
  const today = zone.parts(now).date;
  const [selected, setSelected] = useState(today);
  const [confirming, setConfirming] = useState<DoseView | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  const treatments = useMemo(() => (plan?.treatments ?? []).filter((t) => t.active), [plan]);
  const viewsFor = (date: string) => doseViews(occurrencesForDate(treatments, date, zone), plan?.events ?? [], now);
  const days = [-3, -2, -1, 0, 1, 2, 3].map((d) => addDays(today, d));
  const dots = Object.fromEntries(days.map((d) => [d, viewsFor(d).map((v) => v.color)]));
  const views = viewsFor(selected);
  const incidents = days.filter((d) => d <= today).flatMap(viewsFor).filter((v) => v.incident);
  const canConfirm = plan?.access === 'confirm';

  const confirm = async (v: DoseView) => {
    setBusy(true);
    setNotice(null);
    try {
      const r = await MedicationPlanService.recordDoseForPatient({
        treatmentId: v.occurrence.treatmentId,
        occurrenceDate: v.occurrence.date,
        scheduledTime: v.occurrence.time,
        kind: 'taken',
        source: 'app',
      });
      setNotice(
        r.possibleDuplicate
          ? 'Esa toma ya figuraba confirmada: se ha guardado como toma adicional. Coméntalo con su médico o farmacéutico.'
          : `Anotado: ${name.split(' ')[0]} ha tomado ${doseLabel(v.occurrence.treatment)}. Consta que lo confirmaste tú.`,
      );
      setConfirming(null);
      await reload();
    } catch (e) {
      setNotice(isAppError(e) ? e.message : 'No se ha podido guardar. Comprueba la conexión.');
    } finally {
      setBusy(false);
    }
  };

  const header = <AppHeader title={`Pastillas de ${name.split(' ')[0]}`} fallbackHref="/caregiver" />;

  if (loading && !plan) {
    return (
      <Screen header={header} testID="patient-pills-screen">
        <SkeletonList rows={4} />
      </Screen>
    );
  }
  if (error && !plan) {
    return (
      <Screen header={header} testID="patient-pills-screen">
        <EmptyState
          icon="lock-closed-outline"
          title={error.kind === 'permission_denied' ? `${name.split(' ')[0]} no ha compartido su medicación` : 'No se ha podido cargar'}
          message={error.kind === 'permission_denied' ? 'Solo el paciente decide si su cuidador/a puede ver sus tomas (en su app: Mis pastillas › Avisos › Tu cuidador/a).' : error.message}
          action={{ label: 'Reintentar', onPress: () => void reload() }}
        />
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      testID="patient-pills-screen"
      refreshControl={
        <RefreshControl
          refreshing={pulling}
          onRefresh={() => {
            setPulling(true);
            void reload().finally(() => setPulling(false));
          }}
        />
      }
    >
      <View style={{ gap: theme.spacing.md }}>
        <InfoBanner
          tone="info"
          icon="shield-checkmark-outline"
          message={canConfirm ? `${name.split(' ')[0]} te permite ver sus tomas y anotarlas cuando le ayudes. Cada toma que anotes queda registrada con tu nombre.` : `${name.split(' ')[0]} te permite ver sus tomas.`}
        />
        {notice ? <InfoBanner tone="success" message={notice} testID="patient-pills-notice" /> : null}
        {incidents.length ? (
          <Card tone="danger" testID="patient-pills-incidents">
            <AppText variant="bodyStrong" color="heading">
              {`${incidents.length} toma${incidents.length === 1 ? '' : 's'} requiere${incidents.length === 1 ? '' : 'n'} atención esta semana`}
            </AppText>
            {incidents.slice(-3).map((v) => (
              <AppText key={v.occurrence.key} variant="caption" color="textSecondary">
                {`${dayTitle(v.occurrence.date, today)} ${v.occurrence.time} · ${doseLabel(v.occurrence.treatment)} · ${v.extras.length ? 'posible toma doble' : v.status === 'skipped' ? 'no tomada' : 'sin confirmar'}`}
              </AppText>
            ))}
          </Card>
        ) : null}

        {treatments.length === 0 ? (
          <EmptyState icon="medkit-outline" title="Todavía no hay pauta" message={`${name.split(' ')[0]} aún no ha añadido medicamentos en «Mis pastillas».`} />
        ) : (
          <>
            <WeekStrip days={days} selected={selected} today={today} onSelect={setSelected} dots={dots} />
            <Legend />
            <AppText variant="subheading" color="heading" accessibilityRole="header">
              {dayTitle(selected, today)}
            </AppText>
            {views.length === 0 ? (
              <AppText variant="body" color="textSecondary">
                No hay tomas programadas este día.
              </AppText>
            ) : (
              views.map((v) => (
                <View key={v.occurrence.key} style={{ gap: theme.spacing.xs }}>
                  <DoseRow view={v} testID={`patient-dose-${v.occurrence.time}`} />
                  {canConfirm && selected === today && (v.status === 'pending' || v.status === 'unconfirmed' || v.status === 'later') ? (
                    confirming?.occurrence.key === v.occurrence.key ? (
                      <Card tone="warning">
                        <AppText variant="body" color="text">
                          {`¿Confirmas que ${name.split(' ')[0]} ha tomado ${doseLabel(v.occurrence.treatment)}? Hazlo solo si lo sabes con seguridad.`}
                        </AppText>
                        <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.sm }}>
                          <PrimaryButton label="Sí, la ha tomado" tone="success" icon="checkmark-circle" loading={busy} onPress={() => void confirm(v)} testID="patient-confirm-yes" />
                          <TextButton label="Cancelar" onPress={() => setConfirming(null)} />
                        </View>
                      </Card>
                    ) : (
                      <TextButton label="Confirmar que la ha tomado" icon="checkmark-done-outline" onPress={() => setConfirming(v)} testID={`patient-confirm-${v.occurrence.time}`} />
                    )
                  ) : null}
                </View>
              ))
            )}
          </>
        )}
        <TextButton label="Volver a Mi cuidador/a" icon="people-outline" onPress={() => router.replace('/caregiver')} />
        <AppText variant="small" color="textMuted" align="center" style={styles.thin}>
          Si una toma no está confirmada, eso no significa que no se haya tomado. Ante cualquier duda, habla con su médico o farmacéutico.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  thin: { fontWeight: '400' },
});
