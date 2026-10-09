/**
 * /pills/history — «Historial de tomas»: hoy, ayer, esta semana, este mes o unas fechas a elegir. Para cada toma:
 * fecha, hora programada, hora confirmada, medicamento, cantidad y estado (confirmada por la persona o por su
 * cuidador/a, pendiente, sin confirmar, no tomada, toma adicional, registro corregido).
 *
 * Corregir: un registro confirmado por error se ANULA con su motivo o se corrige la hora; el original nunca se borra
 * y se muestra tachado con el motivo (trazabilidad). Una toma olvidada se puede registrar a posteriori: se guardan la
 * hora declarada y la hora en que se anotó.
 */
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader, AppText, Card, Chip, EmptyState, Icon, InfoBanner, PrimaryButton, Screen, SecondaryButton, TextButton, TextField } from '../../components';
import { useAppTheme } from '../../hooks';
import { useNow, usePillPlan } from '../../hooks/usePillPlan';
import { MedicationPlanService, PillReminders, isAppError } from '../../services';
import {
  addDays,
  doseViews,
  formatDose,
  isLateEntry,
  isoWeekday,
  medicineLabel,
  occurrenceKey,
  occurrencesForDate,
  type DoseEvent,
  type DoseView,
} from '../../domain/medication';
import { withPremium } from '../premium/PremiumGate';
import { shareOrDownloadText } from '../../utils/device';
import { showAlert } from '../../utils/dialogs';
import { StatusPill, ZONE, clock, dayTitle, todayDate, useDoseColors } from './parts';

type Range = 'today' | 'yesterday' | 'week' | 'month' | 'custom';

interface Entry {
  key: string;
  date: string;
  time: string | null;
  view: DoseView | null;
  /** Registro suelto: toma fuera de pauta o registro anulado por una corrección. */
  event: DoseEvent | null;
}

function rangeOf(range: Range, today: string, from: string, to: string): [string, string] {
  switch (range) {
    case 'today':
      return [today, today];
    case 'yesterday':
      return [addDays(today, -1), addDays(today, -1)];
    case 'week':
      return [addDays(today, -(isoWeekday(today) - 1)), today];
    case 'month':
      return [`${today.slice(0, 8)}01`, today];
    case 'custom':
      return from <= to ? [from, to] : [to, from];
  }
}

function DoseHistoryScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { state } = usePillPlan();
  const now = useNow();
  const today = todayDate(now);
  const [range, setRange] = useState<Range>('week');
  const [from, setFrom] = useState(addDays(today, -13));
  const [to, setTo] = useState(today);
  const [detail, setDetail] = useState<Entry | null>(null);

  const [start, end] = rangeOf(range, today, from, to);
  const entries = useMemo(() => {
    if (!state) return [] as Array<{ date: string; items: Entry[] }>;
    const treatments = state.treatments;
    const groups: Array<{ date: string; items: Entry[] }> = [];
    for (let date = end; date >= start; date = addDays(date, -1)) {
      const views = doseViews(occurrencesForDate(treatments, date, ZONE), state.events, now).filter((v) => v.occurrence.at.getTime() <= now.getTime() + 12 * 3_600_000);
      const shown = new Set<string>();
      const items: Entry[] = views.map((v) => {
        if (v.event) shown.add(v.event.id);
        v.extras.forEach((x) => shown.add(x.id));
        return { key: v.occurrence.key, date, time: v.occurrence.time, view: v, event: null };
      });
      // Registros sueltos de ese día: anulados (correcciones) y tomas que ya no encajan en la pauta actual.
      for (const e of state.events) {
        const day = e.occurrenceDate ?? (e.takenAt ? ZONE.parts(new Date(e.takenAt)).date : null);
        if (day !== date || shown.has(e.id)) continue;
        if (e.status === 'active' && e.occurrenceDate && e.scheduledTime && views.some((v) => v.occurrence.key === occurrenceKey(e.treatmentId, e.occurrenceDate!, e.scheduledTime!))) continue;
        items.push({ key: `e-${e.id}`, date, time: e.scheduledTime, view: null, event: e });
      }
      items.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
      if (items.length) groups.push({ date, items });
    }
    return groups;
  }, [state, start, end, now]);

  const allViews = entries.flatMap((g) => g.items.map((i) => i.view).filter((v): v is DoseView => !!v)).filter((v) => v.status !== 'later');
  const confirmed = allViews.filter((v) => v.status === 'taken').length;
  const incidents = allViews.filter((v) => v.incident).length;

  const share = async () => {
    if (!state) return;
    const lines = ['Fecha;Hora programada;Medicamento;Cantidad;Estado;Hora de la toma;Anotada;Quién'];
    for (const g of [...entries].reverse()) {
      for (const it of g.items) {
        const e = it.view?.event ?? it.event;
        const t = it.view?.occurrence.treatment;
        const name = t ? medicineLabel(t) : e?.medicineName ?? '';
        const qty = t ? formatDose(t.doseAmount, t.doseUnit) : e ? formatDose(e.doseAmount, e.doseUnit) : '';
        const status = it.view ? it.view.status : e?.status === 'voided' ? `anulado (${e.voidReason ?? ''})` : e?.kind ?? '';
        lines.push([g.date, it.time ?? '', name, qty, status, clock(e?.takenAt), clock(e?.clientRecordedAt), e ? (e.recordedByRole === 'caregiver' ? e.recordedByName ?? 'cuidador/a' : 'yo') : ''].join(';'));
      }
    }
    if (Platform.OS === 'web') {
      // En el navegador no hay hoja de compartir: se descarga como tabla (se abre con Excel o Números).
      try {
        const ok = await shareOrDownloadText(`historial-tomas-${start}-a-${end}.csv`, `\uFEFF${lines.join('\r\n')}`, 'text/csv');
        if (!ok) await showAlert('No se ha guardado el archivo', 'No se ha descargado tu historial. Puedes intentarlo de nuevo cuando quieras.');
      } catch (e) {
        await showAlert('No se ha podido descargar', e instanceof Error ? e.message : 'Inténtalo de nuevo más tarde.');
      }
      return;
    }
    await Share.share({ title: 'Mi historial de tomas', message: `Historial de tomas (MediClaro) del ${start} al ${end}\n\n${lines.join('\n')}` }).catch(() => undefined);
  };

  return (
    <Screen header={<AppHeader title="Historial de tomas" fallbackHref="/pills" />} testID="pills-history-screen">
      <View style={{ gap: theme.spacing.md }}>
        <View style={styles.chips} accessibilityRole="tablist">
          {([['today', 'Hoy'], ['yesterday', 'Ayer'], ['week', 'Esta semana'], ['month', 'Este mes'], ['custom', 'Elegir fechas']] as Array<[Range, string]>).map(([value, label]) => (
            <Chip key={value} label={label} selected={range === value} onPress={() => setRange(value)} />
          ))}
        </View>
        {range === 'custom' ? (
          <Card testID="pills-history-custom">
            {([['Desde', from, setFrom], ['Hasta', to, setTo]] as Array<[string, string, (v: string) => void]>).map(([label, value, set]) => (
              <View key={label} style={styles.dateRow}>
                <AppText variant="bodyStrong" color="heading" style={styles.dateLabel}>
                  {label}
                </AppText>
                <TextButton label="−" onPress={() => set(addDays(value, -1))} />
                <AppText variant="body" color="text" style={styles.flex} align="center">
                  {dayTitle(value, today)}
                </AppText>
                <TextButton label="+" onPress={() => set(value >= today ? today : addDays(value, 1))} />
              </View>
            ))}
          </Card>
        ) : null}

        {allViews.length ? (
          <Card tone={incidents ? 'warning' : 'success'} testID="pills-history-summary">
            <AppText variant="bodyStrong" color="heading">
              {`${confirmed} de ${allViews.length} toma${allViews.length === 1 ? '' : 's'} confirmada${allViews.length === 1 ? '' : 's'}`}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {incidents ? `${incidents} requiere${incidents === 1 ? '' : 'n'} atención (sin confirmar, no tomadas o posibles tomas dobles).` : 'Sin incidencias en estas fechas.'}
            </AppText>
          </Card>
        ) : null}

        {entries.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No hay tomas en estas fechas" message="Elige otras fechas o añade tu pauta en «Mis pastillas»." action={{ label: 'Ir a Mis pastillas', onPress: () => router.replace('/pills') }} />
        ) : (
          entries.map((g) => (
            <View key={g.date} style={{ gap: theme.spacing.xs }}>
              <AppText variant="subheading" color="heading" accessibilityRole="header">
                {dayTitle(g.date, today)}
              </AppText>
              {g.items.map((it) => (
                <HistoryRow key={it.key} entry={it} onPress={() => setDetail(it)} />
              ))}
            </View>
          ))
        )}

        <SecondaryButton
          label={Platform.OS === 'web' ? 'Descargar mi historial' : 'Compartir mi historial'}
          icon={Platform.OS === 'web' ? 'download-outline' : 'share-outline'}
          onPress={() => void share()}
          testID="pills-history-share"
        />
        <AppText variant="small" color="textMuted" align="center" style={styles.thin}>
          Puedes enseñárselo a tu médico o farmacéutico. Los registros corregidos se conservan, tachados, con su motivo.
        </AppText>
      </View>
      <DetailSheet entry={detail} today={today} onClose={() => setDetail(null)} />
    </Screen>
  );
}

