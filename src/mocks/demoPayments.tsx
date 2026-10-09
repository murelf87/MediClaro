/**
 * MODO DEMOSTRACIÓN / QA — pagos SIMULADOS (nunca se cobra nada).
 *
 * Sustituye a la compra integrada de Apple/Google y a la página segura de Stripe cuando la app funciona con
 * el backend simulado (Modo demostración de las compilaciones de desarrollo/preview y QA web):
 *  - demoStoreBilling: hoja de confirmación que imita la de la tienda → compra de prueba → el servidor
 *    simulado la «comprueba» con `iap-verify`, igual que el real.
 *  - demoHostedCheckout: página de pago con tarjeta que imita la de Stripe (solo acepta la tarjeta de prueba
 *    4242 4242 4242 4242; nada sale del teléfono) → el servidor simulado activa Premium. También Bizum (pago único:
 *    número de móvil y «acepta en tu banco») y la vista del familiar que paga con el enlace de invitación.
 *  - DemoPaymentSheetsHost: las dos hojas (se monta una vez en app/_layout.tsx).
 *
 * En las compilaciones de tienda este archivo se sustituye por demoPayments.disabled.tsx (metro.config.js).
 */
import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { Icon } from '../components/Icon';
import { MediClaroMark } from '../components/MediClaroLogo';
import { PrimaryButton, TextButton } from '../components/Buttons';
import { TextField } from '../components/Inputs';
import { useAppTheme } from '../providers/PreferencesProvider';
import { AppError } from '../api/errors';
import { supabase } from '../lib/supabase';
import { perPeriodPhrase, periodName, PERIOD_MONTHS } from '../services/planCatalog';
import { formatPrice } from '../utils/format';
import { readQaScenario } from './demoBackend';
import type { HostedCheckoutAdapter, StoreBillingAdapter, StoreProductInfo, StorePurchase } from '../services/billing/types';
import type { BillingPeriod, FamilyInvite, StorePlatform } from '../types';

// ─── Petición de hoja (bus mínimo entre adaptador e interfaz) ────────────────

interface StoreSheetRequest {
  kind: 'store';
  platform: StorePlatform;
  period: BillingPeriod;
  price: string;
}
interface CardSheetRequest {
  kind: 'card';
  period: BillingPeriod;
  priceCents: number;
  planId: string;
}
interface BizumSheetRequest {
  kind: 'bizum';
  period: BillingPeriod;
  priceCents: number;
  planId: string;
}
/** Domiciliación bancaria SEPA o PayPal: la misma suscripción que con tarjeta, en la página segura simulada. */
interface AltSheetRequest {
  kind: 'sepa' | 'paypal';
  period: BillingPeriod;
  priceCents: number;
  planId: string;
}
interface FamilySheetRequest {
  kind: 'family';
  invite: FamilyInvite;
  period: BillingPeriod;
  priceCents: number;
}
type SheetRequest = StoreSheetRequest | CardSheetRequest | BizumSheetRequest | AltSheetRequest | FamilySheetRequest;
type SheetResult = 'confirm' | 'cancel';

let current: { request: SheetRequest; resolve: (r: SheetResult) => void } | null = null;
const listeners = new Set<() => void>();

function openSheet(request: SheetRequest): Promise<SheetResult> {
  // Si ya hay una hoja abierta, se cancela (nunca dos a la vez).
  current?.resolve('cancel');
  return new Promise<SheetResult>((resolve) => {
    current = { request, resolve };
    listeners.forEach((l) => l());
  });
}

function closeSheet(result: SheetResult): void {
  const c = current;
  current = null;
  listeners.forEach((l) => l());
  c?.resolve(result);
}

