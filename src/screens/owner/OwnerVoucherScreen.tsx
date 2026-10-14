/**
 * /owner/voucher?id=… — Detalle de un bono (mismo estilo que el diseño): duración, usos, a quién se ha dado y si sigue
 * activo. «Dar este bono» abre Conceder Premium con el bono elegido. Se puede desactivar y volver a activar.
 */
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AppText, Avatar, EmptyState, ErrorState, SkeletonList } from '../../components';
import { AnimatedProgressBar } from '../../components/Motion';
import { useAsync } from '../../hooks';
import { OwnerAdminService, type OwnerBonoUse } from '../../services/OwnerAdminService';
import { confirmAsync } from '../../utils/dialogs';
import { toAppError } from '../../api/errors';
import { OButton, OC, OCard, ONote, OPill, ORow, OT, OwnerScreen, bonoSubtitle, fmtDate } from './OwnerKit';
import { BonoStateBadge } from './OwnerVouchersScreen';

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

function UseRow({ use, onPress }: { use: OwnerBonoUse; onPress?: () => void }) {
  const name = use.name ?? (use.verified ? 'Sin nombre' : 'Aún sin cuenta');
  return (
    <ORow
      left={<Avatar name={name} size={40} tone={use.active ? 'primary' : 'neutral'} />}
      title={name}
      subtitle={[use.phone, `desde el ${fmtDate(use.createdAt)}`].filter(Boolean).join(' · ')}
      meta={!use.verified ? 'Se activará cuando entre con su teléfono' : use.expiresAt ? `Premium hasta el ${fmtDate(use.expiresAt)}` : 'Premium sin fecha de fin'}
      right={use.active ? <OPill label="Activo" /> : <OPill label="Terminado" tone="gray" />}
      onPress={onPress}
    />
  );
}

export default function OwnerVoucherScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[]; created?: string | string[] }>();
  const id = first(params.id);
  const created = first(params.created) === '1';
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const data = useAsync(() => OwnerAdminService.bono(id), [id], { enabled: valid });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (data.status === 'success') void data.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const bono = data.data?.bono;

  const toggle = async () => {
    if (!bono || lock.current) return;
    const enable = bono.state === 'disabled';
    if (!enable) {
      const ok = await confirmAsync({
        title: 'Desactivar el bono',
        message: 'Nadie más podrá recibirlo. Quien ya lo tiene sigue con su Premium hasta la fecha que le tocaba.',
        confirmText: 'Desactivar',
        destructive: true,
      });
      if (!ok) return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      await (enable ? OwnerAdminService.bonoEnable(bono.id) : OwnerAdminService.bonoDisable(bono.id));
      await data.refresh();
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <OwnerScreen title={bono?.name ?? 'Bono'} subtitle={bono ? bonoSubtitle(bono) : undefined} titleRight={bono ? <BonoStateBadge bono={bono} /> : undefined} refreshing={data.refreshing} onRefresh={() => void data.refresh()} testID="owner-voucher">
      {!valid ? <ErrorState kind="not_found" message="Este bono no existe." /> : null}
      {valid && data.status === 'loading' ? <SkeletonList rows={2} /> : null}
      {data.error && !bono ? <ErrorState kind={data.error.kind} message={data.error.message} onRetry={() => void data.reload()} /> : null}
      {bono ? (
        <>
          {created ? <ONote tone="green" testID="owner-voucher-created">Bono creado. Ya puedes darlo a las personas que quieras.</ONote> : null}
          <OCard style={{ gap: 8 }}>
            <View style={styles.usesRow}>
              <AppText style={OT.cardTitle} color="heading">{`Usos: ${bono.uses}/${bono.maxUses}`}</AppText>
              <AppText style={OT.meta} color="textSecondary">{`Creado el ${fmtDate(bono.createdAt)}`}</AppText>
            </View>
            <AnimatedProgressBar progress={bono.maxUses ? bono.uses / bono.maxUses : 0} height={8} color={OC.blue} accessibilityLabel={`Usado ${bono.uses} de ${bono.maxUses}`} />
            {bono.note ? <AppText style={OT.cardText} color="textSecondary">{bono.note}</AppText> : null}
            {bono.disabledAt ? <AppText style={OT.meta} color="textSecondary">{`Desactivado el ${fmtDate(bono.disabledAt)}`}</AppText> : null}
          </OCard>
          <OButton
            label="Dar este bono"
            icon="person-add"
            onPress={() => router.push({ pathname: '/owner/grant', params: { bono: bono.id } } as Href)}
            disabled={bono.state !== 'active'}
            testID="owner-voucher-give"
          />
          {bono.state === 'exhausted' ? <ONote>Este bono ya se ha dado a todas las personas previstas. Crea otro si necesitas más.</ONote> : null}
          <OButton
            label={bono.state === 'disabled' ? 'Volver a activar el bono' : 'Desactivar el bono'}
            variant="outline"
            onPress={() => void toggle()}
            loading={busy}
            disabled={busy}
            testID="owner-voucher-toggle"
          />
          {error ? <ONote tone="amber">{error}</ONote> : null}
          <AppText style={[OT.h2, styles.section]} color="heading" accessibilityRole="header">
            {`Personas con este bono (${data.data?.uses.length ?? 0})`}
          </AppText>
          {!data.data?.uses.length ? <EmptyState icon="people-outline" title="Todavía no se ha dado a nadie" /> : null}
          {data.data?.uses.map((u) => (
            <UseRow key={u.id} use={u} onPress={u.userId ? () => router.push({ pathname: '/owner/user', params: { id: u.userId ?? '' } } as Href) : undefined} />
          ))}
        </>
      ) : null}
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  usesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  section: { marginTop: 6 },
});
