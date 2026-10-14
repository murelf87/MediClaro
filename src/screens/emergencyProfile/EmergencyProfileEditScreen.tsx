/**
 * Editar el perfil de emergencia (/emergency-profile-edit).
 * Carga el perfil actual (conservando los permisos de compartir), valida en línea
 * y guarda con EmergencyService. Si hay cambios sin guardar, pregunta antes de salir.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { useNavigation, useRouter } from 'expo-router';
import {
  Screen,
  AppHeader,
  AppText,
  Chip,
  ErrorState,
  InfoBanner,
  PrimaryButton,
  TextField,
} from '../../components';
import { useAppTheme, useAsync } from '../../hooks';
import { EmergencyService } from '../../services';
import type { EmergencyProfile, EmergencyProfileInput, EmergencySharingPermissions } from '../../types';
import { confirmAsync, showAlert } from '../../utils/dialogs';
import {
  BLOOD_TYPES,
  OTHER_RELATIONSHIP,
  RELATIONSHIPS,
  ProfileSkeleton,
  SectionCard,
  asAppError,
  dobToInput,
  formatDobTyping,
  isPlausiblePhone,
  normalizeBloodType,
  parseDobInput,
  splitRelationship,
} from './parts';

interface FormState {
  fullName: string;
  dob: string;
  address: string;
  postalCode: string;
  city: string;
  province: string;
  country: string;
  currentMedications: string;
  allergies: string;
  medicalConditions: string;
  bloodType: string;
  /** Solo interfaz: la persona eligió "No lo sé" (se guarda vacío). */
  bloodUnknown: boolean;
  doctorName: string;
  doctorPhone: string;
  contactName: string;
  contactRelation: string;
  contactRelationOther: string;
  contactPhone: string;
}

type FieldKey = keyof FormState;
type SectionKey = 'personal' | 'address' | 'medical' | 'doctor' | 'contact';
type Errors = Partial<Record<FieldKey, string>>;

const FIELD_ORDER: FieldKey[] = ['fullName', 'dob', 'postalCode', 'doctorPhone', 'contactName', 'contactPhone'];
const FIELD_SECTION: Partial<Record<FieldKey, SectionKey>> = {
  fullName: 'personal',
  dob: 'personal',
  postalCode: 'address',
  doctorPhone: 'doctor',
  contactName: 'contact',
  contactPhone: 'contact',
};

function toForm(p: EmergencyProfile): FormState {
  const rel = splitRelationship(p.caregiver?.relationship ?? '');
  return {
    fullName: p.fullName,
    dob: dobToInput(p.dateOfBirth),
    address: p.address,
    postalCode: p.postalCode,
    city: p.city,
    province: p.province,
    country: p.country || 'España',
    currentMedications: p.currentMedications,
    allergies: p.allergies,
    medicalConditions: p.medicalConditions,
    bloodType: p.bloodType,
    bloodUnknown: false,
    doctorName: p.primaryDoctorName,
    doctorPhone: p.primaryDoctorPhone,
    contactName: p.caregiver?.name ?? '',
    contactRelation: rel.chip,
    contactRelationOther: rel.other,
    contactPhone: p.caregiver?.phone ?? '',
  };
}

/** Lo que se guardaría (sin estados solo de interfaz), para detectar cambios. */
function snapshot(f: FormState): string {
  const { bloodUnknown: _ignored, ...rest } = f;
  return JSON.stringify(rest);
}

function isSpain(country: string): boolean {
  const c = country.trim().toLowerCase();
  return !c || c === 'españa' || c === 'espana' || c === 'spain' || c === 'es';
}

function validate(f: FormState): Errors {
  const errors: Errors = {};
  if (!f.fullName.trim()) errors.fullName = 'Escribe tu nombre y apellidos.';
  const dob = parseDobInput(f.dob);
  if (!dob.ok) errors.dob = dob.message;
  if (f.postalCode.trim() && isSpain(f.country) && !/^\d{5}$/.test(f.postalCode.trim())) {
    errors.postalCode = 'El código postal tiene 5 cifras.';
  }
  if (!isPlausiblePhone(f.doctorPhone)) errors.doctorPhone = 'Revisa el teléfono de tu médico.';
  if (!isPlausiblePhone(f.contactPhone)) errors.contactPhone = 'Revisa el teléfono de tu contacto.';
  if (!f.contactName.trim() && (f.contactPhone.trim() || f.contactRelation)) {
    errors.contactName = 'Escribe el nombre de tu contacto.';
  }
  return errors;
}

