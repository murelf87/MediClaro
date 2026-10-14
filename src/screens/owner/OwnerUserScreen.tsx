/**
 * /owner/user?id=… — Ficha de una persona (mismo estilo que el diseño): plan y cobro, Premium de regalo, vínculos y
 * uso de los últimos 30 días (solo totales). Acciones: conceder Premium y retirar el de regalo. Abrir la ficha queda
 * en el registro. Sin medicamentos, conversaciones, ubicaciones ni avisos de salud.
 */
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { AppText, Avatar, ErrorState, SkeletonList, type IconName } from '../../components';
import { useAsync } from '../../hooks';
import { OwnerAdminService, type OwnerUserDetail } from '../../services/OwnerAdminService';
import { confirmAsync } from '../../utils/dialogs';
import { toAppError } from '../../api/errors';
import { Grid, OButton, OCard, OIcon, OKpi, ONote, ORow, OT, OwnerScreen, PROVIDER_LABEL, PlanBadge, SUB_STATE_LABEL, fmtDate, fmtDateTime, useNarrow } from './OwnerKit';

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

type PlanLine = { icon: IconName; label: string; value?: string; description?: string };

function planRows(d: OwnerUserDetail): PlanLine[] {
  const u = d.user;
  const rows: PlanLine[] = [];
  if (u.plan === 'owner') rows.push({ icon: 'shield-checkmark', label: 'Propietario', value: 'Premium vitalicio' });
  if (u.subState && u.subState !== 'FREE') {
    rows.push({
      icon: 'card',
      label: `Suscripción · ${PROVIDER_LABEL[u.provider] ?? u.provider}`,
      value: SUB_STATE_LABEL[u.subState] ?? u.subState,
      description:
        [
          u.periodEnd ? `${u.cancelAtPeriodEnd ? 'Termina' : u.provider === 'bizum' ? 'Pagado hasta' : 'Se renueva'} el ${fmtDate(u.periodEnd)}` : null,
          u.paidByFamily ? 'La paga un familiar' : null,
        ]
          .filter(Boolean)
          .join(' · ') || undefined,
    });
  }
  if (d.store) {
    rows.push({
      icon: d.store.platform === 'apple' ? 'logo-apple' : 'logo-google-playstore',
      label: d.store.platform === 'apple' ? 'Compra en App Store' : 'Compra en Google Play',
      value: d.store.status,
      description: `${d.store.expiresAt ? `Hasta el ${fmtDate(d.store.expiresAt)}` : 'Sin fecha'}${d.store.autoRenew === false ? ' · sin renovación' : ''}`,
    });
  }
  if (u.courtesy) {
    rows.push({
      icon: 'gift',
      label: 'Premium de regalo',
      value: u.courtesyUntil ? `Hasta el ${fmtDate(u.courtesyUntil)}` : 'Sin fecha de fin',
      description: d.lastBono ? `Bono «${d.lastBono.name}» (${fmtDate(d.lastBono.grantedAt)})` : 'Concedido desde el panel',
    });
  }
  if (!rows.length) rows.push({ icon: 'person', label: 'Plan Básico', value: 'Sin Premium' });
  return rows;
}

