/**
 * /owner/reports — «Errores notificados»: lo que las personas escriben desde «Ayuda → Notifícanos un error».
 * Pestañas «Sin resolver» / «Resueltos» / «Todos». Los nuevos llevan la etiqueta «Nuevo»; al abrir uno queda leído.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { ErrorState, SkeletonList } from '../../components';
import { useAsync } from '../../hooks';
import { OwnerAdminService, type OwnerReport } from '../../services/OwnerAdminService';
import { OIcon, ONote, OPill, ORow, OSegments, OwnerScreen, fmtDateTime } from './OwnerKit';
import { reportPlace } from './reportFormat';

type Filter = 'open' | 'resolved' | 'all';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Sin resolver' },
  { value: 'resolved', label: 'Resueltos' },
  { value: 'all', label: 'Todos' },
];

function firstLine(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return line.length > 110 ? `${line.slice(0, 107)}…` : line;
}

export default function OwnerReportsScreen() {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('open');
  const data = useAsync(() => OwnerAdminService.reports(filter), [filter]);
  useFocusEffect(
    useCallback(() => {
      if (data.status === 'success') void data.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const items = data.data?.items ?? [];
  const open = data.data?.open ?? 0;
  const fresh = data.data?.new ?? 0;

  const row = (r: OwnerReport) => {
    const who = r.user ? r.user.name ?? 'Sin nombre' : 'Sin cuenta';
    const pill =
      r.status === 'new' ? <OPill label="Nuevo" tone="blue" solid /> : r.status === 'resolved' ? <OPill label="Resuelto" tone="green" /> : null;
    return (
      <ORow
        key={r.id}
        left={<OIcon icon={r.status === 'resolved' ? 'checkmark-done' : 'chatbox-ellipses'} variant="soft" size={40} color={r.status === 'resolved' ? '#15803D' : undefined} />}
        title={firstLine(r.message)}
        subtitle={[who, reportPlace(r.context)].filter(Boolean).join(' · ')}
        meta={`${fmtDateTime(r.createdAt)} · ${r.ref}`}
        right={pill}
        onPress={() => router.push({ pathname: '/owner/report', params: { id: r.id } } as Href)}
        testID={`owner-report-${r.ref}`}
      />
    );
  };

  return (
    <OwnerScreen
      title="Errores notificados"
      subtitle={data.data ? `${open} sin resolver${fresh ? ` · ${fresh} nuevos` : ''}` : 'Lo que nos escriben desde Ayuda'}
      refreshing={data.refreshing}
      onRefresh={() => void data.refresh()}
      testID="owner-reports"
    >
      <OSegments options={FILTERS} value={filter} onChange={setFilter} accessibilityLabel="Qué mensajes ver" />
      {data.status === 'loading' ? <SkeletonList rows={4} /> : null}
      {data.error && !data.data ? <ErrorState kind={data.error.kind} message={data.error.message} onRetry={() => void data.reload()} /> : null}
      {data.data ? (
        <View style={styles.list}>
          {items.length ? (
            items.map(row)
          ) : (
            <ONote tone="green">
              {filter === 'open' ? 'No hay errores sin resolver. ¡Todo en orden!' : filter === 'resolved' ? 'Todavía no hay errores resueltos.' : 'Todavía nadie ha escrito.'}
            </ONote>
          )}
        </View>
      ) : null}
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
});