function toInput(f: FormState, dateOfBirth: string, permissions: EmergencySharingPermissions): EmergencyProfileInput {
  return {
    fullName: f.fullName.trim(),
    dateOfBirth,
    address: f.address.trim(),
    postalCode: f.postalCode.trim(),
    city: f.city.trim(),
    province: f.province.trim(),
    country: f.country.trim() || 'España',
    bloodType: f.bloodUnknown ? '' : f.bloodType.trim(),
    allergies: f.allergies.trim(),
    medicalConditions: f.medicalConditions.trim(),
    currentMedications: f.currentMedications.trim(),
    primaryDoctorName: f.doctorName.trim(),
    primaryDoctorPhone: f.doctorPhone.trim(),
    caregiver: {
      name: f.contactName.trim(),
      relationship: f.contactRelation === OTHER_RELATIONSHIP ? f.contactRelationOther.trim() : f.contactRelation,
      phone: f.contactPhone.trim(),
    },
    permissions,
  };
}

/** Errores de validación del servicio → campo correspondiente. */
function fieldForServiceMessage(message: string): FieldKey | null {
  if (/nombre/i.test(message)) return 'fullName';
  if (/fecha/i.test(message)) return 'dob';
  if (/contacto/i.test(message)) return 'contactPhone';
  if (/médico|medico/i.test(message)) return 'doctorPhone';
  return null;
}