function qa(flag: string): boolean {
  return readQaScenario().has(flag);
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function renewalDate(period: BillingPeriod): string {
  const d = new Date();
  d.setMonth(d.getMonth() + PERIOD_MONTHS[period]);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ─── Adaptadores simulados ───────────────────────────────────────────────────

const simulatedPlatform = (): StorePlatform => (qa('google') || Platform.OS === 'android' ? 'google' : 'apple');

export const demoStoreBilling: StoreBillingAdapter = {
  platform: simulatedPlatform,

  async loadProducts(plans) {
    await wait(150);
    const out = new Map<string, StoreProductInfo>();
    if (qa('nostore')) return out;
    for (const p of plans) {
      const productId = simulatedPlatform() === 'apple' ? p.refs.apple?.productId : p.refs.google?.productId;
      if (!productId) continue;
      out.set(p.planId, {
        planId: p.planId,
        productId,
        displayPrice: formatPrice(p.priceCents),
        priceCents: p.priceCents,
        currency: 'EUR',
        offerToken: simulatedPlatform() === 'google' ? `demo-offer-${p.planId}` : null,
      });
    }
    return out;
  },

  async purchase({ planId, period, product }): Promise<StorePurchase> {
    const result = await openSheet({ kind: 'store', platform: simulatedPlatform(), period, price: product.displayPrice });
    if (result !== 'confirm') throw new AppError('cancelled', 'Has cancelado la compra. No se ha cobrado nada.');
    await wait(700);
    if (qa('storeerror')) throw new AppError('unknown', 'La tienda no ha podido completar la compra. Inténtalo de nuevo.');
    return {
      platform: simulatedPlatform(),
      productId: product.productId,
      transactionId: `demo-${Date.now()}`,
      purchaseToken: `demo-token-${planId}`,
      state: qa('storepending') ? 'pending' : 'purchased',
      accountToken: null,
      native: null,
    };
  },

  async finish() {
    // Nada que cerrar en la simulación.
  },

  async activePurchases() {
    await wait(400);
    if (!qa('storeowned')) return [];
    return [
      {
        platform: simulatedPlatform(),
        productId: 'com.mediclaro.app.premium.annual',
        transactionId: 'demo-restored',
        purchaseToken: 'demo-token-premium_annual',
        state: 'purchased',
        accountToken: null,
        native: null,
      },
    ];
  },

  async openManage() {
    throw new AppError('not_available', 'En la simulación no hay una suscripción real que gestionar.');
  },

  async canOfferExternalPurchase() {
    return !qa('nocard');
  },

  async startExternalPurchase() {
    return { proceed: true, token: null };
  },

  async confirmExternalLink() {
    return true;
  },

  setBackgroundHandler() {
    // Sin compras en segundo plano en la simulación.
  },
};

export const demoHostedCheckout: HostedCheckoutAdapter = {
  async open(url) {
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    const planId = params.get('plan') ?? 'premium_monthly';
    const period = (params.get('period') as BillingPeriod | null) ?? 'monthly';
    const priceCents = Number(params.get('amount')) || 499;
    const raw = params.get('method');
    const method = raw === 'bizum' || raw === 'sepa' || raw === 'paypal' ? raw : 'card';
    const result = await openSheet({ kind: method, period, priceCents, planId });
    if (result !== 'confirm') return 'cancel';
    // El servidor simulado activa Premium (en el real lo hace el webhook de Stripe).
    await supabase.functions.invoke('demo-checkout-complete', { body: { planId, method } });
    return 'ok';
  },

  async previewFamilyPayment(invite) {
    const result = await openSheet({ kind: 'family', invite, period: invite.period, priceCents: invite.priceCents });
    if (result !== 'confirm') return 'cancel';
    await supabase.functions.invoke('demo-family-complete', { body: { planId: invite.planId } });
    return 'paid';
  },
};

// ─── Interfaz de las hojas ───────────────────────────────────────────────────

export function DemoPaymentSheetsHost() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  const request = current?.request ?? null;
  return (
    <Modal visible={!!request} transparent animationType="slide" onRequestClose={() => closeSheet('cancel')}>
      {request?.kind === 'store' ? <StoreSheet request={request} /> : null}
      {request?.kind === 'card' ? <CardSheet request={request} /> : null}
      {request?.kind === 'bizum' ? <BizumSheet request={request} /> : null}
      {request?.kind === 'sepa' || request?.kind === 'paypal' ? <AltMethodSheet request={request} /> : null}
      {request?.kind === 'family' ? <FamilyPayerSheet request={request} /> : null}
    </Modal>
  );
}

function SheetFrame({ children, testID }: { children: ReactNode; testID: string }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.overlay, { backgroundColor: theme.colors.overlay }]}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={() => closeSheet('cancel')} accessibilityLabel="Cerrar" />
      <View
        testID={testID}
        style={[
          styles.sheet,
          {
            backgroundColor: theme.colors.surface,
            paddingBottom: Math.max(insets.bottom, 16),
            maxWidth: theme.layout.maxContentWidth,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: theme.colors.borderStrong }]} />
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, padding: 20, paddingTop: 8 }}>
          {children}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function SimulationTag() {
  const c = useAppTheme().colors;
  return (
    <View style={[styles.tag, { backgroundColor: c.premiumSoft }]}>
      <AppText variant="small" style={{ color: c.premiumText }}>
        SIMULACIÓN
      </AppText>
    </View>
  );
}

