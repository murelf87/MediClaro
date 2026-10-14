/**
 * /owner/users — Gestión de usuarios (pantalla 6 del diseño): pestañas Todos / Pacientes / Cuidadores, «Buscar
 * usuario…» y la lista con iniciales, nombre, teléfono (oculto por privacidad) y plan. La búsqueda acepta el número
 * completo. Por privacidad no se ven medicamentos, mensajes ni avisos.
 */
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { AppText, EmptyState, ErrorState, SkeletonList } from '../../components';
import { useAsync } from '../../hooks';
import { OwnerAdminService } from '../../services/OwnerAdminService';
import { OSearch, OSegments, OT, OwnerScreen, Pager, UserRow } from './OwnerKit';

type Tab = 'all' | 'patients' | 'caregivers';

export default function OwnerUsersScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      setPage(0);
      setQ(query.trim());
    }, 350);
    return () => clearTimeout(t);
  }, [query]);
  const data = useAsync(() => OwnerAdminService.users({ tab, q, page }), [tab, q, page]);
  useFocusEffect(
    useCallback(() => {
      if (data.status !== 'loading') void data.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const list = data.data;
  return (
    <OwnerScreen title="Usuarios" refreshing={data.refreshing} onRefresh={() => void data.refresh()} testID="owner-users">
      <OSegments
        options={[
          { value: 'all', label: 'Todos' },
          { value: 'patients', label: 'Pacientes' },
          { value: 'caregivers', label: 'Cuidadores' },
        ]}
        value={tab}
        onChange={(v) => {
          setPage(0);
          setTab(v);
        }}
        accessibilityLabel="Qué personas ver"
      />
      <OSearch value={query} onChangeText={setQuery} placeholder="Buscar usuario..." testID="owner-users-search" />
      {data.status === 'loading' ? <SkeletonList rows={5} /> : null}
      {data.error && !list ? <ErrorState kind={data.error.kind} message={data.error.message} onRetry={() => void data.reload()} /> : null}
      {list && !list.items.length ? <EmptyState icon="people-outline" title={q ? 'No hay nadie con esa búsqueda' : 'Todavía no hay personas aquí'} /> : null}
      {list?.items.map((u) => (
        <UserRow key={u.id} user={u} onPress={() => router.push({ pathname: '/owner/user', params: { id: u.id } } as Href)} testID={`owner-user-${u.id}`} />
      ))}
      {list ? <Pager page={list.page} total={list.total} pageSize={list.pageSize} onChange={setPage} /> : null}
      {list ? (
        <AppText style={OT.meta} color="textSecondary" accessibilityLiveRegion="polite">
          {list.total === 1 ? '1 persona' : `${list.total.toLocaleString('es-ES')} personas`} · teléfonos ocultos por privacidad
        </AppText>
      ) : null}
    </OwnerScreen>
  );
}
