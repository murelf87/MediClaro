/**
 * Acciones de compra compartidas por las pantallas de Premium (planes, forma de pago, tarjeta, bienvenida):
 * ejecuta la compra, traduce el resultado a la siguiente pantalla y a avisos claros, y evita dobles pulsaciones.
 */
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useEntitlement } from '../../hooks';
import { PurchaseService, isAppError } from '../../services';
import { showAlert } from '../../utils/dialogs';
import type { PaymentChannelId, PurchaseOutcome } from '../../types';

export interface PurchaseNotice {
  tone: 'info' | 'warning' | 'danger';
  title?: string;
  message: string;
  action?: { label: string; onPress: () => void };
}

export type PurchaseBusy = PaymentChannelId | 'restore' | null;

export function usePurchase() {
  const router = useRouter();
  const entitlement = useEntitlement();
  const [busy, setBusy] = useState<PurchaseBusy>(null);
  const [notice, setNotice] = useState<PurchaseNotice | null>(null);
  const running = useRef(false);

  const handleOutcome = useCallback(
    async (outcome: PurchaseOutcome, planId: string) => {
      switch (outcome.status) {
        case 'success':
          await entitlement.refresh();
          router.replace({ pathname: '/premium-success', params: { plan: planId } });
          return;
        case 'already_active':
          await entitlement.refresh();
          router.replace({ pathname: '/premium-success', params: { plan: planId, status: 'already' } });
          return;
        case 'pending':
          router.replace({ pathname: '/premium-success', params: { plan: planId, status: 'pending', reason: outcome.reason ?? 'confirming' } });
          return;
        case 'cancelled':
          setNotice({ tone: 'info', message: 'Has cancelado el pago. No se ha realizado ningún cargo.' });
          return;
        case 'redirected':
          // Web (pruebas): la página de pago se abre en esta ventana y el resultado llega a /payment-result.
          return;
      }
    },
    [entitlement, router],
  );

  const pay = useCallback(
    async (channel: PaymentChannelId, planId: string) => {
      if (running.current) return;
      running.current = true;
      setBusy(channel);
      setNotice(null);
      try {
        if (channel === 'family') throw new Error('family'); // se gestiona en /family-pay (enlace para el familiar)
        const outcome =
          channel === 'store'
            ? await PurchaseService.purchaseWithStore(planId)
            : await PurchaseService.purchaseHosted(planId, channel);
        await handleOutcome(outcome, planId);
      } catch (e) {
        if (isAppError(e) && e.code === 'anonymous_disabled') {
          // Never substitute pre-purchase phone verification for an unavailable anonymous account.
          setNotice({
            tone: 'warning',
            title: 'La contratación no está disponible ahora',
            message: 'No hemos podido preparar la compra sin pedirte el teléfono. Inténtalo más tarde. No se ha realizado ningún cargo; verificaremos tu número después de confirmar Premium.',
          });
        } else {
          setNotice({
            tone: 'danger',
            title: 'No se ha completado el pago',
            message: isAppError(e) ? e.message : 'Ha ocurrido un error. Inténtalo de nuevo. No se ha realizado ningún cargo.',
          });
        }
      } finally {
        running.current = false;
        setBusy(null);
      }
    },
    [handleOutcome, router],
  );

  const restore = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy('restore');
    setNotice(null);
    try {
      const outcome = await PurchaseService.restore();
      if (outcome.status === 'restored') {
        await entitlement.refresh();
        router.replace({ pathname: '/premium-success', params: { status: 'restored' } });
      } else {
        await showAlert(
          'No hemos encontrado ninguna compra',
          'En este teléfono no hay ninguna suscripción de MediClaro. Si pagaste con tarjeta o en otro teléfono, entra con tu número en «Ya soy Premium».',
        );
      }
    } catch (e) {
      setNotice({
        tone: 'danger',
        title: 'No hemos podido restaurar la compra',
        message: isAppError(e) ? e.message : 'Ha ocurrido un error. Inténtalo de nuevo.',
      });
    } finally {
      running.current = false;
      setBusy(null);
    }
  }, [entitlement, router]);

  return { busy, notice, setNotice, pay, restore };
}
