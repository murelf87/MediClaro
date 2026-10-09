/**
 * /family-pay?plan=<planId> — «Que pague mi familiar o cuidador/a» (mismo diseño que «¿Cómo quieres pagar?»).
 *
 *  1. Invitar a un familiar: se elige cómo enviarle el enlace seguro de pago (WhatsApp, SMS o compartir).
 *     El familiar solo puede pagar: no ve conversaciones ni información médica.
 *  2. ¡Invitación enviada!: Premium se activa solo cuando el familiar paga. Mientras esta pantalla está abierta se
 *     comprueba cada pocos segundos (y siempre al volver a la app).
 * El enlace lo crea el servidor (`family-pay`); el familiar paga en la página segura de Stripe con tarjeta,
 * Apple Pay o Google Pay. Esta persona no paga nada.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Linking, Platform, Share, StyleSheet, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  AppText,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  InfoBanner,
  PrimaryButton,
  Screen,
  SecondaryButton,
  TextButton,
} from '../../components';
import { FadeIn, stagger } from '../../components/Motion';
import { CARD_PAYMENTS_ENABLED } from '../../config/app';
import { useAppTheme, useAsync, useEntitlement } from '../../hooks';
import { PurchaseService, isAppError } from '../../services';
import { Billing } from '../../services/billing';
import type { FamilyInvite } from '../../types';
import { formatDateLong } from '../../utils/format';
import { openExternalUrl } from '../../utils/device';
import { BrandHeader, MethodCard, PlanSummary, PremiumPill, PremiumSkeleton, StatusHero, priceWithPeriod } from './parts';

type SendKind = 'whatsapp' | 'sms' | 'share';

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default function FamilyPayRoute() {
  return CARD_PAYMENTS_ENABLED ? <FamilyPayScreen /> : <Redirect href="/premium" />;
}

/** Texto del mensaje: quién pide, qué se paga y que el familiar no verá datos de salud. */
export function familyInviteMessage(invite: FamilyInvite, price: string): string {
  const me = invite.beneficiaryName ? `Hola, soy ${invite.beneficiaryName}.` : 'Hola.';
  return (
    `${me} Uso MediClaro para entender mis medicamentos. ¿Me ayudas a pagar MediClaro Premium (${price})? ` +
    `Puedes hacerlo de forma segura aquí: ${invite.url}\n\n` +
    'Tú solo pagas la suscripción: no verás mis conversaciones ni mi información médica.'
  );
}

