/**
 * 10 · Mis medicamentos (pestaña) — referencia 10_medicines.
 * Título + botón "+" · buscador local (nombre / principio activo) · Todos | Favoritos
 * · tarjetas con estrella de favorito · acceso al historial de identificaciones.
 */
import { useCallback, useRef, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ActionRow,
  AppText,
  EmptyState,
  ErrorState,
  IconButton,
  InfoBanner,
  MedicationCard,
  MedicineBoxArt,
  Screen,
  SegmentedControl,
  SkeletonList,
} from '../../components';
import { useAppTheme, useAsync, useEntitlement, useRefreshOnFocus } from '../../hooks';
import { MedicationService, isAppError } from '../../services';
import { showAlert } from '../../utils/dialogs';
import type { SavedMedication } from '../../types';
import { SearchField, matchesQuery } from './parts';

type Filter = 'all' | 'favorites';

export default function MedicinesScreen() {
  const entitlement = useEntitlement();
  // Sin Premium la lista se puede ver (son sus datos), pero el detalle y añadir son de Premium.
  const locked = entitlement.required && entitlement.status === 'ready' && !entitlement.isPremium;
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;

  const saved = useAsync(() => MedicationService.getSavedMedications(), [], {
    isEmpty: (list) => list.length === 0,
  });
  const { refresh, reload, setData } = saved;
  useRefreshOnFocus(refresh);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [pulling, setPulling] = useState(false);
  const pendingFavorites = useRef(new Set<string>());
  // Un cargador estable por medicamento: evita que la imagen se reinicie en cada render.
  const imageLoaders = useRef(new Map<string, () => Promise<string | null>>());

  const imageLoader = useCallback((id: string) => {
    let loader = imageLoaders.current.get(id);
    if (!loader) {
      loader = () => MedicationService.getMedicationImage(id);
      imageLoaders.current.set(id, loader);
    }
    return loader;
  }, []);

  const onPullRefresh = useCallback(async () => {
    setPulling(true);
    try {
      await refresh();
    } finally {
      setPulling(false);
    }
  }, [refresh]);

  const toggleFavorite = useCallback(
    async (med: SavedMedication) => {
      if (pendingFavorites.current.has(med.id)) return;
      pendingFavorites.current.add(med.id);
      const next = !med.isFavorite;
      const apply = (value: boolean) =>
        setData((prev) => (prev ?? []).map((m) => (m.id === med.id ? { ...m, isFavorite: value } : m)));
      apply(next);
      try {
        await MedicationService.setFavorite(med.id, next);
      } catch (e) {
        apply(!next);
        void showAlert(
          'No se ha podido guardar el cambio',
          isAppError(e) ? e.message : 'Inténtalo de nuevo en un momento.',
        );
      } finally {
        pendingFavorites.current.delete(med.id);
      }
    },
    [setData],
  );

  const list = saved.data ?? [];
  const favoritesCount = list.filter((m) => m.isFavorite).length;
  const trimmedQuery = query.trim();
  const visible = list.filter((m) => (filter === 'all' || m.isFavorite) && matchesQuery(m, trimmedQuery));
  // Si dos guardados tienen el mismo nombre corto (p. ej. dos marcas de «Paracetamol 1 g»),
  // se muestra su nombre oficial debajo para distinguirlos.
  const repeatedNames = new Set(list.map((m) => m.name).filter((n, i, all) => all.indexOf(n) !== i));
  const canRefresh = saved.status === 'success' || saved.status === 'empty';

  const renderContent = () => {
    if (saved.status === 'loading') {
      return (
        <View style={{ gap: theme.spacing.md }}>
          <SkeletonList rows={4} />
        </View>
      );
    }
    if (saved.status === 'error') {
      return (
        <ErrorState kind={saved.error?.kind} message={saved.error?.message} onRetry={reload} />
      );
    }
    if (saved.status === 'empty') {
      return (
        <EmptyState
          illustration={
            <View style={[styles.art, { backgroundColor: c.primaryTint }]}>
              <MedicineBoxArt width={132} height={99} />
            </View>
          }
          title="Aún no tienes medicamentos guardados"
          message="Cuando identifiques uno, pulsa «Guardar» y aparecerá aquí."
          action={{ label: 'Identificar un medicamento', icon: 'camera', onPress: () => router.push('/scan') }}
          secondaryAction={{ label: 'Ver historial', onPress: () => router.push('/history') }}
        />
      );
    }

    return (
      <View style={{ gap: theme.spacing.md }}>
        <SearchField value={query} onChangeText={setQuery} />
        <SegmentedControl<Filter>
          options={[
            { value: 'all', label: `Todos (${list.length})` },
            { value: 'favorites', label: `Favoritos (${favoritesCount})` },
          ]}
          value={filter}
          onChange={setFilter}
          accessibilityLabel="Qué medicamentos mostrar"
        />

        {saved.error ? (
          <InfoBanner
            tone="warning"
            title="No hemos podido actualizar tu lista"
            message={saved.error.message}
            action={{ label: 'Reintentar', onPress: () => void onPullRefresh() }}
          />
        ) : null}

        {visible.length > 0 ? (
          <View style={{ gap: theme.spacing.sm }} accessibilityRole="list">
            {visible.map((med) => (
              <View
                key={med.id}
                style={[
                  styles.cardWrap,
                  { borderColor: c.border, backgroundColor: c.surface, borderRadius: theme.radius.md },
                  theme.shadow.card,
                ]}
              >
                <MedicationCard
                  name={med.name}
                  subtitle={repeatedNames.has(med.name) && med.officialName ? med.officialName : med.pharmaceuticalForm ?? med.activeIngredient}
                  imageUrl={med.imageUrl}
                  loadImage={imageLoader(med.id)}
                  favorite={med.isFavorite}
                  onToggleFavorite={() => void toggleFavorite(med)}
                  onPress={() => router.push(`/saved/${med.id}`)}
                  testID={`med-${med.id}`}
                />
              </View>
            ))}
          </View>
        ) : trimmedQuery ? (
          <EmptyState
            icon="search-outline"
            title={`No hay resultados para «${trimmedQuery}»`}
            message={
              filter === 'favorites'
                ? 'Solo estás viendo tus favoritos. Prueba con otro nombre o en «Todos».'
                : 'Prueba con otro nombre o con el principio activo.'
            }
            secondaryAction={{ label: 'Borrar búsqueda', onPress: () => setQuery('') }}
          />
        ) : (
          <EmptyState
            icon="star-outline"
            title="Aún no tienes favoritos"
            message="Pulsa la estrella ☆ de un medicamento para tenerlo siempre a mano en esta lista."
            secondaryAction={{ label: 'Ver todos', onPress: () => setFilter('all') }}
          />
        )}

        <View style={{ marginTop: theme.spacing.xs }}>
          <ActionRow
            icon="time"
            label="Historial de identificaciones"
            tone="info"
            onPress={() => router.push('/history')}
            testID="medicines-history"
          />
        </View>
      </View>
    );
  };

  return (
    <Screen
      edges={['top']}
      refreshControl={
        canRefresh ? (
          <RefreshControl refreshing={pulling} onRefresh={onPullRefresh} tintColor={c.primary} colors={[c.primary]} />
        ) : undefined
      }
    >
      <View style={[styles.header, { marginTop: theme.spacing.md, marginBottom: theme.spacing.lg }]}>
        <AppText variant="title" accessibilityRole="header" style={styles.title}>
          Mis medicamentos
        </AppText>
        <IconButton
          icon="add"
          variant="solid"
          size={30}
          accessibilityLabel="Añadir medicamento"
          onPress={() => router.push('/add-medication')}
          testID="medicines-add"
        />
      </View>
      {locked ? (
        <InfoBanner
          tone="info"
          icon="lock-closed"
          title="Tu lista sigue guardada"
          message="Con MediClaro Premium puedes ver la información de cada medicamento, escuchar su prospecto y añadir más."
          action={{ label: 'Ver planes', onPress: () => router.push('/premium') }}
          style={{ marginBottom: theme.spacing.md }}
        />
      ) : null}
      <ActionRow
        icon="alarm"
        label="Mis pastillas"
        sublabel="Avisos a su hora y registro de tus tomas"
        tone="primary"
        locked={locked}
        onPress={() => router.push('/pills')}
        testID="medicines-pills"
      />
      <View style={{ height: theme.spacing.md }} />
      {MedicationService.isUsingCachedData('saved') && saved.data ? (
        <InfoBanner tone="warning" message="No hay conexión. Estás viendo la última lista guardada en este teléfono." action={{ label: 'Reintentar', onPress: () => void refresh() }} />
      ) : null}
      {renderContent()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1 },
  cardWrap: { borderWidth: 1 },
  art: { width: 168, height: 168, borderRadius: 84, alignItems: 'center', justifyContent: 'center' },
});