export default function OwnerUserScreen() {
  const router = useRouter();
  const narrow = useNarrow();
  const id = first(useLocalSearchParams<{ id?: string | string[] }>().id);
  const valid = /^[0-9a-f-]{36}$/i.test(id);
  const data = useAsync(() => OwnerAdminService.user(id), [id], { enabled: valid });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'green' | 'amber'; text: string } | null>(null);
  const lock = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (data.status === 'success') void data.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const d = data.data;
  const u = d?.user;

  const revoke = async () => {
    if (!u || lock.current) return;
    const ok = await confirmAsync({
      title: 'Retirar Premium de regalo',
      message: `${u.name ?? 'Esta persona'} dejará de tener el Premium que le diste. Si además paga una suscripción, esa sigue igual.`,
      confirmText: 'Retirar',
      destructive: true,
    });
    if (!ok) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await OwnerAdminService.revoke({ userId: u.id });
      setMessage({ tone: 'green', text: 'Premium de regalo retirado.' });
      await data.refresh();
    } catch (e) {
      setMessage({ tone: 'amber', text: toAppError(e).message });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  return (
    <OwnerScreen title="Ficha de usuario" refreshing={data.refreshing} onRefresh={() => void data.refresh()} testID="owner-user">
      {!valid ? <ErrorState kind="not_found" message="Esta persona no existe." /> : null}
      {valid && data.status === 'loading' ? <SkeletonList rows={3} /> : null}
      {data.error && !d ? <ErrorState kind={data.error.kind} message={data.error.message} onRetry={() => void data.reload()} /> : null}
      {d && u ? (
        <>
          <OCard style={styles.head}>
            <Avatar name={u.name ?? 'Sin nombre'} size={64} tone={u.plan === 'free' ? 'neutral' : 'primary'} />
            <View style={[styles.flex, { gap: 4 }]}>
              <AppText style={OT.h2} color="heading">{u.name ?? 'Sin nombre'}</AppText>
              <AppText style={OT.cardText} color="textSecondary">{u.phone ?? (u.anonymous ? 'Sin teléfono (entró sin registrarse)' : 'Teléfono sin verificar')}</AppText>
              <PlanBadge plan={u.plan} />
              <AppText style={OT.meta} color="textSecondary">
                {`Alta: ${fmtDate(u.createdAt)} · Última actividad: ${d.lastActivityAt ? fmtDateTime(d.lastActivityAt) : u.lastSignInAt ? fmtDateTime(u.lastSignInAt) : 'sin datos'}`}
              </AppText>
            </View>
          </OCard>

          {message ? <ONote tone={message.tone} testID="owner-user-message">{message.text}</ONote> : null}

          <AppText style={OT.h2} color="heading" accessibilityRole="header">Plan y cobro</AppText>
          {planRows(d).map((r) => (
            <ORow
              key={r.label}
              left={<OIcon icon={r.icon} variant="soft" size={38} />}
              title={r.label}
              subtitle={[r.value, r.description].filter(Boolean).join(' · ')}
            />
          ))}

          <AppText style={OT.h2} color="heading" accessibilityRole="header">Vínculos</AppText>
          <Grid>
            <OKpi icon="people" label="Cuidadores vinculados" value={u.patientLinks} wide={narrow} />
            <OKpi icon="heart" label="Personas a las que cuida" value={u.caregiverLinks} wide={narrow} />
          </Grid>

          <AppText style={OT.h2} color="heading" accessibilityRole="header">Uso (30 días)</AppText>
          <Grid>
            <OKpi icon="camera" label="Identificaciones" value={d.usage30d.scans} wide={narrow} />
            <OKpi icon="chatbubble-ellipses" label="Preguntas a Lucía" value={d.usage30d.chats} wide={narrow} />
            <OKpi icon="medkit" label="Tomas registradas" value={d.usage30d.doses} wide />
          </Grid>

          <OButton
            label={u.courtesy ? 'Ampliar Premium' : 'Conceder Premium'}
            onPress={() => router.push({ pathname: '/owner/grant', params: { user: u.id } } as Href)}
            disabled={!u.verified || u.plan === 'owner'}
            testID="owner-user-grant"
          />
          {!u.verified ? (
            <AppText style={OT.meta} color="textSecondary">Para darle Premium tiene que entrar antes con su teléfono (o dáselo por su número en «Conceder Premium»).</AppText>
          ) : null}
          {u.courtesy ? <OButton label="Retirar Premium de regalo" variant="danger" onPress={() => void revoke()} loading={busy} disabled={busy} testID="owner-user-revoke" /> : null}
          <AppText style={OT.meta} color="textSecondary">
            Por privacidad, el panel no muestra medicamentos, conversaciones, ubicaciones ni avisos de salud. Abrir esta ficha queda anotado en el registro.
          </AppText>
        </>
      ) : null}
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