function StoreSheet({ request }: { request: StoreSheetRequest }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [busy, setBusy] = useState(false);
  const store = request.platform === 'apple' ? 'App Store' : 'Google Play';
  const title = `Suscripción ${periodName(request.period).toLowerCase()}`;
  return (
    <SheetFrame testID="demo-store-sheet">
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Icon name={request.platform === 'apple' ? 'logo-apple' : 'logo-google-playstore'} size={22} color={c.heading} />
          <AppText variant="subheading" color="heading">
            {store}
          </AppText>
          <SimulationTag />
        </View>
        <TextButton label="Cancelar" style={styles.noShrink} onPress={() => closeSheet('cancel')} testID="demo-store-cancel" />
      </View>
      <View style={[styles.productRow, { backgroundColor: c.surfaceAlt, borderRadius: theme.radius.md }]}>
        <View style={[styles.appIcon, { backgroundColor: c.surface, borderColor: c.border }]}>
          <MediClaroMark size={34} accessibilityLabel="" />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color="heading">
            MediClaro Premium
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {title}
          </AppText>
          <AppText variant="bodyStrong" color="heading">
            {`${request.price} ${perPeriodPhrase(request.period)}`}
          </AppText>
        </View>
      </View>
      <AppText variant="caption" color="textSecondary">
        {`Suscripción con renovación automática a partir del ${renewalDate(request.period)}. Cancela cuando quieras en los ajustes de ${store}.`}
      </AppText>
      <PrimaryButton
        label={busy ? 'Confirmando…' : 'Suscribirse'}
        icon={request.platform === 'apple' ? 'finger-print' : 'checkmark-circle'}
        loading={busy}
        onPress={() => {
          setBusy(true);
          setTimeout(() => closeSheet('confirm'), 500);
        }}
        testID="demo-store-confirm"
      />
      <AppText variant="caption" color="textMuted" align="center">
        Modo demostración: esta hoja imita la de la tienda. No se cobra nada.
      </AppText>
    </SheetFrame>
  );
}

const TEST_CARD = '4242424242424242';

