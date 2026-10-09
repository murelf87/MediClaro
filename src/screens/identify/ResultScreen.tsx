/**
 * /result?id=<nregistro> — Resultado de la identificación (referencia 06_result).
 * Datos: último resultado en memoria (mejor coincidencia o el elegido de la lista);
 * si no está (p. ej. la app se cerró), se carga la ficha oficial por id.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  Badge,
  EmptyState,
  Icon,
  PrimaryButton,
  Screen,
  Skeleton,
  TextButton,
} from '../../components';
import { useAppTheme, useAsync } from '../../hooks';
import { MedicationService } from '../../services';
import type { Medication } from '../../types';
import { firstParam, resolveFromLastResult } from './helpers';
import { ActionTile, FavoriteButton, HeroMedicationImage, ScreenError, useNavLock } from './parts';
import { useSavedMedication } from './useSavedMedication';
import { pillPrefill } from '../pills/parts';

export default function ResultScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const navigate = useNavLock();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id);

  const [resolved] = useState(() => resolveFromLastResult(MedicationService.getLastResult(), id));
  const needsRemote = !resolved && !!id;
  const remote = useAsync(() => MedicationService.getMedication(id ?? ''), [id], { enabled: needsRemote });
  const med: Medication | null = resolved?.med ?? (needsRemote ? remote.data : null);
  const saved = useSavedMedication(med);
  const medId = med?.id ?? null;

  const loadImage = useCallback(
    () => (medId ? MedicationService.getMedicationImage(medId) : Promise.resolve(null)),
    [medId],
  );

  const header = <AppHeader right={med ? <FavoriteButton state={saved} /> : undefined} />;

  if (needsRemote && !med) {
    if (remote.status === 'error' && remote.error) {
      return (
        <Screen header={header} contentStyle={styles.grow}>
          <ScreenError
            error={remote.error}
            onRetry={remote.reload}
            notFoundTitle="No encontramos este medicamento en la base oficial"
          />
        </Screen>
      );
    }
    return (
      <Screen header={header}>
        <View style={{ gap: theme.spacing.md }} accessibilityRole="progressbar" accessibilityLabel="Cargando el medicamento">
          <Skeleton height={184} radius={theme.radius.lg} />
          <Skeleton height={48} radius={theme.radius.md} />
          <Skeleton width="80%" height={32} />
          <Skeleton width="55%" height={18} />
          <Skeleton height={theme.actionHeight} radius={theme.radius.md} />
        </View>
      </Screen>
    );
  }

  if (!med) {
    return (
      <Screen header={header} contentStyle={styles.grow}>
        <EmptyState
          icon="camera-outline"
          title="Todavía no hay ningún medicamento identificado"
          message="Haz una foto a la caja y te mostraremos su información oficial."
          action={{ label: 'Identificar un medicamento', icon: 'camera', onPress: () => router.replace('/scan') }}
        />
      </Screen>
    );
  }

  const picked = resolved?.picked ?? false;
  const openDetail = () => navigate(() => router.push({ pathname: '/medication/[id]', params: { id: med.id } }));
  const openVoice = () => navigate(() => router.push({ pathname: '/voice', params: { id: med.id, name: med.name } }));
  const openChat = () =>
    navigate(() => router.push({ pathname: '/assistant', params: { medicationId: med.id, medicationName: med.name } }));

  return (
    <Screen header={header}>
      <HeroMedicationImage uri={med.imageUrl} loadUri={loadImage} height={184} accessibilityLabel={`Envase de ${med.name}`} />

      <View style={{ marginTop: theme.spacing.md }}>
        {picked ? (
          <Badge label="Elegido por ti" tone="info" icon="checkmark-circle-outline" />
        ) : (
          <Badge label="Medicamento identificado" tone="success" icon="checkmark-circle" />
        )}
      </View>

      <AppText variant="title" accessibilityRole="header" style={{ marginTop: theme.spacing.md }}>
        {med.name}
      </AppText>
      {med.officialName && med.officialName !== med.name ? (
        <AppText variant="caption" color="textSecondary" accessibilityLabel={`Nombre oficial: ${med.officialName}`}>
          {med.officialName}
        </AppText>
      ) : null}
      <View style={{ marginTop: theme.spacing.xxs, gap: 2 }}>
        {med.pharmaceuticalForm ? (
          <AppText variant="body" color="textSecondary">
            {med.pharmaceuticalForm}
          </AppText>
        ) : null}
        {med.laboratory ? (
          <AppText variant="body" color="textSecondary">
            {med.laboratory}
          </AppText>
        ) : null}
        {med.activeIngredient ? (
          <AppText variant="body" color="textSecondary">
            {`Principio activo: ${med.activeIngredient}`}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.check, { marginTop: theme.spacing.sm }]}>
        <Icon name="eye-outline" size={20} color={c.textMuted} />
        <AppText variant="caption" color="textSecondary" style={styles.flex}>
          Comprueba que el nombre coincide con el de tu caja.
        </AppText>
      </View>

      <PrimaryButton
        label="Ver información completa"
        icon="arrow-forward"
        iconPosition="right"
        onPress={openDetail}
        style={{ marginTop: theme.spacing.lg }}
        testID="result-detail"
      />

      <View style={[styles.tiles, { marginTop: theme.spacing.md, gap: theme.spacing.sm }]}>
        <ActionTile icon="volume-high" iconColor={c.primary} label="Leer en voz alta" onPress={openVoice} testID="result-voice" />
        <ActionTile icon="chatbubble-ellipses" iconColor={c.primary} label="Preguntar a la IA" onPress={openChat} testID="result-chat" />
        <ActionTile
          icon={saved.saved ? 'star' : 'star-outline'}
          iconColor={c.favorite}
          label={saved.saved ? 'Guardado' : 'Guardar'}
          active={saved.saved}
          disabled={!saved.known}
          onPress={() => void saved.toggleSaved()}
          accessibilityLabel={saved.saved ? 'Guardado en Mis medicamentos' : 'Guardar en Mis medicamentos'}
          accessibilityHint={saved.saved ? 'Toca para quitarlo de tu lista' : 'Lo añade a Mis medicamentos'}
          testID="result-save"
        />
      </View>

      <TextButton
        label="Añadir a Mis pastillas (avisos)"
        icon="alarm-outline"
        onPress={() => navigate(() => router.push({ pathname: '/pills/edit', params: { medicineId: med.id, ...pillPrefill(med.name), source: 'photo' } }))}
        testID="result-add-pills"
      />

      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.xxs }}>
        {resolved?.hasAlternatives ? (
          <TextButton label="¿No es este? Ver otros parecidos" icon="list-outline" onPress={() => navigate(() => router.push('/candidates'))} />
        ) : null}
        <TextButton label="Identificar otro medicamento" icon="camera-outline" onPress={() => router.replace('/scan')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  grow: { flexGrow: 1 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tiles: { flexDirection: 'row', alignItems: 'stretch' },
});
