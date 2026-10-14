/**
 * /owner/subscriptions — Suscripciones (pantalla 7 del diseño): pestañas Activas / Historial y una tarjeta por persona
 * con el escudo verde, su plan (de pago o de regalo, y cómo se paga), el estado, la vigencia en un recuadro gris y
 * «Ver detalles». Los cobros se gestionan en App Store, Google Play o Stripe.
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { AppText, EmptyState, ErrorState, SkeletonList } from '../../components';
import { useAsync } from '../../hooks';
import { OwnerAdminService, type OwnerSubscriptionRow } from '../../services/OwnerAdminService';
import { OC, OCard, OIcon, OLink, ONote, OPill, OSegments, OT, OwnerScreen, PROVIDER_LABEL, Pager, SUB_STATE_LABEL, fmtDate } from './OwnerKit';

type Tone = 'green' | 'gray' | 'blue' | 'amber';

function stateOf(row: OwnerSubscriptionRow): { label: string; tone: Tone } {
  if (row.state === 'PAST_DUE') return { label: 'Pago pendiente', tone: 'amber' };
  if (row.state === 'TRIAL') return { label: 'En prueba', tone: 'blue' };
  if (row.state === 'ACTIVE') return row.cancelAtPeriodEnd ? { label: 'Se cancela', tone: 'amber' } : { label: 'Activa', tone: 'green' };
  return { label: SUB_STATE_LABEL[row.state] ?? row.state, tone: 'gray' };
}

/** Círculo del escudo: verde si está activa, como en el diseño. */
const ICON_COLOR: Record<Tone, { solid: string }> = {
  green: { solid: '#16A34A' },
  blue: { solid: OC.blue },
  amber: { solid: '#D97706' },
  gray: { solid: '#94A3B8' },
};

function SubscriptionCard({ row, onPress, testID }: { row: OwnerSubscriptionRow; onPress?: () => void; testID?: string }) {
  const name = row.name ?? (row.userId ? 'Sin nombre' : row.phone ?? 'Aún sin cuenta');
  const plan = row.kind === 'courtesy' ? 'Premium regalo' : `Premium · ${PROVIDER_LABEL[row.provider] ?? row.provider}`;
  const st = stateOf(row);
  const range = `${fmtDate(row.startsAt)} - ${row.endsAt ? fmtDate(row.endsAt) : 'sin fin'}`;
  const ic = ICON_COLOR[st.tone];
  return (
    <OCard style={styles.card} testID={testID} accessibilityLabel={`${name}. ${plan}. ${st.label}. Vigencia ${range}`}>
      <View style={styles.top}>
        <OIcon icon="shield-checkmark" size={42} color={ic.solid} round />
        <View style={[styles.flex, { gap: 2 }]}>
          <AppText style={OT.cardTitle} color="heading" numberOfLines={2}>{name}</AppText>
          <AppText style={[OT.label, { color: st.tone === 'gray' ? OC.gray : OC.green }]} numberOfLines={2}>{plan}</AppText>
        </View>
        <OPill label={st.label} tone={st.tone} />
      </View>
      <View style={styles.range}>
        <AppText style={OT.cardText} color="textSecondary">Vigencia</AppText>
        <AppText style={[OT.label, styles.flex]} color="heading">{range}</AppText>
      </View>
      {row.paidByFamily ? <AppText style={OT.meta} color="textSecondary">La paga un familiar</AppText> : null}
      {!row.userId && row.phone ? <AppText style={OT.meta} color="textSecondary">Se activará cuando entre con ese teléfono</AppText> : null}
      {onPress ? <OLink label="Ver detalles" onPress={onPress} underline testID={testID ? `${testID}-details` : undefined} /> : null}
    </OCard>
  );
}

export default function OwnerSubscriptionsScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<'active' | 'history'>('active');
  const [page, setPage] = useState(0);
  const data = useAsync(() => OwnerAdminService.subscriptions({ tab, page }), [tab, page]);
  useFocusEffect(
    useCallback(() => {
      if (data.status !== 'loading') void data.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const list = data.data;
  const pastDue = list?.totals?.pastDue ?? 0;
  return (
    <OwnerScreen
      title="Suscripciones"
      subtitle="Consulta el estado y la vigencia de las suscripciones."
      refreshing={data.refreshing}
      onRefresh={() => void data.refresh()}
      testID="owner-subscriptions"
    >
      <OSegments
        options={[
          { value: 'active', label: 'Activas' },
          { value: 'history', label: 'Historial' },
        ]}
        value={tab}
        onChange={(v) => {
          setPage(0);
          setTab(v);
        }}
        accessibilityLabel="Qué suscripciones ver"
      />
      {tab === 'active' && pastDue ? (
        <ONote tone="amber" testID="owner-subs-pastdue">
          {pastDue === 1 ? '1 persona tiene el pago pendiente. Su tienda o Stripe le avisa para que lo actualice.' : `${pastDue} personas tienen el pago pendiente. Su tienda o Stripe les avisa para que lo actualicen.`}
        </ONote>
      ) : null}
      {data.status === 'loading' ? <SkeletonList rows={3} /> : null}
      {data.error && !list ? <ErrorState kind={data.error.kind} message={data.error.message} onRetry={() => void data.reload()} /> : null}
      {list && !list.items.length ? <EmptyState icon="card-outline" title={tab === 'active' ? 'No hay suscripciones activas' : 'El historial está vacío'} /> : null}
      {list?.items.map((row, i) => (
        <SubscriptionCard
          key={`${row.userId ?? row.phone ?? 'x'}-${row.kind}-${i}`}
          row={row}
          testID={`owner-sub-${i}`}
          onPress={row.userId ? () => router.push({ pathname: '/owner/user', params: { id: row.userId ?? '' } } as Href) : undefined}
        />
      ))}
      {list ? <Pager page={list.page} total={list.total} pageSize={list.pageSize} onChange={setPage} /> : null}
      <ONote>Puedes conceder Premium de forma gratuita a otros usuarios desde el Dashboard (Bonos Premium). Los cobros y las cancelaciones de pago se gestionan en App Store, Google Play o Stripe.</ONote>
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  range: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap', borderWidth: 1, borderColor: OC.line, backgroundColor: '#FAFBFD', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
});
