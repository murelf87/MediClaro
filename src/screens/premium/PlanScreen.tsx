/**
 * /premium en las versiones SIN compras dentro de la app (EXPO_PUBLIC_PAYMENTS_MODE = none).
 *
 * Mientras no haya compra integrada de Apple/Google, las tiendas no permiten vender ni invitar a pagar
 * fuera de la app. Esta pantalla solo informa: qué incluye el plan de la persona, cuánto le queda este
 * mes y cuándo se renueva. Sin precios, sin botones de compra y sin enlaces a pagos externos.
 */
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, AppText, Badge, Card, ErrorState, Icon, Screen, TextButton, type IconName } from '../../components';
import { useAppTheme, useAsync, useRefreshOnFocus } from '../../hooks';
import { SubscriptionService } from '../../services';
import { formatDateLong, nextMonthStartLabel } from '../../utils/format';
import { UsageMeter } from '../medications/parts';
import { CrownIcon, PremiumSkeleton } from './parts';

function IncludedRow({ icon, title, detail }: { icon: IconName; title: string; detail?: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.row} accessible accessibilityLabel={detail ? `${title}. ${detail}` : title}>
      <View style={[styles.rowIcon, { backgroundColor: theme.colors.primaryTint }]}>
        <Icon name={icon} size={22} color={theme.colors.primary} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color="heading">
          {title}
        </AppText>
        {detail ? (
          <AppText variant="caption" color="textSecondary">
            {detail}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export default function PlanScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const catalog = useAsync(() => SubscriptionService.getPlans(), []);
  const subscription = useAsync(() => SubscriptionService.getSubscription(), []);
  useRefreshOnFocus(subscription.refresh);

  const sub = subscription.data;
  const isPremium = !!sub?.isPremium;
  const limits = isPremium ? catalog.data?.premiumLimits : catalog.data?.freeLimits;
  const usage = sub?.usage ?? null;
  const loading = catalog.status === 'loading' || subscription.status === 'loading';
  const failed = subscription.status === 'error' || catalog.status === 'error';

  const retry = () => {
    void catalog.reload();
    void subscription.reload();
  };

  let body: ReactNode;
  if (loading) {
    body = <PremiumSkeleton />;
  } else if (failed) {
    const err = subscription.error ?? catalog.error;
    body = <ErrorState kind={err?.kind} message={err?.message} onRetry={retry} />;
  } else {
    const renewDate = isPremium && sub?.renewsAt ? formatDateLong(sub.renewsAt) : '';
    body = (
      <View style={{ gap: theme.spacing.md }}>
        {isPremium ? (
          <View style={[styles.center, { gap: theme.spacing.xs }]}>
            <Badge label={sub?.ownerAccess ? "Premium de propietario · gratuito" : sub?.courtesyAccess ? "Premium de cortesía · gratuito" : "Suscripción activa"} tone="success" icon="checkmark-circle" />
            {renewDate ? (
              <AppText variant="body" color="textSecondary" align="center">
                {sub?.cancelsAtPeriodEnd || sub?.status === 'canceled'
                  ? `Premium sigue activo hasta el ${renewDate}. No se renovará.`
                  : `Se renueva el ${renewDate}.`}
              </AppText>
            ) : null}
          </View>
        ) : null}

        <Card style={{ gap: theme.spacing.md }} testID="plan-included">
          <AppText variant="subheading" color="heading" accessibilityRole="header">
            Qué incluye tu plan
          </AppText>
          {limits ? (
            <>
              {limits.unlimited ? (
                <IncludedRow icon="infinite" title="Identificaciones ilimitadas" detail="Mientras dure tu suscripción." />
              ) : (
                <IncludedRow
                  icon="scan-outline"
                  title={`${limits.monthlyScans} identificaciones al mes`}
                  detail="Las búsquedas que no encuentran el medicamento no cuentan."
                />
              )}
              <IncludedRow icon="chatbubbles-outline" title={`${limits.chatPerDay} preguntas al día al asistente`} />
            </>
          ) : null}
          <IncludedRow
            icon="checkmark-done-outline"
            title="Siempre incluido"
            detail="Ficha oficial del medicamento, lectura en voz alta, Mis medicamentos, historial y Emergencia."
          />
        </Card>

        {usage && !usage.unlimited ? (
          <Card style={{ gap: theme.spacing.sm }} testID="plan-usage">
            <AppText variant="bodyStrong" color="heading">
              {`Este mes: ${usage.scansUsed} de ${usage.scansIncluded} identificaciones${isPremium ? ' incluidas' : ''}`}
            </AppText>
            <UsageMeter used={usage.scansUsed} included={usage.scansIncluded} />
            <AppText variant="caption" color="textSecondary">
              {isPremium
                ? renewDate
                  ? `Se renuevan el ${renewDate}.`
                  : 'Se renuevan cada mes.'
                : `Se renuevan el ${nextMonthStartLabel()}.`}
            </AppText>
          </Card>
        ) : null}
      </View>
    );
  }

  return (
    <Screen
      header={<AppHeader title="Tu plan" />}
      footer={<TextButton label="Ayuda" icon="help-circle-outline" onPress={() => router.push('/help')} />}
    >
      <View style={[styles.center, { gap: theme.spacing.xxs, marginBottom: theme.spacing.lg, marginTop: 4 }]}>
        {isPremium ? (
          <CrownIcon size={60} />
        ) : (
          <View style={[styles.hero, { backgroundColor: theme.colors.primarySoft }]}>
            <Icon name="ribbon-outline" size={34} color={theme.colors.primary} />
          </View>
        )}
        <AppText variant="title" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.xs }}>
          {isPremium ? 'MediClaro Premium' : 'Plan gratuito'}
        </AppText>
      </View>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center' },
  hero: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