function groupCard(digits: string): string {
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function CardSheet({ request }: { request: CardSheetRequest }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [number, setNumber] = useState(groupCard(TEST_CARD));
  const [expiry, setExpiry] = useState('12/34');
  const [cvc, setCvc] = useState('123');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState(false);
  const price = formatPrice(request.priceCents);

  const validate = (): boolean => {
    const next: Record<string, string | null> = {};
    const digits = number.replace(/\D+/g, '');
    if (digits !== TEST_CARD) next.number = 'En la simulación solo vale la tarjeta de prueba 4242 4242 4242 4242.';
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(expiry.trim());
    const month = m ? Number(m[1]) : 0;
    const year = m ? 2000 + Number(m[2]) : 0;
    const now = new Date();
    if (!m || month < 1 || month > 12) next.expiry = 'Escribe la fecha como MM/AA.';
    else if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) next.expiry = 'La tarjeta está caducada.';
    if (!/^\d{3,4}$/.test(cvc.trim())) next.cvc = 'El CVC tiene 3 o 4 cifras.';
    if (name.trim().length < 2) next.name = 'Escribe el nombre como aparece en la tarjeta.';
    setErrors(next);
    return Object.values(next).every((v) => !v);
  };

  return (
    <SheetFrame testID="demo-card-sheet">
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Icon name="lock-closed" size={18} color={c.heading} />
          <AppText variant="subheading" color="heading">
            Pago seguro
          </AppText>
          <SimulationTag />
        </View>
        <TextButton label="Cancelar" style={styles.noShrink} onPress={() => closeSheet('cancel')} testID="demo-card-cancel" />
      </View>
      <View style={[styles.amountBox, { backgroundColor: c.surfaceAlt, borderRadius: theme.radius.md }]}>
        <AppText variant="caption" color="textSecondary">
          {`MediClaro Premium · Suscripción ${periodName(request.period).toLowerCase()}`}
        </AppText>
        <AppText variant="price" color="heading">
          {price}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {`Se renueva ${perPeriodPhrase(request.period)} hasta que canceles.`}
        </AppText>
      </View>
      <TextField
        label="Número de tarjeta"
        value={number}
        onChangeText={(t) => setNumber(groupCard(t.replace(/\D+/g, '').slice(0, 16)))}
        keyboardType="number-pad"
        error={errors.number}
        testID="demo-card-number"
      />
      <View style={styles.row2}>
        <View style={styles.flex}>
          <TextField label="Caducidad" value={expiry} onChangeText={setExpiry} placeholder="MM/AA" error={errors.expiry} keyboardType="number-pad" />
        </View>
        <View style={styles.flex}>
          <TextField label="CVC" value={cvc} onChangeText={(t) => setCvc(t.replace(/\D+/g, '').slice(0, 4))} keyboardType="number-pad" error={errors.cvc} />
        </View>
      </View>
      <TextField
        label="Nombre del titular"
        value={name}
        onChangeText={setName}
        placeholder="Como aparece en la tarjeta"
        autoCapitalize="words"
        error={errors.name}
        testID="demo-card-name"
      />
      <View style={styles.saveRow}>
        <Icon name="checkmark-circle" size={20} color={c.successStrong} />
        <AppText variant="caption" color="textSecondary" style={styles.flex}>
          La tarjeta queda guardada en Stripe para las renovaciones.
        </AppText>
      </View>
      <PrimaryButton
        label={`Pagar ${price}`}
        icon="lock-closed"
        loading={busy}
        onPress={() => {
          if (!validate()) return;
          setBusy(true);
          setTimeout(() => closeSheet('confirm'), 900);
        }}
        testID="demo-card-pay"
      />
      <AppText variant="caption" color="textMuted" align="center">
        Modo demostración: imita la página segura de Stripe. No se cobra nada y la tarjeta no sale del teléfono.
      </AppText>
    </SheetFrame>
  );
}

/** Bizum en la página de Stripe: número de móvil → «acepta el pago en la app de tu banco». Pago único. */
function BizumSheet({ request }: { request: BizumSheetRequest }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [phone, setPhone] = useState('600 123 456');
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'phone' | 'bank'>('phone');
  const price = formatPrice(request.priceCents);
  const months = PERIOD_MONTHS[request.period];

  const pay = () => {
    const digits = phone.replace(/\D+/g, '').replace(/^34/, '');
    if (!/^[67]\d{8}$/.test(digits)) {
      setError('Escribe el móvil que tienes en Bizum (9 cifras, empieza por 6 o 7).');
      return;
    }
    setError(null);
    setStep('bank');
    setTimeout(() => closeSheet('confirm'), 2200);
  };

  return (
    <SheetFrame testID="demo-bizum-sheet">
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Icon name="phone-portrait" size={18} color={c.heading} />
          <AppText variant="subheading" color="heading">
            Pago con Bizum
          </AppText>
          <SimulationTag />
        </View>
        <TextButton label="Cancelar" style={styles.noShrink} onPress={() => closeSheet('cancel')} testID="demo-bizum-cancel" />
      </View>
      <View style={[styles.amountBox, { backgroundColor: c.surfaceAlt, borderRadius: theme.radius.md }]}>
        <AppText variant="caption" color="textSecondary">
          {`MediClaro Premium · ${months === 1 ? '1 mes' : `${months} meses`} · Pago único`}
        </AppText>
        <AppText variant="price" color="heading">
          {price}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          No se renueva solo.
        </AppText>
      </View>
      {step === 'phone' ? (
        <>
          <TextField
            label="Tu móvil de Bizum"
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/[^\d +]/g, '').slice(0, 15))}
            keyboardType="phone-pad"
            error={error}
            testID="demo-bizum-phone"
          />
          <PrimaryButton label={`Pagar ${price} con Bizum`} icon="lock-closed" onPress={pay} testID="demo-bizum-pay" />
        </>
      ) : (
        <View style={[styles.bankBox, { borderColor: c.border, borderRadius: theme.radius.md }]} testID="demo-bizum-bank">
          <Icon name="notifications" size={30} color="#0E9F9A" />
          <AppText variant="bodyStrong" color="heading" align="center">
            Acepta el pago en la app de tu banco
          </AppText>
          <AppText variant="caption" color="textSecondary" align="center">
            Te ha llegado un aviso de Bizum. En la simulación se acepta solo.
          </AppText>
        </View>
      )}
      <AppText variant="caption" color="textMuted" align="center">
        Modo demostración: imita el pago con Bizum en la página segura de Stripe. No se cobra nada.
      </AppText>
    </SheetFrame>
  );
}

