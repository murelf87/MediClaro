/**
 * /payment-result?ok=1 | ?cancel=1 — vuelta desde la página segura de pago (deep link).
 *
 *  - ok      → "Confirmando tu pago…" y espera a que el backend active Premium (webhook).
 *  - cancel  → "No se ha realizado ningún cargo".
 *  - sin dato → se consulta la suscripción y se muestra lo que corresponda.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { AppHeader, ErrorState, InfoBanner, PrimaryButton, Screen, SecondaryButton, TextButton } from '../../components';
import { useEntitlement } from '../../hooks';
import { PURCHASES_ENABLED } from '../../config/app';
import { useAppTheme } from '../../hooks';
import { SubscriptionService, isAppError } from '../../services';
import type { AppErrorKind } from '../../types';
import { StatusHero, errorMessage } from './parts';

type ResultView = 'checking' | 'success' | 'pending' | 'cancel' | 'none' | 'error';

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Sin compras dentro de la app (versiones de tienda) esta ruta no existe: lleva al plan. */
export default function PaymentResultScreenRoute() {
  return PURCHASES_ENABLED ? <PaymentResultScreen /> : <Redirect href="/premium" />;
}

function PaymentResultScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const params = useLocalSearchParams<{ ok?: string | string[]; cancel?: string | string[] }>();
  const outcome = SubscriptionService.parsePaymentReturn({ ok: firstParam(params.ok), cancel: firstParam(params.cancel) });

  const [view, setView] = useState<ResultView>(outcome === 'cancel' ? 'cancel' : 'checking');
  const [error, setError] = useState<{ kind?: AppErrorKind; message: string } | null>(null);
  const [rechecking, setRechecking] = useState(false);
  const [recheckFailed, setRecheckFailed] = useState(false);
  const entitlement = useEntitlement();

  const check = useCallback(async () => {
    setError(null);
    setView('checking');
    if (outcome === 'ok') {
      const result = await SubscriptionService.waitForPremium();
      if (result.status === 'success') await entitlement.refresh();
      setView(result.status === 'success' ? 'success' : 'pending');
      return;
    }
    try {
      const sub = await SubscriptionService.getSubscription();
      if (sub.isPremium) await entitlement.refresh();
      setView(sub.isPremium ? 'success' : 'none');
    } catch (e) {
      setError({ kind: isAppError(e) ? e.kind : undefined, message: errorMessage(e) });
      setView('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  useEffect(() => {
    if (outcome === 'cancel') {
      setView('cancel');
      return;
    }
    void check();
  }, [outcome, check]);

  const recheck = async () => {
    if (rechecking) return;
    setRechecking(true);
    setRecheckFailed(false);
    try {
      const result = await SubscriptionService.waitForPremium(10_000);
      if (result.status === 'success') {
        await entitlement.refresh();
        setView('success');
      } else setRecheckFailed(true);
    } finally {
      setRechecking(false);
    }
  };

  const goHome = () => router.replace('/(tabs)');
  const goPremium = () => router.replace('/premium');

  const notYet = recheckFailed ? (
    <InfoBanner
      tone="neutral"
      message="Todavía no hemos recibido la confirmación. Vuelve a comprobarlo en unos minutos."
      style={styles.fullWidth}
    />
  ) : null;

  let body: ReactNode;
  let footer: ReactNode;

  switch (view) {
    case 'checking':
      body = (
        <StatusHero icon="lock-closed" tone="primary" spinning title="Confirmando tu pago…" message="Esto puede tardar unos segundos." />
      );
      break;
    case 'success':
      // La confirmación con celebración y los pasos siguientes están en /premium-success.
      return <Redirect href="/premium-success" />;
    case 'pending':
      body = (
        <StatusHero
          icon="hourglass-outline"
          tone="primary"
          title="Tu pago se está procesando"
          message="Premium se activará en unos minutos. No hace falta que pagues otra vez."
        >
          {notYet}
        </StatusHero>
      );
      footer = (
        <>
          <PrimaryButton label="Comprobar de nuevo" icon="refresh" onPress={recheck} loading={rechecking} />
          <SecondaryButton label="Volver al inicio" variant="neutral" onPress={goHome} />
        </>
      );
      break;
    case 'cancel':
      body = (
        <StatusHero
          icon="close"
          tone="neutral"
          title="No se ha realizado ningún cargo"
          message="Has cancelado el pago. Puedes volver a intentarlo cuando quieras."
        />
      );
      footer = (
        <>
          <PrimaryButton label="Volver a Premium" onPress={goPremium} testID="payment-result-premium" />
          <SecondaryButton label="Volver al inicio" variant="neutral" onPress={goHome} />
        </>
      );
      break;
    case 'none':
      body = (
        <StatusHero
          icon="receipt-outline"
          tone="neutral"
          title="No hemos encontrado ningún pago"
          message="Si acabas de pagar, la confirmación puede tardar unos minutos."
        >
          {notYet}
        </StatusHero>
      );
      footer = (
        <>
          <PrimaryButton label="Comprobar de nuevo" icon="refresh" onPress={recheck} loading={rechecking} />
          <SecondaryButton label="Ver Premium" onPress={goPremium} />
          <TextButton label="Volver al inicio" onPress={goHome} />
        </>
      );
      break;
    case 'error':
      body = <ErrorState kind={error?.kind} message={error?.message} onRetry={() => void check()} />;
      footer = <TextButton label="Volver al inicio" onPress={goHome} />;
      break;
  }

  return (
    <Screen
      header={<AppHeader title="Pago seguro" titleIcon="lock-closed" />}
      footer={footer}
    >
      <View style={{ paddingTop: theme.spacing.lg }}>{body}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch', marginTop: 8 },
});
