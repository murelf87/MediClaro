/**
 * ¿Tiene la persona MediClaro Premium? — estado compartido por toda la app.
 *
 *  - Se consulta al servidor al iniciar sesión, al volver a la app y cuando una compra se confirma.
 *  - Al iniciar sesión se comprueban también las compras de la tienda que quedaron sin confirmar
 *    (PurchaseService.reconcile): ningún pago se pierde aunque la app se cerrara a mitad.
 *  - `unlocked`: funciones reales solo con Premium confirmado. Los fallos de conexión no conceden acceso.
 *  - Las emergencias y el 112 nunca dependen de esto.
 *  - Si storeVerification=false no se ofrece un cobro que el servidor aún no puede comprobar;
 *    esto NO desbloquea IA ni identificación para cuentas gratuitas o visitantes.
 */
import { createElement, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { CARD_PAYMENTS_ENABLED, DEMO_ACCESS_ENABLED, PREMIUM_REQUIRED, PURCHASES_ENABLED } from '../config/app';
import { PurchaseService } from '../services/PurchaseService';
import { SubscriptionService } from '../services/SubscriptionService';
import { TestAccess } from '../services/TestAccess';
import { useSession } from './SessionProvider';
import type { Subscription } from '../types';

export type EntitlementStatus = 'idle' | 'loading' | 'ready' | 'error';

interface EntitlementValue {
  status: EntitlementStatus;
  subscription: Subscription | null;
  isPremium: boolean;
  /** Las funciones reales son de Premium (compras activas en esta compilación y el servidor puede cobrar). */
  required: boolean;
  /** Se puede ofrecer Premium dentro de la app (mostrar planes y avisos para contratarlo). */
  canSell: boolean;
  /** Puede usar las funciones reales ahora mismo. */
  unlocked: boolean;
  refresh: () => Promise<Subscription | null>;
}

const EntitlementContext = createContext<EntitlementValue>({
  status: 'idle',
  subscription: null,
  isPremium: false,
  required: PREMIUM_REQUIRED,
  canSell: PURCHASES_ENABLED,
  unlocked: !PREMIUM_REQUIRED,
  refresh: async () => null,
});

/** Con tarjeta siempre hay forma de pagar; con solo la tienda, depende de que el servidor compruebe compras. */
const NEEDS_SERVER_CHECK = PREMIUM_REQUIRED && !CARD_PAYMENTS_ENABLED;

const FOREGROUND_REFRESH_MS = 60_000;

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { status: sessionStatus, session } = useSession();
  const userId = sessionStatus === 'signedIn' ? session?.userId ?? null : null;
  const [status, setStatus] = useState<EntitlementStatus>('idle');
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [testAccessActive, setTestAccessActive] = useState(false);
  const lastLoad = useRef(0);
  const userRef = useRef<string | null>(null);
  userRef.current = userId;
  // ¿Puede el servidor activar compras de la tienda? null = aún no se sabe (se mantiene el bloqueo).
  const [storeSellable, setStoreSellable] = useState<boolean | null>(NEEDS_SERVER_CHECK ? null : true);

  useEffect(() => {
    if (!NEEDS_SERVER_CHECK) return undefined;
    let cancelled = false;
    const load = () =>
      SubscriptionService.getPlans()
        .then((catalog) => {
          if (!cancelled) setStoreSellable(catalog.storeVerification);
        })
        .catch(() => undefined);
    void load();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void load();
    });
    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  const refresh = useCallback(async (): Promise<Subscription | null> => {
    const forUser = userRef.current;
    if (!forUser) return null;
    try {
      const sub = await SubscriptionService.getSubscription();
      if (userRef.current !== forUser) return null;
      lastLoad.current = Date.now();
      setSubscription(sub);
      setStatus('ready');
      return sub;
    } catch {
      if (userRef.current === forUser) setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
      return null;
    }
  }, []);

  // Cambio de cuenta: se vuelve a comprobar desde cero.
  useEffect(() => {
    if (!userId) {
      setSubscription(null);
      setStatus(sessionStatus === 'loading' ? 'loading' : 'ready');
      return;
    }
    setStatus('loading');
    setSubscription(null);
    let cancelled = false;
    void refresh().then(() => {
      if (cancelled) return;
      // Compras de la tienda pendientes de confirmar de ESTA cuenta.
      void PurchaseService.reconcile(userId)
        .then((activated) => {
          if (activated && !cancelled) void refresh();
        })
        .catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, sessionStatus, refresh]);

  // Al volver a la app (p. ej. después de pagar o cancelar en otro sitio).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && userRef.current && Date.now() - lastLoad.current > FOREGROUND_REFRESH_MS) void refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Compras confirmadas en cualquier punto de la app.
  useEffect(() => PurchaseService.onEntitlementChange(() => void refresh()), [refresh]);

  // El acceso QA solo se marca después de que `qa-access` haya concedido Premium en el servidor.
  // Suscribirse evita una carrera en la que la primera lectura de entitlement llegue antes de esa concesión.
  useEffect(() => {
    if (!DEMO_ACCESS_ENABLED) return undefined;
    const sync = () => setTestAccessActive(TestAccess.isActive());
    sync();
    return TestAccess.subscribe(sync);
  }, []);

  const value = useMemo<EntitlementValue>(() => {
    const isPremium = !!subscription?.isPremium || (DEMO_ACCESS_ENABLED && testAccessActive);
    const required = PREMIUM_REQUIRED;
    return {
      status,
      subscription,
      isPremium,
      required,
      canSell: PURCHASES_ENABLED && storeSellable !== false,
      unlocked: !required || isPremium,
      refresh,
    };
  }, [status, subscription, refresh, storeSellable, testAccessActive]);

  return createElement(EntitlementContext.Provider, {value}, children);
}

export function useEntitlement(): EntitlementValue {
  return useContext(EntitlementContext);
}
