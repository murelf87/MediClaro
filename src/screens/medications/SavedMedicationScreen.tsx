/**
 * Detalle de medicamento guardado (/saved/<id>).
 * Foto del envase, datos básicos, favorito y accesos a ficha, voz y asistente.
 * "Quitar de mis medicamentos" pide confirmación y vuelve a la lista.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  EmptyState,
  ErrorState,
  IconButton,
  ListGroup,
  MedicationImage,
  Screen,
  SecondaryButton,
  SettingRow,
  Skeleton,
} from '../../components';
import { useAppTheme, useAsync, useRefreshOnFocus } from '../../hooks';
import { MedicationService, isAppError } from '../../services';
import { confirmAsync, showAlert } from '../../utils/dialogs';
import { formatDateLong } from '../../utils/format';
import { firstParam, isValidMedicationId } from './parts';

export default function SavedMedicationScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = firstParam(params.id) ?? '';
  const validId = isValidMedicationId(id);

  const state = useAsync(
    () => (validId ? MedicationService.getSavedMedication(id) : Promise.resolve(null)),
    [id],
    { isEmpty: (med) => med === null },
  );
  const { refresh, reload, setData } = state;
  useRefreshOnFocus(refresh);

  const [favoritePending, setFavoritePending] = useState(false);
  const [removing, setRemoving] = useState(false);
  const loadImage = useCallback(() => MedicationService.getMedicationImage(id), [id]);

  const med = state.status === 'success' ? state.data : null;
  const isFavorite = !!med?.isFavorite;

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/medicines');
  }, [router]);

  const setFavorite = useCallback(
    async (value: boolean) => {
      if (!med || favoritePending) return;
      setFavoritePending(true);
      setData((prev) => (prev ? { ...prev, isFavorite: value } : prev));
      try {
        await MedicationService.setFavorite(med.id, value);
      } catch (e) {
        setData((prev) => (prev ? { ...prev, isFavorite: !value } : prev));
        void showAlert(
          'No se ha podido guardar el cambio',
          isAppError(e) ? e.message : 'Inténtalo de nuevo en un momento.',
        );
      } finally {
        setFavoritePending(false);
      }
    },
    [med, favoritePending, setData],
  );

  const remove = useCallback(async () => {
    if (!med || removing) return;
    const ok = await confirmAsync({
      title: '¿Quitar este medicamento?',
      message: `«${med.name}» dejará de aparecer en «Mis medicamentos». Podrás volver a guardarlo cuando lo identifiques.`,
      confirmText: 'Quitar',
      cancelText: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    setRemoving(true);
    try {
      await MedicationService.removeMedication(med.id);
      goBack();
    } catch (e) {
      setRemoving(false);
      void showAlert('No se ha podido quitar', isAppError(e) ? e.message : 'Inténtalo de nuevo en un momento.');
    }
  }, [med, removing, goBack]);

  const openSheet = () => router.push(`/medication/${id}`);

  const header = (
    <AppHeader
      title="Mi medicamento"
      fallbackHref="/(tabs)/medicines"
      right={
        med ? (
          <IconButton
            icon={isFavorite ? 'star' : 'star-outline'}
            color={isFavorite ? c.favorite : c.heading}
            selected={isFavorite}
            accessibilityLabel={isFavorite ? 'Quitar de favoritos' : 'Marcar como favorito'}
            onPress={() => void setFavorite(!isFavorite)}
            testID="saved-favorite"
          />
        ) : null
      }
    />
  );

  if (state.status === 'loading') {
    return (
      <Screen header={header}>
        <View style={{ gap: theme.spacing.md }} accessibilityLabel="Cargando" accessibilityRole="progressbar">
          <Skeleton height={190} radius={theme.radius.lg} />
          <Skeleton width="80%" height={30} />
          <Skeleton width="50%" height={18} />
          <Skeleton width="65%" height={18} />
          <Skeleton height={220} radius={theme.radius.lg} style={{ marginTop: theme.spacing.sm }} />
        </View>
      </Screen>
    );
  }

  if (state.status === 'error') {
    return (
      <Screen header={header}>
        <ErrorState kind={state.error?.kind} message={state.error?.message} onRetry={reload} />
      </Screen>
    );
  }

  if (!med) {
    return (
      <Screen header={header}>
        <EmptyState
          icon="folder-open-outline"
          title="Este medicamento ya no está en tu lista"
          message={
            validId
              ? 'Puede que lo hayas quitado. Puedes ver su ficha oficial o volver atrás.'
              : 'No hemos encontrado este medicamento.'
          }
          action={validId ? { label: 'Ver ficha', icon: 'document-text-outline', onPress: openSheet } : undefined}
          secondaryAction={{ label: 'Volver', onPress: goBack }}
        />
      </Screen>
    );
  }

  return (
    <Screen header={header}>
      <MedicationImage
        uri={med.imageUrl}
        loadUri={loadImage}
        width="100%"
        height={190}
        radius={theme.radius.lg}
        accessibilityLabel={`Envase de ${med.name}`}
      />

      <View style={[styles.info, { marginTop: theme.spacing.lg }]}>
        <AppText variant="title" accessibilityRole="header">
          {med.name}
        </AppText>
        {med.officialName && med.officialName !== med.name ? (
          <AppText variant="caption" color="textSecondary" accessibilityLabel={`Nombre oficial: ${med.officialName}`}>
            {med.officialName}
          </AppText>
        ) : null}
        {med.pharmaceuticalForm ? (
          <AppText variant="body" color="textSecondary">
            {med.pharmaceuticalForm}
          </AppText>
        ) : null}
        {med.activeIngredient ? (
          <AppText variant="body" color="text">
            {'Principio activo: '}
            <AppText variant="bodyStrong" color="heading">
              {med.activeIngredient}
            </AppText>
          </AppText>
        ) : null}
        {med.savedAt ? (
          <AppText variant="caption" color="textMuted" style={{ marginTop: theme.spacing.xxs }}>
            {`Guardado el ${formatDateLong(med.savedAt)}`}
          </AppText>
        ) : null}
      </View>

      <ListGroup style={{ marginTop: theme.spacing.xl }}>
        <SettingRow
          icon={isFavorite ? 'star' : 'star-outline'}
          iconColor={c.favorite}
          label="Favorito"
          description={isFavorite ? 'Aparece en tus favoritos' : 'Márcalo para encontrarlo antes'}
          toggle={{ value: isFavorite, onChange: (v) => void setFavorite(v), disabled: favoritePending }}
          testID="saved-favorite-toggle"
        />
        <SettingRow
          icon="document-text-outline"
          iconColor={c.primary}
          label="Ver ficha completa"
          description="Información oficial explicada de forma sencilla"
          onPress={openSheet}
        />
        <SettingRow
          icon="volume-high-outline"
          iconColor={c.primary}
          label="Leer en voz alta"
          onPress={() => router.push({ pathname: '/voice', params: { id: med.id, name: med.name } })}
        />
        <SettingRow
          icon="chatbubble-ellipses-outline"
          iconColor={c.ai}
          label="Preguntar a la IA"
          onPress={() =>
            router.push({ pathname: '/assistant', params: { medicationId: med.id, medicationName: med.name } })
          }
        />
      </ListGroup>

      <SecondaryButton
        label="Quitar de mis medicamentos"
        variant="dangerOutline"
        onPress={() => void remove()}
        loading={removing}
        style={{ marginTop: theme.spacing.xl }}
        testID="saved-remove"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  info: { gap: 4 },
});
