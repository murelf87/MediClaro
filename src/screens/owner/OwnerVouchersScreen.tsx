/**
 * /owner/vouchers — Bonos Premium gratuitos (pantalla 3 del diseño): «Crear nuevo bono» y «Mis bonos» con su tipo,
 * duración, estado y usos. Un bono lo da el propietario desde el panel a cada persona: nadie escribe códigos en la app
 * (norma 3.1.1 de Apple).
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { AppText, EmptyState, ErrorState, SkeletonList } from '../../components';
import { useAsync } from '../../hooks';
import { OwnerAdminService, type OwnerBono } from '../../services/OwnerAdminService';
import { OButton, OIcon, OLink, OPill, ORow, OT, OwnerScreen, Pager, bonoKind, bonoSubtitle } from './OwnerKit';

export function BonoStateBadge({ bono }: { bono: OwnerBono }) {
  return bono.state === 'active' ? <OPill label="Activo" /> : bono.state === 'exhausted' ? <OPill label="Agotado" tone="gray" /> : <OPill label="Desactivado" tone="amber" />;
}

/** Fila de un bono como en el diseño: regalo (o familia) azul, nombre, «Premium completo · 30 días», estado y «Usos: 2/5». */
export function BonoRow({ bono, onPress, testID }: { bono: OwnerBono; onPress?: () => void; testID?: string }) {
  const sub = bonoSubtitle(bono);
  return (
    <ORow
      left={<OIcon icon={bonoKind(bono.name) === 'family' ? 'people' : 'gift'} variant="plain" size={36} />}
      title={bono.name}
      subtitle={sub}
      right={
        <View style={styles.rightCol}>
          <BonoStateBadge bono={bono} />
          <AppText style={OT.meta} color="textSecondary">{`Usos: ${bono.uses}/${bono.maxUses}`}</AppText>
        </View>
      }
      onPress={onPress}
      testID={testID}
      accessibilityLabel={`${bono.name}. ${sub}. Usado ${bono.uses} de ${bono.maxUses}.`}
    />
  );
}

export default function OwnerVouchersScreen() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const data = useAsync(() => OwnerAdminService.bonos({ state: 'all', page }), [page]);
  useFocusEffect(
    useCallback(() => {
      if (data.status !== 'loading') void data.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const list = data.data;
  return (
    <OwnerScreen
      title="Bonos Premium gratuitos"
      subtitle="Crea bonos para regalar acceso a MediClaro Premium. Puedes definir la duración y el número de usos."
      refreshing={data.refreshing}
      onRefresh={() => void data.refresh()}
      testID="owner-vouchers"
    >
      <OButton label="Crear nuevo bono" onPress={() => router.push('/owner/voucher-new' as Href)} testID="owner-voucher-create" />
      <OLink label="Conceder Premium a un usuario" onPress={() => router.push('/owner/grant' as Href)} testID="owner-open-grant" />
      <AppText style={[OT.h2, styles.section]} color="heading" accessibilityRole="header">Mis bonos</AppText>
      {data.status === 'loading' ? <SkeletonList rows={3} /> : null}
      {data.error && !list ? <ErrorState kind={data.error.kind} message={data.error.message} onRetry={() => void data.reload()} /> : null}
      {list && !list.items.length ? (
        <EmptyState icon="gift-outline" title="Aún no has creado bonos" message="Por ejemplo, 30 días de Premium para 5 personas de una familia o de una asociación." />
      ) : null}
      {list?.items.map((b) => (
        <BonoRow key={b.id} bono={b} onPress={() => router.push({ pathname: '/owner/voucher', params: { id: b.id } } as Href)} testID={`owner-voucher-${b.id}`} />
      ))}
      {list ? <Pager page={list.page} total={list.total} pageSize={list.pageSize} onChange={setPage} /> : null}
      {list && list.items.length ? (
        <AppText style={OT.meta} color="textSecondary">{`${list.activeCount} activos · ${list.usesLeft} ${list.usesLeft === 1 ? 'uso libre' : 'usos libres'}`}</AppText>
      ) : null}
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 6 },
  rightCol: { alignItems: 'flex-end', gap: 6 },
});
