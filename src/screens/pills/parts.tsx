/**
 * «Mis pastillas» — piezas visuales comunes (estilo MediClaro: tarjetas blancas, azul de marca, botones grandes).
 * Colores de cada toma: verde confirmada · naranja pendiente · gris más tarde · rojo incidencia.
 */
import { useCallback, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Icon, MedicationImage, type IconName } from '../../components';
import { useAppTheme } from '../../hooks';
import { MedicationService } from '../../services';
import {
  addDays,
  deviceZone,
  formatDose,
  isoWeekday,
  medicineLabel,
  unitLabel,
  weekdayName,
  type DoseColor,
  type DoseUnit,
  type DoseView,
  type Treatment,
} from '../../domain/medication';

export const ZONE = deviceZone();

/** «15:49» de un instante ISO, en la hora del teléfono. */
export function clock(iso: string | null | undefined): string {
  return iso ? ZONE.parts(new Date(iso)).time : '';
}

export function todayDate(now = new Date()): string {
  return ZONE.parts(now).date;
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «Hoy», «Ayer», «Mañana» o «jueves 8 de octubre». */
export function dayTitle(date: string, today: string): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, -1)) return 'Ayer';
  if (date === addDays(today, 1)) return 'Mañana';
  const [, m, d] = date.split('-').map(Number);
  const name = weekdayName(isoWeekday(date));
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${d} de ${MONTHS[m - 1]}`;
}

export function shortDay(date: string): { week: string; day: string; month: string } {
  const [, m, d] = date.split('-').map(Number);
  return { week: weekdayName(isoWeekday(date)).slice(0, 3), day: String(d), month: MONTHS_SHORT[m - 1] };
}

// ─── Colores y textos del estado ──────────────────────────────────────────────────────────────────────────

export function useDoseColors() {
  const c = useAppTheme().colors;
  return {
    green: { fg: c.successText, bg: c.successSoft, solid: c.successStrong },
    orange: { fg: c.warningText, bg: c.warningSoft, solid: c.warning },
    grey: { fg: c.textSecondary, bg: c.surfaceAlt, solid: c.textMuted },
    red: { fg: c.dangerText, bg: c.dangerSoft, solid: c.danger },
  } satisfies Record<DoseColor, { fg: string; bg: string; solid: string }>;
}

export function statusText(view: DoseView): { label: string; icon: IconName } {
  if (view.extras.length) return { label: 'Posible toma doble', icon: 'alert-circle' };
  const e = view.event;
  switch (view.status) {
    case 'taken':
      return e?.recordedByRole === 'caregiver'
        ? { label: `Confirmada por ${e.recordedByName?.split(' ')[0] || 'tu cuidador/a'} · ${clock(e.takenAt)}`, icon: 'checkmark-circle' }
        : { label: `Tomada · ${clock(e?.takenAt)}`, icon: 'checkmark-circle' };
    case 'skipped':
      return { label: 'No tomada', icon: 'close-circle' };
    case 'pending':
      return { label: 'Pendiente', icon: 'time' };
    case 'later':
      return { label: 'Más tarde', icon: 'time-outline' };
    case 'unconfirmed':
      return { label: 'Sin confirmar', icon: 'help-circle' };
  }
}

export function StatusPill({ view, testID }: { view: DoseView; testID?: string }) {
  const colors = useDoseColors()[view.color];
  const { label, icon } = statusText(view);
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]} testID={testID} accessibilityLabel={label}>
      <Icon name={icon} size={16} color={colors.solid} />
      <AppText variant="small" style={{ color: colors.fg }} numberOfLines={2}>
        {label}
      </AppText>
    </View>
  );
}

// ─── Foto real de la caja (o envase ilustrado si CIMA no tiene foto) ─────────────────────────────────────

/**
 * La caja del medicamento: primero la foto que hizo la persona (de este tratamiento o de ese medicamento, guardada
 * solo en su teléfono), después la foto oficial de CIMA y, si no hay ninguna, un envase dibujado.
 */
export function PillPhoto({ treatment, width = 64, height = 52 }: { treatment: Pick<Treatment, 'medicineId' | 'name'> & { id?: string }; width?: number; height?: number }) {
  const loaders = useRef(new Map<string, () => Promise<string | null>>());
  const loader = useCallback(() => {
    const id = treatment.medicineId;
    if (!id) return Promise.resolve(null);
    let fn = loaders.current.get(id);
    if (!fn) {
      fn = () => MedicationService.getMedicationImage(id);
      loaders.current.set(id, fn);
    }
    return fn();
  }, [treatment.medicineId]);
  const ownKeys = [treatment.id ? `pill:${treatment.id}` : '', treatment.medicineId ? `med:${treatment.medicineId}` : ''].filter(Boolean);
  return (
    <MedicationImage
      uri={null}
      loadUri={treatment.medicineId ? loader : undefined}
      imageKey={treatment.medicineId ?? treatment.name}
      ownPhotoKeys={ownKeys}
      preferOwn
      width={width}
      height={height}
      accessibilityLabel={`Caja de ${treatment.name}`}
    />
  );
}

// ─── Fila de una toma ─────────────────────────────────────────────────────────────────────────────────────

export function DoseRow({ view, onPress, testID }: { view: DoseView; onPress?: () => void; testID?: string }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const colors = useDoseColors()[view.color];
  const t = view.occurrence.treatment;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${view.occurrence.time}. ${medicineLabel(t)}, ${formatDose(t.doseAmount, t.doseUnit)}. ${statusText(view).label}`}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? c.primaryTint : c.surface,
          borderColor: view.incident ? colors.solid : c.border,
          borderRadius: theme.radius.lg,
          borderLeftColor: colors.solid,
        },
      ]}
    >
      <View style={styles.timeCol}>
        <AppText variant="heading" color="heading">
          {view.occurrence.time}
        </AppText>
      </View>
      <PillPhoto treatment={t} width={56} height={46} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color="heading" numberOfLines={2}>
          {medicineLabel(t)}
        </AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={2}>
          {`${formatDose(t.doseAmount, t.doseUnit)}${t.instructions ? ` · ${t.instructions}` : ''}`}
        </AppText>
        <View style={{ marginTop: 6 }}>
          <StatusPill view={view} />
        </View>
      </View>
      {onPress ? <Icon name="chevron-forward" size={22} color={c.textMuted} /> : null}
    </Pressable>
  );
}