async function openApp(url: string): Promise<boolean> {
  if (Platform.OS === 'web') return openExternalUrl(url);
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

function FamilyPayScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const params = useLocalSearchParams<{ plan?: string | string[] }>();
  const planId = firstParam(params.plan);
  const offer = useAsync(() => PurchaseService.getOffer(), []);
  const entitlement = useEntitlement();
  const [invite, setInvite] = useState<FamilyInvite | null>(null);
  const [busy, setBusy] = useState<SendKind | 'preview' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [showLink, setShowLink] = useState(false);

  const entry = offer.data?.plans.find((o) => o.plan.id === planId && o.channels.includes('family')) ?? null;
  // Solo existe con los pagos simulados (Modo demostración y vista previa): enseña lo que verá el familiar.
  const canPreview = typeof Billing.checkout().previewFamilyPayment === 'function';

  // Con la invitación enviada, en cuanto el familiar paga se pasa a «Premium activado».
  const { refresh } = entitlement;
  useEffect(() => {
    if (!sent) return undefined;
    const timer = setInterval(() => void refresh(), 8000);
    return () => clearInterval(timer);
  }, [sent, refresh]);
  useEffect(() => {
    if (sent && entitlement.isPremium) router.replace({ pathname: '/premium-success', params: { plan: planId ?? '', status: 'family' } });
  }, [sent, entitlement.isPremium, router, planId]);

  const send = async (kind: SendKind) => {
    if (!entry || busy) return;
    setBusy(kind);
    setError(null);
    try {
      const current = invite ?? (await PurchaseService.createFamilyInvite(entry.plan.id));
      setInvite(current);
      const text = familyInviteMessage(current, priceWithPeriod(entry));
      const body = encodeURIComponent(text);
      let ok = false;
      if (kind === 'whatsapp') ok = await openApp(`https://wa.me/?text=${body}`);
      else if (kind === 'sms') ok = await openApp(Platform.OS === 'ios' ? `sms:&body=${body}` : `sms:?body=${body}`);
      else {
        try {
          const result = await Share.share({ message: text });
          ok = result.action !== Share.dismissedAction;
        } catch {
          // Navegador sin «Compartir»: se enseña el enlace para copiarlo.
          setShowLink(true);
          ok = false;
        }
      }
      if (ok) setSent(true);
      else if (kind !== 'share') {
        setError(kind === 'whatsapp' ? 'No se ha podido abrir WhatsApp. Prueba con «Compartir enlace».' : 'No se ha podido abrir los mensajes. Prueba con «Compartir enlace».');
      }
    } catch (e) {
      if (isAppError(e) && e.kind === 'cancelled') return;
      setError(isAppError(e) ? e.message : 'No hemos podido preparar la invitación. Inténtalo de nuevo.');
    } finally {
      setBusy(null);
    }
  };

  const openPreview = async () => {
    if (!canPreview || !invite || !entry || busy) return;
    setBusy('preview');
    try {
      const result = await Billing.checkout().previewFamilyPayment?.({ ...invite, period: entry.plan.period, priceCents: entry.priceCents });
      if (result === 'paid') {
        await entitlement.refresh();
        router.replace({ pathname: '/premium-success', params: { plan: entry.plan.id, status: 'family' } });
      }
    } finally {
      setBusy(null);
    }
  };

  let body: ReactNode;
  let footer: ReactNode = null;
  if (entitlement.status === 'ready' && entitlement.isPremium && !sent) {
    body = (
      <StatusHero
        icon="ribbon-outline"
        tone="primary"
        title="Ya tienes MediClaro Premium"
        message="Tu Premium ya está funcionando. No hace falta que nadie pague."
      />
    );
    footer = <PrimaryButton label="Ver mi suscripción" icon="card-outline" onPress={() => router.replace('/premium')} />;
  } else if (offer.status === 'loading') {
    body = <PremiumSkeleton />;
  } else if (offer.status === 'error' || !offer.data) {
    body = <ErrorState kind={offer.error?.kind} message={offer.error?.message} onRetry={() => void offer.reload()} />;
  } else if (!entry) {
    body = (
      <EmptyState
        icon="people-outline"
        title="Este plan no lo puede pagar un familiar ahora mismo"
        message="Elige otra forma de pago u otro plan."
        action={{ label: 'Ver los planes', onPress: () => router.replace('/premium') }}
      />
    );
  } else if (sent && invite) {
    body = (
      <View style={{ gap: theme.spacing.md }} testID="family-pay-sent">
        <StatusHero
          icon="paper-plane"
          tone="success"
          title="¡Invitación enviada!"
          message="Hemos preparado la invitación para que tu familiar pueda pagar tu suscripción Premium."
        />
        <Card>
          <View style={styles.row}>
            <Icon name="time-outline" size={26} color={c.primary} />
            <View style={[styles.flex, { gap: 4 }]}>
              <AppText variant="bodyStrong" color="heading">
                Cuando tu familiar pague
              </AppText>
              <AppText variant="caption" color="textSecondary">
                Tu Premium se activará automáticamente en este móvil. No tienes que hacer nada más.
              </AppText>
              {invite.expiresAt ? (
                <AppText variant="caption" color="textSecondary">
                  {`El enlace sirve hasta el ${formatDateLong(invite.expiresAt)}.`}
                </AppText>
              ) : null}
            </View>
          </View>
        </Card>
        {canPreview ? (
          <SecondaryButton
            label="Ver cómo lo verá tu familiar (simulación)"
            icon="eye-outline"
            onPress={() => void openPreview()}
            loading={busy === 'preview'}
            testID="family-pay-preview"
          />
        ) : null}
      </View>
    );
    footer = (
      <>
        <PrimaryButton label="Entendido" icon="checkmark" onPress={() => router.replace('/(tabs)')} testID="family-pay-done" />
        <TextButton label="Enviar la invitación de nuevo" onPress={() => setSent(false)} testID="family-pay-again" />
      </>
    );
  } else {
    body = (
      <View style={{ gap: theme.spacing.md }} testID="family-pay-invite">
        <PlanSummary offer={entry} onChange={() => router.back()} />
        {canPreview ? <InfoBanner tone="warning" message="Modo demostración: el pago es simulado y no se cobra nada." /> : null}
        {error ? <InfoBanner tone="danger" message={error} /> : null}
        <View style={{ gap: theme.spacing.sm }} accessibilityRole="list">
          <FadeIn delay={stagger(0, 90, 80)}>
            <MethodCard
              icon="logo-whatsapp"
              iconColor="#FFFFFF"
              iconBg="#25D366"
              title="Enviar por WhatsApp"
              subtitle="Elige a tu familiar en WhatsApp y envíale el enlace."
              onPress={() => void send('whatsapp')}
              loading={busy === 'whatsapp'}
              disabled={!!busy && busy !== 'whatsapp'}
              testID="family-pay-whatsapp"
            />
          </FadeIn>
          <FadeIn delay={stagger(1, 90, 80)}>
            <MethodCard
              icon="chatbubble-ellipses"
              iconColor="#FFFFFF"
              iconBg="#2563EB"
              title="Enviar por SMS"
              subtitle="Se abre un mensaje con el enlace ya escrito."
              onPress={() => void send('sms')}
              loading={busy === 'sms'}
              disabled={!!busy && busy !== 'sms'}
              testID="family-pay-sms"
            />
          </FadeIn>
          <FadeIn delay={stagger(2, 90, 80)}>
            <MethodCard
              icon="share-social"
              iconColor="#FFFFFF"
              iconBg="#7C3AED"
              title="Compartir enlace"
              subtitle="Por correo, otra app o como prefieras."
              onPress={() => void send('share')}
              loading={busy === 'share'}
              disabled={!!busy && busy !== 'share'}
              testID="family-pay-share"
            />
          </FadeIn>
        </View>
        {showLink && invite ? (
          <Card>
            <AppText variant="captionStrong" color="heading">
              Copia este enlace y envíaselo:
            </AppText>
            <AppText variant="caption" color="link" selectable testID="family-pay-link" style={{ marginTop: 4 }}>
              {invite.url}
            </AppText>
            <TextButton label="Ya lo he enviado" icon="checkmark" align="flex-start" onPress={() => setSent(true)} />
          </Card>
        ) : null}
        <InfoBanner
          tone="info"
          icon="lock-closed"
          message="Tu familiar solo podrá pagar la suscripción. No verá tus conversaciones ni tu información médica."
        />
      </View>
    );
    footer = (
      <AppText variant="caption" color="textSecondary" align="center" testID="family-pay-renewal">
        {`${priceWithPeriod(entry)} · Lo paga tu familiar en una página segura (tarjeta, Apple Pay o Google Pay). Se renueva solo y tu familiar puede cancelarlo cuando quiera.`}
      </AppText>
    );
  }

  return (
    <Screen gradient="soft" header={<BrandHeader fallbackHref="/premium" />} footer={footer} testID="family-pay-screen">
      {sent ? null : (
        <View style={[styles.head, { gap: theme.spacing.xs, marginBottom: theme.spacing.lg }]}>
          <PremiumPill />
          <AppText variant="title" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.xs }}>
            Invitar a un familiar
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            Elige cómo quieres enviarle la invitación para que pague tu suscripción.
          </AppText>
        </View>
      )}
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
});
