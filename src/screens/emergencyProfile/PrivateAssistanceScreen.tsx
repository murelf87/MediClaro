/**
 * Número privado de asistencia (/private-assistance).
 * El servicio que la persona elige para pedir ayuda (p. ej. su teleasistencia),
 * independiente del 112. Se guarda solo en este teléfono.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Screen,
  AppHeader,
  AppText,
  Card,
  ErrorState,
  Icon,
  InfoBanner,
  OfficialEmergencyNote,
  PrimaryButton,
  SecondaryButton,
  Skeleton,
  TextButton,
  TextField,
} from '../../components';
import { useAppTheme, useAsync } from '../../hooks';
import { EmergencyService } from '../../services';
import type { PrivateAssistanceService } from '../../types';
import { confirmAsync } from '../../utils/dialogs';
import { formatPhoneForDisplay } from '../../utils/format';
import { RowNote, asAppError } from './parts';

type Notice = { tone: 'success' | 'neutral' | 'danger'; message: string } | null;

export default function PrivateAssistanceScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const service = useAsync(() => EmergencyService.getPrivateAssistanceNumber(), []);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const current = service.status === 'success' ? service.data : null;
  const loaded = service.status === 'success';
  const showForm = loaded && (current === null || formOpen);

  const openForm = (prefill?: PrivateAssistanceService) => {
    setName(prefill?.name ?? '');
    setPhone(prefill?.phone ?? '');
    setPhoneError(null);
    setFormError(null);
    setNotice(null);
    setFormOpen(true);
  };

  const cancelForm = () => {
    setFormOpen(false);
    setPhoneError(null);
    setFormError(null);
  };

  const save = async () => {
    if (saving) return;
    if (!phone.trim()) {
      setPhoneError('Escribe el número de teléfono.');
      return;
    }
    setSaving(true);
    setPhoneError(null);
    setFormError(null);
    try {
      await EmergencyService.setPrivateAssistanceService({ name, phone });
      await service.refresh();
      setFormOpen(false);
      setNotice({ tone: 'success', message: 'Número guardado. Lo verás en el botón azul de la pantalla de emergencia.' });
    } catch (e) {
      const err = asAppError(e);
      if (err.kind === 'invalid_input') setPhoneError(err.message);
      else setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!current || removing) return;
    const ok = await confirmAsync({
      title: '¿Quitar este número?',
      message: `Dejarás de usar ${current.name} (${formatPhoneForDisplay(current.phone)}) como servicio privado de asistencia. El 112 seguirá siempre disponible.`,
      confirmText: 'Quitar',
      cancelText: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    setRemoving(true);
    setNotice(null);
    try {
      await EmergencyService.clearPrivateAssistanceService();
      await service.refresh();
      setFormOpen(false);
      setNotice({ tone: 'neutral', message: 'Has quitado tu número privado de asistencia.' });
    } catch (e) {
      setNotice({ tone: 'danger', message: asAppError(e).message });
    } finally {
      setRemoving(false);
    }
  };

  const renderCurrent = () => {
    if (!loaded) return null;
    if (current?.source === 'user') {
      return (
        <Card padding={theme.spacing.lg}>
          <AppText variant="captionStrong" color="textSecondary" style={styles.upper}>
            Tu servicio
          </AppText>
          <View style={[styles.serviceRow, { marginTop: theme.spacing.xs }]} accessible accessibilityLabel={`${current.name}, ${formatPhoneForDisplay(current.phone)}`}>
            <View style={[styles.tile, { backgroundColor: c.primarySoft, borderRadius: theme.radius.sm }]}>
              <Icon name="headset" size={24} color={c.primary} />
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyStrong" color="heading">
                {current.name}
              </AppText>
              <AppText variant="heading" color="text">
                {formatPhoneForDisplay(current.phone)}
              </AppText>
            </View>
          </View>
          <View style={{ marginTop: theme.spacing.sm }}>
            <RowNote>Guardado en este teléfono</RowNote>
          </View>
          {!formOpen ? (
            <View style={[styles.actions, { marginTop: theme.spacing.md }]}>
              <SecondaryButton label="Cambiar" icon="create-outline" onPress={() => openForm(current)} style={styles.flex} testID="assist-change" />
              <SecondaryButton
                label="Quitar"
                icon="trash-outline"
                variant="neutral"
                onPress={remove}
                loading={removing}
                style={styles.flex}
                testID="assist-remove"
              />
            </View>
          ) : null}
        </Card>
      );
    }
    if (current?.source === 'mediclaro') {
      return (
        <Card padding={theme.spacing.lg}>
          <AppText variant="captionStrong" color="textSecondary" style={styles.upper}>
            Ahora usas:
          </AppText>
          <View style={[styles.serviceRow, { marginTop: theme.spacing.xs }]} accessible accessibilityLabel={`Ahora usas: ${current.name}, ${formatPhoneForDisplay(current.phone)}`}>
            <View style={[styles.tile, { backgroundColor: c.primarySoft, borderRadius: theme.radius.sm }]}>
              <Icon name="headset" size={24} color={c.primary} />
            </View>
            <View style={styles.flex}>
              <AppText variant="bodyStrong" color="heading">
                {current.name}
              </AppText>
              <AppText variant="heading" color="text">
                {formatPhoneForDisplay(current.phone)}
              </AppText>
            </View>
          </View>
          {!formOpen ? (
            <SecondaryButton
              label="Usar otro número"
              icon="add-circle-outline"
              onPress={() => openForm()}
              style={{ marginTop: theme.spacing.md }}
              testID="assist-other"
            />
          ) : null}
        </Card>
      );
    }
    return (
      <View style={[styles.emptyBox, { borderColor: c.border, borderRadius: theme.radius.lg }]}>
        <AppText variant="heading" align="center">
          Aún no tienes un número privado de asistencia
        </AppText>
        <AppText variant="body" color="textSecondary" align="center" style={{ marginTop: theme.spacing.xxs }}>
          Añádelo aquí para poder llamarlo con el botón azul en una emergencia.
        </AppText>
      </View>
    );
  };

  const renderForm = () => (
    <Card padding={theme.spacing.lg} style={{ marginTop: theme.spacing.md }}>
      <AppText variant="subheading" color="heading" accessibilityRole="header">
        {current?.source === 'user' ? 'Cambiar tu servicio' : 'Añadir tu servicio'}
      </AppText>
      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.md }}>
        <TextField
          label="Nombre del servicio"
          value={name}
          onChangeText={setName}
          placeholder="Ej.: Mi teleasistencia"
          autoCapitalize="sentences"
          optional
        />
        <TextField
          label="Teléfono"
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            if (phoneError) setPhoneError(null);
          }}
          error={phoneError}
          hint="El número al que llamarás con el botón azul. El 112 ya está siempre disponible por separado."
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          placeholder="Ej.: 900 000 000"
        />
        {formError ? <InfoBanner tone="danger" title="No se ha podido guardar" message={formError} /> : null}
        <PrimaryButton label="Guardar" icon="checkmark" onPress={save} loading={saving} testID="assist-save" />
        {current ? <TextButton label="Cancelar" tone="muted" onPress={cancelForm} testID="assist-cancel" /> : null}
      </View>
    </Card>
  );

  return (
    <Screen keyboard header={<AppHeader fallbackHref="/emergency-profile" />}>
      <View style={[styles.hero, { marginTop: theme.spacing.xs, marginBottom: theme.spacing.lg }]}>
        <View style={[styles.heroCircle, { backgroundColor: c.primary }]}>
          <Icon name="headset" size={44} color={c.onPrimary} />
        </View>
        <AppText variant="title" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.md }}>
          Tu servicio privado de asistencia
        </AppText>
        <AppText variant="body" color="textSecondary" align="center" style={[styles.heroText, { marginTop: theme.spacing.xs }]}>
          Es el servicio que tú eliges para pedir ayuda (por ejemplo, tu teleasistencia). Es independiente del 112.
        </AppText>
      </View>

      {service.status === 'loading' ? (
        <Card padding={theme.spacing.lg}>
          <Skeleton width="35%" height={14} />
          <View style={[styles.serviceRow, { marginTop: 14 }]}>
            <Skeleton width={44} height={44} radius={12} />
            <View style={{ flex: 1, gap: 8 }}>
              <Skeleton width="60%" height={18} />
              <Skeleton width="45%" height={22} />
            </View>
          </View>
        </Card>
      ) : null}

      {service.status === 'error' ? (
        <ErrorState kind={service.error?.kind} message={service.error?.message} onRetry={() => void service.reload()} />
      ) : null}

      {notice ? <InfoBanner tone={notice.tone} message={notice.message} style={{ marginBottom: theme.spacing.md }} /> : null}

      {renderCurrent()}
      {showForm ? renderForm() : null}

      <View style={{ marginTop: theme.spacing.xl }}>
        <OfficialEmergencyNote />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  upper: { textTransform: 'uppercase', letterSpacing: 0.6 },
  hero: { alignItems: 'center' },
  heroCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  heroText: { maxWidth: 360 },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: 10 },
  emptyBox: { borderWidth: 1, borderStyle: 'dashed', padding: 20 },
});