function HistoryRow({ entry, onPress }: { entry: Entry; onPress: () => void }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const palette = useDoseColors();
  const v = entry.view;
  const e = v?.event ?? entry.event;
  const voided = !v && entry.event?.status === 'voided';
  const name = v ? medicineLabel(v.occurrence.treatment) : entry.event?.medicineName ?? '';
  const qty = v ? formatDose(v.occurrence.treatment.doseAmount, v.occurrence.treatment.doseUnit) : e ? formatDose(e.doseAmount, e.doseUnit) : '';
  const color = v ? palette[v.color].solid : voided ? c.textMuted : palette.red.solid;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { borderColor: c.border, borderLeftColor: color, backgroundColor: pressed ? c.primaryTint : c.surface, borderRadius: theme.radius.md, opacity: voided ? 0.75 : 1 }]}
      testID={`pills-history-row-${entry.key}`}
    >
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color={voided ? 'textMuted' : 'heading'} style={voided ? styles.strike : null}>
          {name}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {`${entry.time ? `Programada ${entry.time}` : 'Fuera de pauta'} · ${qty}${e?.takenAt ? ` · Tomada ${clock(e.takenAt)}` : ''}`}
        </AppText>
        {voided ? (
          <AppText variant="caption" color="textSecondary">{`Registro corregido: ${entry.event?.voidReason ?? ''}`}</AppText>
        ) : v ? (
          <View style={{ marginTop: 4, gap: 4 }}>
            <StatusPill view={v} />
            {v.corrected ? (
              <AppText variant="small" color="textSecondary">
                Registro corregido (ver detalle)
              </AppText>
            ) : null}
          </View>
        ) : (
          <AppText variant="caption" color="dangerText">
            {entry.event?.kind === 'extra' ? 'Toma adicional' : 'Toma registrada'}
          </AppText>
        )}
      </View>
      <Icon name="chevron-forward" size={20} color={c.textMuted} />
    </Pressable>
  );
}

const REASONS = ['Me equivoqué al confirmarla', 'No me la llegué a tomar', 'Confirmé la de otro medicamento'];

