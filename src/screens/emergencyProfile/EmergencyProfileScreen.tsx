/**
 * 11 (emergencia) · Mi perfil de emergencia (referencia: e11_profile).
 * La información que se compartirá si la persona pide ayuda en una emergencia.
 */
import { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Screen,
  AppHeader,
  AppText,
  EmptyState,
  ErrorState,
  Icon,
  IconButton,
  InfoBanner,
  ListGroup,
  SettingRow,
  TextButton,
} from '../../components';
import { useAppTheme, useAsync, useRefreshOnFocus } from '../../hooks';
import { EmergencyService } from '../../services';
import { callPhone, openAddressInMaps } from '../../utils/device';
import { confirmAsync, showAlert } from '../../utils/dialogs';
import { formatDateShort, formatPhoneForDisplay } from '../../utils/format';
import {
  IconLine,
  InfoRow,
  MiniMap,
  ProfileSkeleton,
  RowNote,
  ScreenTitle,
  SectionCard,
  displayBloodType,
  splitList,
} from './parts';

export default function EmergencyProfileScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const profile = useAsync(() => EmergencyService.getEmergencyProfile(), [], { isEmpty: (p) => p.source === 'empty' });
  useRefreshOnFocus(profile.refresh);
  const [medsOpen, setMedsOpen] = useState(false);

  const goEdit = () => router.push('/emergency-profile-edit');
  const [deleting, setDeleting] = useState(false);

  /** Derecho de supresión: borrar los datos de salud sin eliminar la cuenta. */
  const deleteProfile = async () => {
    if (deleting) return;
    const ok = await confirmAsync({
      title: '¿Borrar tu perfil de emergencia?',
      message:
        'Se borrarán tus datos personales y médicos de emergencia de MediClaro y de este teléfono. Tu cuenta, tus medicamentos y tu número privado de asistencia se conservan.',
      confirmText: 'Borrar perfil',
      cancelText: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await EmergencyService.deleteEmergencyProfile();
      await showAlert('Perfil borrado', 'Hemos borrado tu perfil de emergencia. Puedes crearlo de nuevo cuando quieras.');
      void profile.reload();
    } catch (e) {
      await showAlert('No hemos podido borrarlo', (e as { message?: string } | null)?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setDeleting(false);
    }
  };

  const call = async (phone: string, who: string) => {
    const ok = await callPhone(phone);
    if (!ok) await showAlert('No se ha podido llamar', `Marca el ${formatPhoneForDisplay(phone)} para llamar a ${who}.`);
  };

  const openMap = async (address: string) => {
    const ok = await openAddressInMaps(address);
    if (!ok) await showAlert('No se ha podido abrir el mapa', address);
  };

  const header = (
    <AppHeader right={<TextButton label="Editar" icon="create-outline" onPress={goEdit} testID="profile-edit" />} />
  );

  const renderProfile = () => {
    const p = profile.data;
    if (!p) return null;
    const meds = splitList(p.currentMedications);
    const cityLine = [p.postalCode, p.city].filter(Boolean).join(' ');
    const extraLine = [
      p.province && p.province.trim().toLowerCase() !== p.city.trim().toLowerCase() ? p.province : '',
      p.country && p.country !== 'España' ? p.country : '',
    ]
      .filter(Boolean)
      .join(', ');
    const hasAddress = !!(p.address.trim() || cityLine);
    const fullAddress = [p.address, cityLine, p.province, p.country].filter((s) => s && s.trim()).join(', ');
    const doctorName = p.primaryDoctorName.trim();
    const doctorPhone = p.primaryDoctorPhone.trim();
    const contact = p.caregiver;
    const contactText = contact
      ? contact.relationship.trim()
        ? `${contact.name} (${contact.relationship.trim()})`
        : contact.name
      : 'Sin indicar';
    const blood = displayBloodType(p.bloodType);
    const mapWidth = theme.fontSize === 'muy_grande' ? 92 : 118;

    return (
      <View style={{ gap: theme.spacing.md }}>
        {p.source === 'cache' ? (
          <InfoBanner
            tone="neutral"
            icon="cloud-offline-outline"
            message="Mostrando la última copia guardada en este teléfono."
          />
        ) : null}

        <SectionCard title="Datos personales">
          <IconLine icon="person">{p.fullName.trim() || 'Nombre sin indicar'}</IconLine>
          <IconLine icon="calendar" muted={p.age === null}>
            {p.age !== null ? `${p.age} años (${formatDateShort(p.dateOfBirth)})` : 'Fecha de nacimiento sin indicar'}
          </IconLine>
          {p.phone ? (
            <IconLine icon="call" accessibilityLabel={`Teléfono: ${formatPhoneForDisplay(p.phone)}`}>
              {formatPhoneForDisplay(p.phone)}
            </IconLine>
          ) : null}
        </SectionCard>

        <SectionCard title="Dirección">
          {hasAddress ? (
            <>
              <View style={styles.addressRow}>
                <View style={styles.addressText} accessible accessibilityLabel={`Dirección: ${fullAddress}`}>
                  <Icon name="location" size={26} color={c.danger} />
                  <View style={styles.flex}>
                    {p.address.trim() ? (
                      <AppText variant="body" color="text">
                        {p.address}
                      </AppText>
                    ) : null}
                    {cityLine ? (
                      <AppText variant="body" color="text">
                        {cityLine}
                      </AppText>
                    ) : null}
                    {extraLine ? (
                      <AppText variant="body" color="textSecondary">
                        {extraLine}
                      </AppText>
                    ) : null}
                  </View>
                </View>
                <Pressable
                  onPress={() => openMap(fullAddress)}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  style={({ pressed }) => [styles.map, { borderRadius: theme.radius.sm, opacity: pressed ? 0.8 : 1 }]}
                >
                  <MiniMap width={mapWidth} height={Math.round((mapWidth * 84) / 118)} />
                </Pressable>
              </View>
              <TextButton
                label="Ver en el mapa"
                icon="map-outline"
                align="flex-start"
                onPress={() => openMap(fullAddress)}
                accessibilityHint="Abre la dirección en la app de mapas"
                style={styles.mapLink}
                testID="profile-map"
              />
            </>
          ) : (
            <IconLine icon="location" iconColor={c.danger} muted>
              Dirección sin indicar
            </IconLine>
          )}
        </SectionCard>

        <SectionCard title="Información médica">
          <InfoRow
            icon="medkit"
            label="Medicamentos habituales"
            value={meds.length ? String(meds.length) : 'Sin indicar'}
            muted={!meds.length}
            onPress={meds.length ? () => setMedsOpen((o) => !o) : undefined}
            expanded={medsOpen}
            accessibilityHint={medsOpen ? 'Oculta la lista de medicamentos' : 'Muestra la lista de medicamentos'}
            testID="profile-meds"
          />
          {medsOpen ? (
            <View style={[styles.medList, { borderColor: c.divider }]}>
              {meds.map((m, i) => (
                <View key={`${m}-${i}`} style={styles.medItem}>
                  <View style={[styles.medDot, { backgroundColor: c.danger }]} />
                  <AppText variant="body" color="text" style={styles.flex}>
                    {m}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
          <InfoRow icon="alert-circle" label="Alergias" value={p.allergies.trim() || 'Sin indicar'} muted={!p.allergies.trim()} />
          <InfoRow
            icon="shield"
            label="Enfermedades relevantes"
            value={p.medicalConditions.trim() || 'Sin indicar'}
            muted={!p.medicalConditions.trim()}
          />
          <InfoRow icon="water" label="Grupo sanguíneo" value={blood || 'Sin indicar'} muted={!blood} />
          <View style={{ gap: 6 }}>
            <InfoRow
              icon="person"
              label="Médico de cabecera"
              value={doctorName || (doctorPhone ? formatPhoneForDisplay(doctorPhone) : 'Sin indicar')}
              muted={!doctorName && !doctorPhone}
              stacked
              right={
                doctorPhone ? (
                  <IconButton
                    icon="call"
                    variant="tonal"
                    color="primary"
                    size={22}
                    accessibilityLabel={`Llamar a ${doctorName || 'tu médico de cabecera'}`}
                    onPress={() => call(doctorPhone, doctorName || 'tu médico')}
                    testID="profile-call-doctor"
                  />
                ) : null
              }
            />
            {doctorName || doctorPhone ? <RowNote>Guardado solo en este teléfono</RowNote> : null}
          </View>
          <InfoRow
            icon="people"
            label="Contacto de emergencia"
            value={contactText}
            muted={!contact}
            stacked
            right={
              contact?.phone.trim() ? (
                <IconButton
                  icon="call"
                  variant="tonal"
                  color="primary"
                  size={22}
                  accessibilityLabel={`Llamar a ${contact.name}`}
                  onPress={() => call(contact.phone, contact.name)}
                  testID="profile-call-contact"
                />
              ) : null
            }
          />
        </SectionCard>
      </View>
    );
  };

  return (
    <Screen
      background="surfaceAlt"
      header={header}
      refreshControl={
        profile.status === 'success' || profile.status === 'empty' ? (
          <RefreshControl
            refreshing={profile.refreshing}
            onRefresh={() => void profile.refresh()}
            tintColor={c.primary}
            colors={[c.primary]}
          />
        ) : undefined
      }
    >
      <ScreenTitle>Mi perfil de emergencia</ScreenTitle>
      <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing.xs, marginBottom: theme.spacing.md }}>
        Esta es la información que se compartirá si pides ayuda en una emergencia.
      </AppText>

      {profile.status === 'loading' ? <ProfileSkeleton /> : null}

      {profile.status === 'error' ? (
        <ErrorState kind={profile.error?.kind} message={profile.error?.message} onRetry={() => void profile.reload()} />
      ) : null}

      {profile.status === 'empty' ? (
        <View style={[styles.emptyBox, { backgroundColor: c.surface, borderColor: c.border, borderRadius: theme.radius.lg }]}>
          <EmptyState
            icon="medkit-outline"
            title="Aún no has preparado tu perfil de emergencia"
            message="Añade tus datos, tu dirección y tu información médica. Así podrán ayudarte mejor si pides ayuda."
            action={{ label: 'Crear mi perfil', onPress: goEdit, icon: 'add-circle-outline' }}
          />
        </View>
      ) : null}

      {profile.status === 'success' ? renderProfile() : null}

      {profile.status === 'success' || profile.status === 'empty' ? (
        <ListGroup style={{ marginTop: theme.spacing.lg }}>
          <SettingRow
            icon="options-outline"
            label="Qué compartir en una emergencia"
            description="Elige qué datos se envían"
            onPress={() => router.push('/emergency-sharing')}
            testID="profile-sharing"
          />
          <SettingRow
            icon="headset-outline"
            label="Número privado de asistencia"
            description="Tu teleasistencia u otro servicio"
            onPress={() => router.push('/private-assistance')}
            testID="profile-assistance"
          />
        </ListGroup>
      ) : null}

      {profile.status === 'success' ? (
        <ListGroup style={{ marginTop: theme.spacing.md }}>
          <SettingRow
            icon="trash-outline"
            label="Borrar mi perfil de emergencia"
            destructive
            onPress={() => void deleteProfile()}
            right={deleting ? <ActivityIndicator color={c.danger} /> : undefined}
            showChevron={false}
            testID="profile-delete"
          />
        </ListGroup>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  addressText: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  map: { overflow: 'hidden' },
  // Alinea el enlace con el texto de la dirección (el botón ya tiene 8 px de margen interno)
  mapLink: { marginLeft: 28, marginTop: -4 },
  medList: { marginLeft: 36, gap: 6, paddingLeft: 12, borderLeftWidth: 2, marginTop: -4, marginBottom: 2 },
  medItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  medDot: { width: 6, height: 6, borderRadius: 3 },
  emptyBox: { borderWidth: 1, paddingHorizontal: 12 },
});