/** IBAN de prueba de Stripe para España (modo de pruebas): nunca es una cuenta real. */
const TEST_IBAN = 'ES07 0012 0345 0300 0006 7890';

/** IBAN español con su dígito de control correcto (ISO 13616, módulo 97). */
export function isValidSpanishIban(value: string): boolean {
  const iban = value.replace(/\s+/g, '').toUpperCase();
  if (!/^ES\d{22}$/.test(iban)) return false;
  const moved = iban.slice(4) + iban.slice(0, 4);
  const digits = moved.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let rest = 0;
  for (const d of digits) rest = (rest * 10 + Number(d)) % 97;
  return rest === 1;
}

/** Domiciliación bancaria (IBAN + orden SEPA) o PayPal (entrar y aceptar), tal como lo pide la página de Stripe. */
function AltMethodSheet({ request }: { request: AltSheetRequest }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const sepa = request.kind === 'sepa';
  const [iban, setIban] = useState(TEST_IBAN);
  const [holder, setHolder] = useState('María García López');
  const [accepted, setAccepted] = useState(false);
  const [step, setStep] = useState<'form' | 'done'>('form');
  const [error, setError] = useState<string | null>(null);
  const price = formatPrice(request.priceCents);
  const per = perPeriodPhrase(request.period);

  const confirm = () => {
    if (sepa) {
      if (!isValidSpanishIban(iban)) {
        setError('Revisa el IBAN: empieza por ES y tiene 24 caracteres (lo ves en tu libreta o en la app del banco).');
        return;
      }
      if (holder.trim().length < 3) {
        setError('Escribe el nombre del titular de la cuenta.');
        return;
      }
      if (!accepted) {
        setError('Para domiciliar el pago tienes que aceptar la orden de domiciliación.');
        return;
      }
    }
    setError(null);
    setStep('done');
    setTimeout(() => closeSheet('confirm'), 1600);
  };

  return (
    <SheetFrame testID={sepa ? 'demo-sepa-sheet' : 'demo-paypal-sheet'}>
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Icon name={sepa ? 'business' : 'logo-paypal'} size={18} color={c.heading} />
          <AppText variant="subheading" color="heading">
            {sepa ? 'Domiciliación bancaria' : 'Pagar con PayPal'}
          </AppText>
          <SimulationTag />
        </View>
        <TextButton label="Cancelar" style={styles.noShrink} onPress={() => closeSheet('cancel')} testID={sepa ? 'demo-sepa-cancel' : 'demo-paypal-cancel'} />
      </View>
      <View style={[styles.amountBox, { backgroundColor: c.surfaceAlt, borderRadius: theme.radius.md }]}>
        <AppText variant="caption" color="textSecondary">
          {`MediClaro Premium · ${periodName(request.period)}`}
        </AppText>
        <AppText variant="price" color="heading">
          {price}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {`Se renueva ${per}. Cancela cuando quieras.`}
        </AppText>
      </View>
      {step === 'done' ? (
        <View style={[styles.bankBox, { borderColor: c.border, borderRadius: theme.radius.md }]} testID={sepa ? 'demo-sepa-done' : 'demo-paypal-done'}>
          <Icon name="checkmark-circle" size={30} color={c.successStrong} />
          <AppText variant="bodyStrong" color="heading" align="center">
            {sepa ? 'Domiciliación lista' : 'Pago aceptado en PayPal'}
          </AppText>
          <AppText variant="caption" color="textSecondary" align="center">
            {sepa ? 'El recibo llegará a tu banco. El primer cobro puede tardar unos días en confirmarse.' : 'Se cobrará en tu cuenta de PayPal en cada renovación.'}
          </AppText>
        </View>
      ) : sepa ? (
        <>
          <TextField label="IBAN de tu cuenta" value={iban} onChangeText={(t) => setIban(t.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 29))} autoCapitalize="characters" testID="demo-sepa-iban" />
          <TextField label="Titular de la cuenta" value={holder} onChangeText={setHolder} autoComplete="name" testID="demo-sepa-holder" />
          <Pressable
            onPress={() => setAccepted((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted }}
            style={styles.saveRow}
            testID="demo-sepa-mandate"
          >
            <Icon name={accepted ? 'checkbox' : 'square-outline'} size={26} color={accepted ? c.primary : c.textSecondary} />
            <AppText variant="caption" color="textSecondary" style={styles.flex}>
              Autorizo a cobrar en esta cuenta la suscripción (orden de domiciliación SEPA). Puedo pedir a mi banco la devolución de un recibo en las 8 semanas siguientes al cargo.
            </AppText>
          </Pressable>
          {error ? (
            <AppText variant="caption" color="dangerText" testID="demo-sepa-error">
              {error}
            </AppText>
          ) : null}
          <PrimaryButton label={`Domiciliar ${price}`} icon="lock-closed" onPress={confirm} testID="demo-sepa-pay" />
          <AppText variant="caption" color="textMuted" align="center">
            IBAN de prueba de Stripe: no es una cuenta real.
          </AppText>
        </>
      ) : (
        <>
          <View style={[styles.bankBox, { borderColor: c.border, borderRadius: theme.radius.md }]}>
            <Icon name="logo-paypal" size={30} color="#003087" />
            <AppText variant="bodyStrong" color="heading" align="center">
              Entra en tu cuenta de PayPal y acepta la suscripción
            </AppText>
            <AppText variant="caption" color="textSecondary" align="center">
              En la app real se abre la página oficial de PayPal. MediClaro nunca ve tu contraseña.
            </AppText>
          </View>
          <PrimaryButton label="Aceptar en PayPal" icon="lock-closed" onPress={confirm} testID="demo-paypal-pay" />
        </>
      )}
      <AppText variant="caption" color="textMuted" align="center">
        {`Modo demostración: imita ${sepa ? 'la domiciliación bancaria' : 'el pago con PayPal'} en la página segura de Stripe. No se cobra nada.`}
      </AppText>
    </SheetFrame>
  );
}