export default function EmergencyProfileEditScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useAppTheme();
  const loaded = useAsync(() => EmergencyService.getEmergencyProfile(), []);

  const [form, setForm] = useState<FormState | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const initial = useRef<string>('');
  const allowLeave = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const containerY = useRef(0);
  const sectionY = useRef<Partial<Record<SectionKey, number>>>({});

  // Rellenamos el formulario una sola vez con el perfil actual
  useEffect(() => {
    if (form || loaded.status !== 'success' || !loaded.data) return;
    const f = toForm(loaded.data);
    initial.current = snapshot(f);
    setForm(f);
  }, [form, loaded.status, loaded.data]);

  const dirty = !!form && snapshot(form) !== initial.current;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;

  const confirmLeave = () =>
    confirmAsync({
      title: '¿Salir sin guardar?',
      message: 'Los cambios que has hecho no se guardarán.',
      confirmText: 'Salir sin guardar',
      cancelText: 'Seguir editando',
      destructive: true,
    });

  const leave = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/emergency-profile');
  };

  // Botón atrás de Android y cualquier otra salida: también preguntan si hay cambios
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (allowLeave.current || !dirtyRef.current) return;
      e.preventDefault();
      void confirmLeave().then((ok) => {
        if (!ok) return;
        allowLeave.current = true;
        navigation.dispatch(e.data.action);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation]);

  // iOS: con cambios sin guardar, desactivamos el gesto de deslizar para volver
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !dirty } as object);
  }, [navigation, dirty]);

  const onBack = async () => {
    if (dirtyRef.current && !allowLeave.current) {
      const ok = await confirmLeave();
      if (!ok) return;
      allowLeave.current = true;
    }
    leave();
  };

  const update = (patch: Partial<FormState>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
    const keys = Object.keys(patch) as FieldKey[];
    if (keys.some((k) => errors[k])) {
      setErrors((prev) => {
        const next = { ...prev };
        keys.forEach((k) => delete next[k]);
        return next;
      });
    }
    if (formError) setFormError(null);
  };

  const scrollToField = (field: FieldKey) => {
    const section = FIELD_SECTION[field];
    const y = section ? sectionY.current[section] : undefined;
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, containerY.current + y - theme.spacing.sm), animated: true });
  };

  const save = async () => {
    if (!form || !loaded.data || saving) return;
    const found = validate(form);
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) {
      setErrors(found);
      scrollToField(first);
      return;
    }
    const dob = parseDobInput(form.dob);
    setErrors({});
    setFormError(null);
    setSaving(true);
    try {
      const res = await EmergencyService.updateEmergencyProfile(
        toInput(form, dob.ok ? dob.iso : '', loaded.data.permissions),
      );
      allowLeave.current = true;
      if (res.synced) await showAlert('Perfil guardado', 'Tu información de emergencia está al día.');
      else await showAlert(res.message ?? 'Guardado en este teléfono.');
      leave();
    } catch (e) {
      const err = asAppError(e);
      const field = err.kind === 'invalid_input' ? fieldForServiceMessage(err.message) : null;
      if (field) {
        setErrors({ [field]: err.message });
        scrollToField(field);
      } else {
        setFormError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const onSectionLayout = (key: SectionKey) => (e: LayoutChangeEvent) => {
    sectionY.current[key] = e.nativeEvent.layout.y;
  };

  const header = <AppHeader title="Editar perfil" onBack={onBack} fallbackHref="/emergency-profile" />;

  if (loaded.status === 'error') {
    return (
      <Screen background="surfaceAlt" header={header}>
        <ErrorState kind={loaded.error?.kind} message={loaded.error?.message} onRetry={() => void loaded.reload()} />
      </Screen>
    );
  }

  if (!form) {
    return (
      <Screen background="surfaceAlt" header={header}>
        <View style={{ marginTop: theme.spacing.md }}>
          <ProfileSkeleton cards={3} />
        </View>
      </Screen>
    );
  }

  const bloodSelected = normalizeBloodType(form.bloodType);

  return (
    <Screen
      keyboard
      background="surfaceAlt"
      header={header}
      scrollRef={scrollRef}
      footer={
        <>
          {formError ? <InfoBanner tone="danger" title="No se ha podido guardar" message={formError} /> : null}
          <PrimaryButton label="Guardar" icon="checkmark" onPress={save} loading={saving} testID="edit-save" />
        </>
      }
    >
      <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.md }}>
        Solo es obligatorio tu nombre. Rellena lo que sepas: todo ayuda en una emergencia.
      </AppText>

      <View style={{ gap: theme.spacing.md }} onLayout={(e) => (containerY.current = e.nativeEvent.layout.y)}>
        <SectionCard title="Datos personales" onLayout={onSectionLayout('personal')}>
          <Fields>
            <TextField
              label="Nombre y apellidos"
              hint="Obligatorio."
              value={form.fullName}
              onChangeText={(t) => update({ fullName: t })}
              error={errors.fullName}
              autoCapitalize="words"
              autoComplete="name"
              textContentType="name"
              placeholder="Ej.: María García López"
            />
            <TextField
              label="Fecha de nacimiento"
              hint="Día, mes y año. Por ejemplo: 12/03/1948"
              value={form.dob}
              onChangeText={(t) => update({ dob: formatDobTyping(t) })}
              error={errors.dob}
              keyboardType="number-pad"
              maxLength={10}
              placeholder="DD/MM/AAAA"
              optional
            />
          </Fields>
        </SectionCard>

        <SectionCard title="Dirección" onLayout={onSectionLayout('address')}>
          <Fields>
            <TextField
              label="Calle y número"
              value={form.address}
              onChangeText={(t) => update({ address: t })}
              autoComplete="street-address"
              textContentType="fullStreetAddress"
              placeholder="Ej.: Avenida de la Paz, 12"
              optional
            />
            <TextField
              label="Código postal"
              value={form.postalCode}
              onChangeText={(t) => update({ postalCode: t.replace(/[^\dA-Za-z -]/g, '') })}
              error={errors.postalCode}
              keyboardType={isSpain(form.country) ? 'number-pad' : 'default'}
              maxLength={isSpain(form.country) ? 5 : 10}
              autoComplete="postal-code"
              textContentType="postalCode"
              placeholder="Ej.: 41005"
              optional
            />
            <TextField
              label="Ciudad"
              value={form.city}
              onChangeText={(t) => update({ city: t })}
              textContentType="addressCity"
              autoCapitalize="words"
              optional
            />
            <TextField
              label="Provincia"
              value={form.province}
              onChangeText={(t) => update({ province: t })}
              textContentType="addressState"
              autoCapitalize="words"
              optional
            />
            <TextField
              label="País"
              value={form.country}
              onChangeText={(t) => update({ country: t })}
              textContentType="countryName"
              autoCapitalize="words"
            />
          </Fields>
        </SectionCard>

        <SectionCard title="Información médica" onLayout={onSectionLayout('medical')}>
          <Fields>
            <TextField
              label="Medicamentos habituales"
              hint="Sepáralos con comas."
              value={form.currentMedications}
              onChangeText={(t) => update({ currentMedications: t })}
              multiline
              placeholder="Ej.: Paracetamol 1 g, Omeprazol 20 mg"
              optional
            />
            <TextField
              label="Alergias"
              hint="Sepáralas con comas."
              value={form.allergies}
              onChangeText={(t) => update({ allergies: t })}
              placeholder="Ej.: Penicilina"
              optional
            />
            <TextField
              label="Enfermedades relevantes"
              hint="Sepáralas con comas."
              value={form.medicalConditions}
              onChangeText={(t) => update({ medicalConditions: t })}
              placeholder="Ej.: Hipertensión"
              optional
            />
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label" color="heading">
                Grupo sanguíneo
              </AppText>
              <View style={styles.chips} accessibilityLabel="Grupo sanguíneo">
                {BLOOD_TYPES.map((b) => {
                  const selected = !form.bloodUnknown && bloodSelected === b.value;
                  return (
                    <Chip
                      key={b.value}
                      label={b.label}
                      selected={selected}
                      onPress={() => update(selected ? { bloodType: '' } : { bloodType: b.value, bloodUnknown: false })}
                    />
                  );
                })}
                <Chip
                  label="No lo sé"
                  selected={form.bloodUnknown}
                  onPress={() => update(form.bloodUnknown ? { bloodUnknown: false } : { bloodType: '', bloodUnknown: true })}
                />
              </View>
            </View>
          </Fields>
        </SectionCard>

        <SectionCard title="Médico de cabecera" onLayout={onSectionLayout('doctor')}>
          <Fields>
            <TextField
              label="Nombre del médico"
              value={form.doctorName}
              onChangeText={(t) => update({ doctorName: t })}
              autoCapitalize="words"
              placeholder="Ej.: Dra. López"
              optional
            />
            <TextField
              label="Teléfono del médico"
              value={form.doctorPhone}
              onChangeText={(t) => update({ doctorPhone: t })}
              error={errors.doctorPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              placeholder="Ej.: 954 000 000"
              optional
            />
            <InfoBanner tone="neutral" icon="phone-portrait-outline" message="Se guarda solo en este teléfono." />
          </Fields>
        </SectionCard>

        <SectionCard title="Contacto de emergencia" onLayout={onSectionLayout('contact')}>
          <Fields>
            <TextField
              label="Nombre del contacto"
              value={form.contactName}
              onChangeText={(t) => update({ contactName: t })}
              error={errors.contactName}
              autoCapitalize="words"
              placeholder="Ej.: Ana García"
              optional
            />
            <View style={{ gap: theme.spacing.xs }}>
              <AppText variant="label" color="heading">
                Relación
              </AppText>
              <View style={styles.chips}>
                {[...RELATIONSHIPS, OTHER_RELATIONSHIP].map((r) => {
                  const selected = form.contactRelation === r;
                  return (
                    <Chip key={r} label={r} selected={selected} onPress={() => update({ contactRelation: selected ? '' : r })} />
                  );
                })}
              </View>
            </View>
            {form.contactRelation === OTHER_RELATIONSHIP ? (
              <TextField
                label="¿Qué relación tiene contigo?"
                value={form.contactRelationOther}
                onChangeText={(t) => update({ contactRelationOther: t })}
                placeholder="Por ejemplo: vecina, cuidadora"
              />
            ) : null}
            <TextField
              label="Teléfono del contacto"
              value={form.contactPhone}
              onChangeText={(t) => update({ contactPhone: t })}
              error={errors.contactPhone}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              autoComplete="tel"
              placeholder="Ej.: 600 000 000"
              optional
            />
          </Fields>
        </SectionCard>
      </View>
    </Screen>
  );
}

function Fields({ children }: { children: ReactNode }) {
  const theme = useAppTheme();
  return <View style={{ gap: theme.spacing.md }}>{children}</View>;
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