function DetailSheet({ entry, today, onClose }: { entry: Entry | null; today: string; onClose: () => void }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'view' | 'void' | 'retime' | 'late'>('view');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(0);
  if (!entry) return null;
  const v = entry.view;
  const e = v?.event ?? v?.extras[0] ?? entry.event;
  const t = v?.occurrence.treatment;
  const close = () => {
    setMode('view');
    setReason('');
    setError(null);
    setMinutes(0);
    onClose();
  };
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      close();
    } catch (err) {
      setError(isAppError(err) ? err.message : 'No se ha podido guardar.');
    } finally {
      setBusy(false);
    }
  };
  const scheduledAt = entry.time ? ZONE.instant(entry.date, entry.time) : null;
  const pickedTime = scheduledAt ? new Date(scheduledAt.getTime() + minutes * 60_000) : null;
  const canFix = !!e && e.status === 'active' && (e.recordedByRole === 'patient' || e.recordedByRole === 'caregiver');
  const canLate = !!v && !v.event && v.status !== 'later' && entry.date >= addDays(today, -7);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={close} accessibilityLabel="Cerrar" />
      <View style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: Math.max(insets.bottom, 16) }]} testID="pills-history-detail">
        <ScrollView contentContainerStyle={{ gap: theme.spacing.sm, padding: theme.spacing.md }}>
          <View style={styles.sheetHead}>
            <AppText variant="heading" color="heading" style={styles.flex}>
              {t ? medicineLabel(t) : e?.medicineName ?? 'Toma'}
            </AppText>
            <TextButton label="Cerrar" onPress={close} />
          </View>
          <Line label="Día" value={dayTitle(entry.date, today)} />
          {entry.time ? <Line label="Hora programada" value={entry.time} /> : null}
          {t ? <Line label="Cantidad" value={formatDose(t.doseAmount, t.doseUnit)} /> : e ? <Line label="Cantidad" value={formatDose(e.doseAmount, e.doseUnit)} /> : null}
          {v ? <StatusPill view={v} /> : null}
          {e ? (
            <>
              {e.takenAt ? <Line label="Hora de la toma (declarada)" value={clock(e.takenAt)} /> : null}
              <Line label="Anotada a las" value={`${clock(e.clientRecordedAt)}${isLateEntry(e) ? ' (a posteriori)' : ''}`} />
              <Line label="Confirmada por" value={e.recordedByRole === 'caregiver' ? `${e.recordedByName ?? 'Tu cuidador/a'} (cuidador/a)` : 'Ti'} />
              {e.kind === 'extra' ? <InfoBanner tone="danger" message="Toma adicional: figuraba otra toma confirmada. Coméntalo con tu médico o farmacéutico." /> : null}
              {e.status === 'voided' ? <InfoBanner tone="neutral" message={`Registro anulado. Motivo: ${e.voidReason ?? '—'}`} /> : null}
              {e.note ? <Line label="Nota" value={e.note} /> : null}
              {e.pending ? <AppText variant="caption" color="textSecondary">Guardado en este móvil: se enviará al haber conexión.</AppText> : null}
            </>
          ) : null}
          {error ? <InfoBanner tone="danger" message={error} /> : null}

          {mode === 'view' ? (
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              {canFix ? <SecondaryButton label="Corregir: no me la tomé" icon="close-circle-outline" onPress={() => setMode('void')} testID="pills-history-void" /> : null}
              {canFix && e?.kind !== 'skipped' ? <SecondaryButton label="Corregir la hora" icon="time-outline" onPress={() => setMode('retime')} testID="pills-history-retime" /> : null}
              {canLate ? (
                <>
                  <PrimaryButton label="Registrar que la tomé" icon="checkmark-circle" tone="success" onPress={() => setMode('late')} testID="pills-history-late" />
                  <SecondaryButton
                    label="Anotar que no la tomé"
                    icon="close-circle-outline"
                    onPress={() =>
                      void run(async () => {
                        await MedicationPlanService.recordDose({ treatmentId: v!.occurrence.treatmentId, occurrenceDate: entry.date, scheduledTime: entry.time, kind: 'skipped', source: 'late' });
                        await PillReminders.resolved(v!.occurrence.treatmentId, entry.date, entry.time!).catch(() => undefined);
                      })
                    }
                  />
                </>
              ) : null}
            </View>
          ) : null}

          {mode === 'void' || mode === 'retime' ? (
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <AppText variant="bodyStrong" color="heading">
                {mode === 'void' ? '¿Por qué lo corriges?' : '¿A qué hora te la tomaste?'}
              </AppText>
              {mode === 'retime' && pickedTime ? (
                <View style={styles.dateRow}>
                  <TextButton label="−15 min" onPress={() => setMinutes(minutes - 15)} />
                  <AppText variant="heading" color="heading" style={styles.flex} align="center">
                    {clock(pickedTime.toISOString())}
                  </AppText>
                  <TextButton label="+15 min" onPress={() => setMinutes(minutes + 15)} />
                </View>
              ) : null}
              <View style={styles.chips}>
                {(mode === 'void' ? REASONS : ['Me la tomé a otra hora']).map((r) => (
                  <Chip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
                ))}
              </View>
              <TextField label="Motivo" value={reason} onChangeText={setReason} maxLength={300} testID="pills-history-reason" />
              <PrimaryButton
                label="Guardar la corrección"
                icon="checkmark"
                loading={busy}
                onPress={() =>
                  void run(async () => {
                    await MedicationPlanService.correctDose({
                      eventId: e!.id,
                      action: mode === 'void' ? 'void' : 'change_time',
                      newTakenAt: mode === 'retime' && pickedTime ? pickedTime.toISOString() : null,
                      reason: reason || (mode === 'retime' ? 'Me la tomé a otra hora' : ''),
                    });
                  })
                }
                testID="pills-history-save-fix"
              />
              <TextButton label="Cancelar" onPress={() => setMode('view')} />
            </View>
          ) : null}

          {mode === 'late' && pickedTime ? (
            <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
              <AppText variant="bodyStrong" color="heading">
                ¿A qué hora te la tomaste?
              </AppText>
              <View style={styles.dateRow}>
                <TextButton label="−15 min" onPress={() => setMinutes(minutes - 15)} />
                <AppText variant="heading" color="heading" style={styles.flex} align="center">
                  {clock(pickedTime.toISOString())}
                </AppText>
                <TextButton label="+15 min" onPress={() => setMinutes(Math.min(minutes + 15, Math.floor((Date.now() - scheduledAt!.getTime()) / 60_000)))} />
              </View>
              <AppText variant="caption" color="textSecondary">
                Se guardará la hora que indicas y también la hora a la que lo anotas.
              </AppText>
              <PrimaryButton
                label="Guardar la toma"
                icon="checkmark"
                tone="success"
                loading={busy}
                onPress={() =>
                  void run(async () => {
                    await MedicationPlanService.recordDose({ treatmentId: v!.occurrence.treatmentId, occurrenceDate: entry.date, scheduledTime: entry.time, kind: 'taken', takenAt: pickedTime.toISOString(), source: 'late' });
                    await PillReminders.resolved(v!.occurrence.treatmentId, entry.date, entry.time!).catch(() => undefined);
                  })
                }
                testID="pills-history-save-late"
              />
              <TextButton label="Cancelar" onPress={() => setMode('view')} />
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="caption" color="textSecondary" style={styles.lineLabel}>
        {label}
      </AppText>
      <AppText variant="bodyStrong" color="heading" style={styles.flex}>
        {value}
      </AppText>
    </View>
  );
}

export default withPremium(DoseHistoryScreen, 'pills');

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateLabel: { width: 64 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderLeftWidth: 6 },
  strike: { textDecorationLine: 'line-through' },
  thin: { fontWeight: '400' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  lineLabel: { width: 150 },
});