/**
 * Lo que ve el FAMILIAR al abrir el enlace (simulación): la invitación, la página segura de pago y la confirmación.
 * En la app real esto ocurre en el móvil del familiar, en la página de Stripe con este mismo texto.
 */
function FamilyPayerSheet({ request }: { request: FamilySheetRequest }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [step, setStep] = useState<'invite' | 'pay' | 'done'>('invite');
  const [number, setNumber] = useState(groupCard(TEST_CARD));
  const [name, setName] = useState('Javier Martín');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const who = request.invite.beneficiaryName || 'Tu familiar';
  const price = formatPrice(request.priceCents);
  const plan = `Suscripción ${periodName(request.period).toLowerCase()}`;
  const check = (text: string) => (
    <View style={styles.saveRow} key={text}>
      <Icon name="checkmark-circle" size={20} color={c.successStrong} />
      <AppText variant="body" color="text" style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
  return (
    <SheetFrame testID="demo-family-sheet">
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Icon name="eye-outline" size={18} color={c.heading} />
          <AppText variant="subheading" color="heading">
            Así lo verá tu familiar
          </AppText>
          <SimulationTag />
        </View>
        <TextButton label="Cerrar" style={styles.noShrink} onPress={() => closeSheet('cancel')} testID="demo-family-close" />
      </View>
      <View style={[styles.browserBar, { backgroundColor: c.surfaceAlt, borderRadius: theme.radius.pill }]}>
        <Icon name="lock-closed" size={14} color={c.successStrong} />
        <AppText variant="small" color="textSecondary">
          Página segura de pago · Stripe
        </AppText>
      </View>
      {step === 'invite' ? (
        <>
          <View style={styles.centerCol}>
            <MediClaroMark size={44} accessibilityLabel="" />
            <AppText variant="title" color="heading" align="center">
              Te han invitado a pagar MediClaro Premium
            </AppText>
            <AppText variant="body" color="textSecondary" align="center">
              {`${who} quiere que pagues su suscripción MediClaro Premium.`}
            </AppText>
          </View>
          <View style={[styles.amountBox, { backgroundColor: c.surfaceAlt, borderRadius: theme.radius.md, gap: 8 }]}>
            {check('Tú pagas la suscripción.')}
            {check(`${who} disfruta de todas las ventajas.`)}
            {check('No verás sus conversaciones ni su información médica.')}
          </View>
          <PrimaryButton label="Continuar" icon="arrow-forward" iconPosition="right" onPress={() => setStep('pay')} testID="demo-family-continue" />
        </>
      ) : step === 'pay' ? (
        <>
          <View style={[styles.amountBox, { backgroundColor: c.surfaceAlt, borderRadius: theme.radius.md }]}>
            <AppText variant="caption" color="textSecondary">
              {`MediClaro Premium · ${plan} · Para ${who}`}
            </AppText>
            <AppText variant="price" color="heading">
              {price}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {`Se renueva ${perPeriodPhrase(request.period)} hasta que canceles.`}
            </AppText>
          </View>
          <TextField
            label="Número de tarjeta"
            value={number}
            onChangeText={(t) => setNumber(groupCard(t.replace(/\D+/g, '').slice(0, 16)))}
            keyboardType="number-pad"
            error={error}
            testID="demo-family-card"
          />
          <TextField label="Nombre del titular" value={name} onChangeText={setName} autoCapitalize="words" />
          <PrimaryButton
            label="Pagar y activar"
            icon="lock-closed"
            loading={busy}
            onPress={() => {
              if (number.replace(/\D+/g, '') !== TEST_CARD) {
                setError('En la simulación solo vale la tarjeta de prueba 4242 4242 4242 4242.');
                return;
              }
              setError(null);
              setBusy(true);
              setTimeout(() => {
                setBusy(false);
                setStep('done');
              }, 900);
            }}
            testID="demo-family-pay"
          />
          <AppText variant="caption" color="textMuted" align="center">
            También podría pagar con Apple Pay o Google Pay.
          </AppText>
        </>
      ) : (
        <>
          <View style={styles.centerCol}>
            <Icon name="checkmark-circle" size={64} color={c.successStrong} />
            <AppText variant="title" color="heading" align="center">
              ¡Suscripción activada!
            </AppText>
            <AppText variant="body" color="textSecondary" align="center">
              {`Ya estás pagando MediClaro Premium para ${who}.`}
            </AppText>
          </View>
          <View style={[styles.amountBox, { backgroundColor: c.surfaceAlt, borderRadius: theme.radius.md, gap: 6 }]}>
            {[
              ['Beneficiario/a', who],
              ['Plan', `MediClaro Premium · ${periodName(request.period)}`],
              ['Precio', `${price} ${perPeriodPhrase(request.period)}`],
              ['Próximo cobro', renewalDate(request.period)],
            ].map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <AppText variant="caption" color="textSecondary">
                  {k}
                </AppText>
                <AppText variant="captionStrong" color="heading">
                  {v}
                </AppText>
              </View>
            ))}
          </View>
          <PrimaryButton label="Volver a MediClaro" onPress={() => closeSheet('confirm')} testID="demo-family-finish" />
        </>
      )}
      <AppText variant="caption" color="textMuted" align="center">
        Modo demostración: en la app real tu familiar lo hace en su móvil, en la página segura de Stripe. No se cobra nada.
      </AppText>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bankBox: { borderWidth: 1, padding: 16, gap: 8, alignItems: 'center' },
  noShrink: { flexShrink: 0 },
  browserBar: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  centerCol: { alignItems: 'center', gap: 8 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  overlay: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  appIcon: { width: 56, height: 56, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  amountBox: { padding: 14, gap: 2 },
  row2: { flexDirection: 'row', gap: 12 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