// ─── Calendario de la semana ──────────────────────────────────────────────────────────────────────────────

export function WeekStrip({
  days,
  selected,
  today,
  onSelect,
  dots,
}: {
  days: string[];
  selected: string;
  today: string;
  onSelect: (date: string) => void;
  dots: Record<string, DoseColor[]>;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const palette = useDoseColors();
  return (
    <View style={styles.week} accessibilityRole="tablist" testID="pills-week">
      {days.map((date) => {
        const d = shortDay(date);
        const isSelected = date === selected;
        const colors = dots[date] ?? [];
        return (
          <Pressable
            key={date}
            onPress={() => onSelect(date)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={dayTitle(date, today)}
            testID={`pills-day-${date}`}
            style={[
              styles.day,
              {
                backgroundColor: isSelected ? c.primary : c.surface,
                borderColor: isSelected ? c.primary : date === today ? c.primarySoft : c.border,
                borderRadius: theme.radius.md,
              },
            ]}
          >
            <AppText variant="small" style={{ color: isSelected ? c.onPrimary : c.textSecondary }}>
              {date === today ? 'hoy' : d.week}
            </AppText>
            <AppText variant="subheading" style={{ color: isSelected ? c.onPrimary : c.heading }}>
              {d.day}
            </AppText>
            <View style={styles.dots}>
              {colors.slice(0, 4).map((color, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: isSelected ? c.onPrimary : palette[color].solid }]} />
              ))}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Qué significa cada color. */
export function Legend() {
  const palette = useDoseColors();
  const items: Array<[DoseColor, string]> = [
    ['green', 'Confirmada'],
    ['orange', 'Pendiente'],
    ['grey', 'Más tarde'],
    ['red', 'Requiere atención'],
  ];
  return (
    <View style={styles.legend} accessible accessibilityLabel="Verde: confirmada. Naranja: pendiente. Gris: más tarde. Rojo: requiere atención.">
      {items.map(([color, label]) => (
        <View key={color} style={styles.legendItem}>
          <View style={[styles.dot, styles.legendDot, { backgroundColor: palette[color].solid }]} />
          <AppText variant="small" color="textSecondary">
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

// ─── Controles grandes y sencillos (sin teclado) ──────────────────────────────────────────────────────────

function RoundButton({ icon, onPress, label, disabled, testID }: { icon: IconName; onPress: () => void; label: string; disabled?: boolean; testID?: string }) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: pressed ? c.primarySoft : c.primaryTint, opacity: disabled ? 0.4 : 1, borderColor: c.primarySoft },
      ]}
    >
      <Icon name={icon} size={26} color={c.primary} />
    </Pressable>
  );
}

/** Cantidad por toma: − 1 comprimido + (de medio en medio). */
export function AmountStepper({ value, unit, onChange }: { value: number; unit: DoseUnit; onChange: (v: number) => void }) {
  const theme = useAppTheme();
  const step = unit === 'ml' || unit === 'gotas' ? 1 : 0.5;
  const min = step;
  return (
    <View style={[styles.stepper, { borderColor: theme.colors.border, borderRadius: theme.radius.lg }]} testID="pills-amount">
      <RoundButton icon="remove" label="Menos" onPress={() => onChange(Math.max(min, Math.round((value - step) * 2) / 2))} disabled={value <= min} testID="pills-amount-minus" />
      <View style={styles.stepperValue} accessibilityLiveRegion="polite">
        <AppText variant="title" color="heading" align="center">
          {value === 0.5 ? '½' : String(value).replace('.', ',')}
        </AppText>
        <AppText variant="caption" color="textSecondary" align="center">
          {unitLabel(unit, value !== 1)}
        </AppText>
      </View>
      <RoundButton icon="add" label="Más" onPress={() => onChange(Math.min(50, value + step))} testID="pills-amount-plus" />
    </View>
  );
}

/** Hora de una toma: horas y minutos con botones (de 5 en 5 minutos). */
export function TimeEditor({ value, onChange, onRemove, index }: { value: string; onChange: (v: string) => void; onRemove?: () => void; index: number }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [h, m] = value.split(':').map(Number);
  const set = (hh: number, mm: number) => onChange(`${String((hh + 24) % 24).padStart(2, '0')}:${String((mm + 60) % 60).padStart(2, '0')}`);
  return (
    <View style={[styles.timeEditor, { borderColor: c.border, borderRadius: theme.radius.lg, backgroundColor: c.surface }]} testID={`pills-time-${index}`}>
      <View style={styles.timeGroup}>
        <RoundButton icon="chevron-up" label="Una hora más" onPress={() => set(h + 1, m)} testID={`pills-time-${index}-hour-up`} />
        <RoundButton icon="chevron-down" label="Una hora menos" onPress={() => set(h - 1, m)} testID={`pills-time-${index}-hour-down`} />
      </View>
      <AppText variant="display" color="heading" style={styles.timeText} accessibilityLabel={`Hora ${value}`}>
        {value}
      </AppText>
      <View style={styles.timeGroup}>
        <RoundButton icon="chevron-up" label="Cinco minutos más" onPress={() => set(m + 5 >= 60 ? h + 1 : h, m + 5)} testID={`pills-time-${index}-min-up`} />
        <RoundButton icon="chevron-down" label="Cinco minutos menos" onPress={() => set(m - 5 < 0 ? h - 1 : h, m - 5)} testID={`pills-time-${index}-min-down`} />
      </View>
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Quitar la hora ${value}`} style={[styles.remove, { backgroundColor: c.dangerSoft }]} testID={`pills-time-${index}-remove`}>
          <Icon name="trash-outline" size={22} color={c.dangerText} />
        </Pressable>
      ) : null}
    </View>
  );
}

const WEEK = [1, 2, 3, 4, 5, 6, 7];

export function DayChips({ value, onChange }: { value: number[]; onChange: (v: number[]) => void }) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <View style={styles.dayChips} testID="pills-weekdays">
      {WEEK.map((d) => {
        const on = value.includes(d);
        const name = weekdayName(d);
        return (
          <Pressable
            key={d}
            onPress={() => onChange(on ? value.filter((x) => x !== d) : [...value, d].sort())}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={name}
            testID={`pills-weekday-${d}`}
            style={[styles.dayChip, { backgroundColor: on ? c.primary : c.surface, borderColor: on ? c.primary : c.borderStrong }]}
          >
            <AppText variant="label" style={{ color: on ? c.onPrimary : c.heading }}>
              {name.slice(0, 1).toUpperCase()}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function FormSection({ title, hint, children, testID }: { title: string; hint?: string; children: ReactNode; testID?: string }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.xs, marginTop: theme.spacing.lg }} testID={testID}>
      <AppText variant="subheading" color="heading" accessibilityRole="header">
        {title}
      </AppText>
      {hint ? (
        <AppText variant="caption" color="textSecondary">
          {hint}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, maxWidth: '100%' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1, borderLeftWidth: 6 },
  timeCol: { minWidth: 58, alignItems: 'flex-start' },
  week: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, borderWidth: 1.5, gap: 2, minWidth: 0 },
  dots: { flexDirection: 'row', gap: 3, height: 7, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  round: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, padding: 10 },
  stepperValue: { flex: 1, alignItems: 'center' },
  timeEditor: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1.5, paddingVertical: 10, paddingHorizontal: 10, gap: 6 },
  timeGroup: { gap: 6 },
  timeText: { flex: 1, textAlign: 'center' },
  remove: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  dayChips: { flexDirection: 'row', justifyContent: 'space-between', gap: 6 },
  dayChip: { width: 42, height: 48, borderRadius: 21, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});

/**
 * Nombre corto y concentración a partir del nombre oficial («Metformina Sandoz 850 mg comprimidos recubiertos…» →
 * «Metformina Sandoz» y «850 mg»), para rellenar «Añadir a Mis pastillas» desde la caja. La pauta NO se rellena nunca.
 */
export function pillPrefill(officialName: string): { name: string; strength: string | null } {
  const match = officialName.match(/(\d+(?:[.,]\d+)?)\s*(mg|g|ml|mcg|µg|microgramos|ui|%)(?=\b|\s|\/|$)/i);
  if (!match || match.index === undefined) return { name: officialName.trim().slice(0, 120), strength: null };
  const name = officialName.slice(0, match.index).trim().replace(/[,;-]+$/, '').trim();
  return { name: (name || officialName).slice(0, 120), strength: `${match[1]} ${match[2].toLowerCase()}`.replace('ui', 'UI') };
}
