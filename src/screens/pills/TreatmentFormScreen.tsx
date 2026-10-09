/**
 * /pills/edit[?id=…][&medicineId=…&name=…&strength=…&source=photo|saved] — añadir o cambiar un medicamento de
 * «Mis pastillas»: nombre, concentración, cantidad por toma, frecuencia, horarios (varios), fechas de inicio y fin,
 * instrucciones, notas y la confirmación de que es la pauta indicada por un profesional.
 *
 * Desde la foto o desde «Mis medicamentos» llegan el nombre y la concentración, pero NUNCA la pauta: identificar la
 * caja no es una prescripción. La persona (o su cuidador/a) escribe y confirma la pauta que le indicó su médico.
 * Sin teclado para lo importante: botones grandes para la cantidad, las horas y los días.
 */
import { useEffect, useMemo, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, AppText, Chip, Icon, InfoBanner, PrimaryButton, Screen, SecondaryButton, SegmentedControl, TextButton, TextField } from '../../components';
import { useAppTheme } from '../../hooks';
import { usePillPlan } from '../../hooks/usePillPlan';
import { MedicationPlanService, MedicinePhotoService, PillReminders, isAppError, requestReminderPermission } from '../../services';
import { addDays, normalizeTimes, type DoseUnit, type Frequency } from '../../domain/medication';
import { withPremium } from '../premium/PremiumGate';
import { AmountStepper, DayChips, FormSection, PillPhoto, TimeEditor, dayTitle, todayDate } from './parts';

function param(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s && s.trim() ? s.trim() : undefined;
}

const UNITS: Array<{ value: DoseUnit; label: string }> = [
  { value: 'comprimido', label: 'Comprimido' },
  { value: 'capsula', label: 'Cápsula' },
  { value: 'sobre', label: 'Sobre' },
  { value: 'gotas', label: 'Gotas' },
  { value: 'ml', label: 'ml' },
  { value: 'inhalacion', label: 'Inhalación' },
  { value: 'parche', label: 'Parche' },
  { value: 'unidad', label: 'Otra' },
];

const INSTRUCTIONS = ['Con el desayuno', 'Con la comida', 'Con la cena', 'En ayunas', 'Antes de dormir', 'Con un vaso de agua'];
const PRESET_TIMES: Array<[string, string]> = [
  ['Desayuno', '08:00'],
  ['Comida', '14:00'],
  ['Merienda', '17:00'],
  ['Cena', '21:00'],
  ['Al acostarme', '23:00'],
];

type EndMode = 'none' | 'days';

function TreatmentFormScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const params = useLocalSearchParams<{ id?: string; medicineId?: string; name?: string; strength?: string; source?: string }>();
  const { state } = usePillPlan();
  const existing = state?.treatments.find((t) => t.id === param(params.id)) ?? null;
  const fromBox = !existing && (param(params.source) === 'photo' || param(params.source) === 'saved');
  const today = todayDate();

  const [name, setName] = useState(existing?.name ?? param(params.name) ?? '');
  const [strength, setStrength] = useState(existing?.strength ?? param(params.strength) ?? '');
  const [amount, setAmount] = useState(existing?.doseAmount ?? 1);
  const [unit, setUnit] = useState<DoseUnit>(existing?.doseUnit ?? 'comprimido');
  const [frequency, setFrequency] = useState<Frequency>(existing?.frequency ?? 'daily');
  const [days, setDays] = useState<number[]>(existing?.daysOfWeek ?? [1, 3, 5]);
  const [every, setEvery] = useState(existing?.intervalDays ?? 2);
  const [times, setTimes] = useState<string[]>(existing?.times.length ? existing.times : ['09:00']);
  const [startDate, setStartDate] = useState(existing?.startDate ?? today);
  const [endMode, setEndMode] = useState<EndMode>(existing?.endDate ? 'days' : 'none');
  const [durationDays, setDurationDays] = useState(() => {
    if (!existing?.endDate) return 7;
    const [a, b] = [existing.startDate, existing.endDate].map((x) => Date.parse(`${x}T00:00:00Z`));
    return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
  });
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [reminders, setReminders] = useState(existing?.remindersEnabled ?? true);
  const [confirmed, setConfirmed] = useState(!!existing);
  const [photo, setPhoto] = useState<PhotoChange>({ kind: 'keep' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const endDate = endMode === 'days' ? addDays(startDate, durationDays - 1) : null;
  const sortedTimes = useMemo(() => normalizeTimes(times), [times]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Escribe el nombre del medicamento.';
    if (sortedTimes.length === 0) e.times = 'Añade al menos una hora.';
    if (sortedTimes.length !== times.length) e.times = 'Hay dos horas iguales: cambia o quita una.';
    if (frequency === 'weekly' && days.length === 0) e.days = 'Elige al menos un día.';
    if (!confirmed) e.confirmed = 'Confirma que es la pauta que te indicó tu médico o farmacéutico.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (saving || !validate()) return;
    setSaving(true);
    setServerError(null);
    try {
      const savedTreatment = await MedicationPlanService.saveTreatment({
        id: existing?.id,
        medicineId: existing?.medicineId ?? param(params.medicineId) ?? null,
        name,
        strength: strength || null,
        doseAmount: amount,
        doseUnit: unit,
        frequency,
        daysOfWeek: frequency === 'weekly' ? days : null,
        intervalDays: frequency === 'interval' ? every : null,
        times: sortedTimes,
        startDate,
        endDate,
        instructions: instructions.trim() || null,
        notes: notes.trim() || null,
        remindersEnabled: reminders,
        prescriptionConfirmed: confirmed,
        source: existing ? 'manual' : fromBox ? (param(params.source) as 'photo' | 'saved') : 'manual',
      });
      // La foto de la caja se guarda solo en este teléfono (si falla, la pauta ya está guardada igualmente).
      if (photo.kind === 'new') {
        await MedicinePhotoService.save(`pill:${savedTreatment.id}`, photo.base64 ? { base64: photo.base64 } : { uri: photo.uri }).catch(() => undefined);
      }
      if (photo.kind === 'remove') await MedicinePhotoService.remove(`pill:${savedTreatment.id}`).catch(() => undefined);
      if (reminders) {
        // Al guardar la primera pauta se piden los avisos (se puede cambiar en Ajustes).
        const permission = await requestReminderPermission().catch(() => 'unsupported' as const);
        if (permission === 'granted') await PillReminders.reschedule();
      }
      router.replace('/pills');
    } catch (e) {
      setServerError(isAppError(e) ? e.message : 'No se ha podido guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!existing || saving) return;
    setSaving(true);
    try {
      await MedicationPlanService.archiveTreatment(existing.id);
      await PillReminders.reschedule();
      router.replace('/pills');
    } catch (e) {
      setServerError(isAppError(e) ? e.message : 'No se ha podido guardar. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <PrimaryButton label={existing ? 'Guardar los cambios' : 'Guardar el medicamento'} icon="checkmark" onPress={() => void save()} loading={saving} testID="pills-form-save" />
  );

  return (
    <Screen header={<AppHeader title={existing ? 'Cambiar la pauta' : 'Añadir un medicamento'} fallbackHref="/pills" />} footer={footer} keyboard testID="pills-form">
      {fromBox ? (
        <InfoBanner
          tone="info"
          icon="camera-outline"
          title="Desde la caja"
          message="La foto identifica el medicamento, no tu pauta. Escribe a continuación la pauta que te indicó tu médico o farmacéutico."
          testID="pills-form-from-box"
        />
      ) : null}
      {serverError ? <InfoBanner tone="danger" message={serverError} style={{ marginTop: theme.spacing.sm }} /> : null}

      <FormSection title="Medicamento">
        <TextField label="Nombre" value={name} onChangeText={setName} error={errors.name} placeholder="Por ejemplo, Metformina" maxLength={120} testID="pills-form-name" />
        <TextField label="Concentración" optional value={strength} onChangeText={setStrength} placeholder="Por ejemplo, 850 mg" maxLength={60} testID="pills-form-strength" />
      </FormSection>

      <FormSection title="Foto de tu caja">
        <BoxPhotoPicker
          treatmentId={existing?.id ?? null}
          medicineId={existing?.medicineId ?? param(params.medicineId) ?? null}
          name={name || 'el medicamento'}
          value={photo}
          onChange={setPhoto}
        />
      </FormSection>

      <FormSection title="Cantidad en cada toma">
        <View style={styles.chips}>
          {UNITS.map((u) => (
            <Chip key={u.value} label={u.label} selected={unit === u.value} onPress={() => setUnit(u.value)} />
          ))}
        </View>
        <AmountStepper value={amount} unit={unit} onChange={setAmount} />
      </FormSection>

      <FormSection title="¿Qué días?" testID="pills-form-frequency">
        <SegmentedControl
          options={[
            { value: 'daily', label: 'Todos los días' },
            { value: 'weekly', label: 'Algunos días' },
            { value: 'interval', label: 'Cada X días' },
          ]}
          value={frequency}
          onChange={setFrequency}
          accessibilityLabel="Frecuencia"
        />
        {frequency === 'weekly' ? (
          <>
            <DayChips value={days} onChange={setDays} />
            {errors.days ? (
              <AppText variant="caption" color="dangerText">
                {errors.days}
              </AppText>
            ) : null}
          </>
        ) : null}
        {frequency === 'interval' ? (
          <View style={styles.inline}>
            <TextButton label="−" onPress={() => setEvery(Math.max(2, every - 1))} />
            <AppText variant="heading" color="heading">{`Cada ${every} días`}</AppText>
            <TextButton label="+" onPress={() => setEvery(Math.min(90, every + 1))} />
          </View>
        ) : null}
      </FormSection>

      <FormSection title="¿A qué horas?" hint="Puedes poner varias horas para el mismo medicamento." testID="pills-form-times">
        {times.map((time, i) => (
          <TimeEditor
            key={i}
            index={i}
            value={time}
            onChange={(v) => setTimes(times.map((x, j) => (j === i ? v : x)))}
            onRemove={times.length > 1 ? () => setTimes(times.filter((_, j) => j !== i)) : undefined}
          />
        ))}
        {errors.times ? (
          <AppText variant="caption" color="dangerText">
            {errors.times}
          </AppText>
        ) : null}
        <View style={styles.chips}>
          {PRESET_TIMES.filter(([, v]) => !times.includes(v)).map(([label, v]) => (
            <Chip key={v} label={`${label} · ${v}`} icon="add" onPress={() => setTimes([...times, v].slice(0, 8))} />
          ))}
        </View>
      </FormSection>

      <FormSection title="¿Desde cuándo y hasta cuándo?">
        <View style={styles.chips}>
          <Chip label="Desde hoy" selected={startDate === today} onPress={() => setStartDate(today)} />
          <Chip label="Desde mañana" selected={startDate === addDays(today, 1)} onPress={() => setStartDate(addDays(today, 1))} />
          {existing && existing.startDate < today ? <Chip label={`Desde el ${existing.startDate.split('-').reverse().join('/')}`} selected={startDate === existing.startDate} onPress={() => setStartDate(existing.startDate)} /> : null}
        </View>
        <SegmentedControl
          options={[
            { value: 'none', label: 'Sin fecha de fin' },
            { value: 'days', label: 'Durante unos días' },
          ]}
          value={endMode}
          onChange={setEndMode}
          accessibilityLabel="Duración"
        />
        {endMode === 'days' ? (
          <View>
            <View style={styles.inline}>
              <TextButton label="−" onPress={() => setDurationDays(Math.max(1, durationDays - 1))} testID="pills-form-days-minus" />
              <AppText variant="heading" color="heading">{`${durationDays} día${durationDays === 1 ? '' : 's'}`}</AppText>
              <TextButton label="+" onPress={() => setDurationDays(Math.min(365, durationDays + 1))} testID="pills-form-days-plus" />
            </View>
            <AppText variant="caption" color="textSecondary" align="center">
              {`Último día: ${dayTitle(endDate!, today).toLowerCase()}`}
            </AppText>
          </View>
        ) : null}
      </FormSection>

      <FormSection title="Cómo tomarlo" hint="Lo que te dijeron tu médico o el prospecto.">
        <View style={styles.chips}>
          {INSTRUCTIONS.map((text) => (
            <Chip key={text} label={text} selected={instructions === text} onPress={() => setInstructions(instructions === text ? '' : text)} />
          ))}
        </View>
        <TextField label="Otras instrucciones" optional value={INSTRUCTIONS.includes(instructions) ? '' : instructions} onChangeText={setInstructions} maxLength={300} testID="pills-form-instructions" />
        <TextField label="Notas" optional value={notes} onChangeText={setNotes} maxLength={500} placeholder="Por ejemplo, me la recetó la Dra. Pérez" testID="pills-form-notes" />
      </FormSection>

      <FormSection title="Avisos">
        <View style={[styles.switchRow, { borderColor: c.border, borderRadius: theme.radius.lg }]}>
          <Icon name="notifications" size={24} color={c.primary} />
          <AppText variant="bodyStrong" color="heading" style={styles.flex}>
            Avisarme a estas horas
          </AppText>
          <Switch value={reminders} onValueChange={setReminders} accessibilityLabel="Avisarme a estas horas" testID="pills-form-reminders" />
        </View>
      </FormSection>

      <Pressable
        onPress={() => setConfirmed(!confirmed)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: confirmed }}
        style={[styles.confirm, { borderColor: errors.confirmed ? c.danger : c.primarySoft, backgroundColor: c.primaryTint, borderRadius: theme.radius.lg, marginTop: theme.spacing.lg }]}
        testID="pills-form-confirm"
      >
        <Icon name={confirmed ? 'checkbox' : 'square-outline'} size={30} color={confirmed ? c.primary : c.textSecondary} />
        <AppText variant="body" color="text" style={styles.flex}>
          Confirmo que esta es la pauta que me indicó mi médico o farmacéutico.
        </AppText>
      </Pressable>
      {errors.confirmed ? (
        <AppText variant="caption" color="dangerText" style={{ marginTop: 4 }}>
          {errors.confirmed}
        </AppText>
      ) : null}

      {existing ? (
        <View style={{ marginTop: theme.spacing.lg }}>
          <TextButton label="Dejar de tomarlo (se guarda el historial)" tone="danger" icon="archive-outline" onPress={() => void archive()} testID="pills-form-archive" />
        </View>
      ) : null}
    </Screen>
  );
}

export default withPremium(TreatmentFormScreen, 'pills');

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  photoBox: { width: 112, height: 92, backgroundColor: '#FFFFFF', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photoImage: { width: '100%', height: '100%' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, padding: 14 },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1.5, padding: 14 },
});

// ─── Foto de la caja (solo en este teléfono) ──────────────────────────────────────────────────────────────

type PhotoChange = { kind: 'keep' } | { kind: 'new'; uri: string; base64?: string } | { kind: 'remove' };

/**
 * La persona puede poner la foto de SU caja: así reconoce el medicamento en los avisos y en la lista. Se guarda solo
 * en este teléfono. Sin foto propia se ve la foto oficial (CIMA) o un envase dibujado.
 */
function BoxPhotoPicker({
  treatmentId,
  medicineId,
  name,
  value,
  onChange,
}: {
  treatmentId: string | null;
  medicineId: string | null;
  name: string;
  value: PhotoChange;
  onChange: (v: PhotoChange) => void;
}) {
  const theme = useAppTheme();
  const [hasOwn, setHasOwn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // La foto con la que se acaba de identificar este medicamento (solo si la persona elige usarla se guarda).
  const recent = useMemo(() => MedicinePhotoService.recentScanPhotoFor(medicineId), [medicineId]);
  useEffect(() => {
    let alive = true;
    if (!treatmentId) return undefined;
    void MedicinePhotoService.get([`pill:${treatmentId}`]).then((u) => {
      if (alive) setHasOwn(!!u);
    });
    return () => {
      alive = false;
    };
  }, [treatmentId]);

  const pick = async (source: 'camera' | 'library') => {
    setError(null);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setError('Para hacer la foto, permite que MediClaro use la cámara en los ajustes del teléfono.');
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.9, exif: false };
      const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.[0]) return;
      onChange({ kind: 'new', uri: result.assets[0].uri });
    } catch {
      setError('No se ha podido abrir la foto. Inténtalo de nuevo.');
    }
  };

  const showOwnRemoval = value.kind === 'new' || (value.kind === 'keep' && hasOwn);
  return (
    <View style={{ gap: theme.spacing.sm }} testID="pills-form-photo">
      <View style={styles.photoRow}>
        {value.kind === 'new' ? (
          <View style={[styles.photoBox, { borderRadius: theme.radius.sm }]}>
            <Image source={{ uri: value.uri }} style={styles.photoImage} resizeMode="contain" accessibilityLabel={`Foto de tu caja de ${name}`} />
          </View>
        ) : (
          <PillPhoto
            key={value.kind}
            treatment={{ id: value.kind === 'remove' ? undefined : treatmentId ?? undefined, medicineId, name }}
            width={112}
            height={92}
          />
        )}
        <AppText variant="caption" color="textSecondary" style={styles.flex}>
          {value.kind === 'new'
            ? 'Se guardará al pulsar «Guardar». Solo en este teléfono.'
            : 'Pon la foto de tu caja para reconocerla en los avisos. Se guarda solo en este teléfono.'}
        </AppText>
      </View>
      {recent && value.kind !== 'new' ? (
        <SecondaryButton
          label="Usar la foto que acabo de hacer"
          icon="checkmark-circle-outline"
          onPress={() => onChange({ kind: 'new', uri: `data:image/jpeg;base64,${recent}`, base64: recent })}
          testID="pills-form-photo-recent"
        />
      ) : null}
      {Platform.OS !== 'web' ? (
        <SecondaryButton label="Hacer una foto de la caja" icon="camera-outline" onPress={() => void pick('camera')} testID="pills-form-photo-camera" />
      ) : null}
      <SecondaryButton label="Elegir una foto" icon="images-outline" onPress={() => void pick('library')} testID="pills-form-photo-library" />
      {showOwnRemoval ? <TextButton label="Quitar mi foto" icon="trash-outline" onPress={() => onChange({ kind: 'remove' })} testID="pills-form-photo-remove" /> : null}
      {error ? <InfoBanner tone="danger" message={error} /> : null}
    </View>
  );
}
