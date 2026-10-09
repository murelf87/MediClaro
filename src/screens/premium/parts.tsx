/**
 * Piezas locales de Premium y pago (no son componentes compartidos).
 *
 *  - Marca: PremiumPill, BrandHeader (logo del corazón centrado; el de siempre).
 *  - Planes: PlanPicker (3 columnas si caben con el tamaño de letra elegido; si no, filas), PlanSummary.
 *  - Ventajas: BenefitGrid (2 columnas o 1), BenefitList, CheckList.
 *  - Pago: MethodCard, CardBrands, SecureNote, RenewalNote, LegalLinks.
 *  - Estados: StatusHero, PremiumSkeleton; CrownIcon (vista «Tu plan» sin compras).
 * Los precios SIEMPRE llegan de PurchaseService/SubscriptionService: aquí solo se formatean.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import {
  AppHeader,
  AppText,
  Card,
  CheckItem,
  Icon,
  MediClaroLogo,
  ProgressRing,
  Skeleton,
  TextButton,
  type IconName,
} from '../../components';
import { FadeIn, Shimmer, stagger } from '../../components/Motion';
import { useAppTheme } from '../../hooks';
import { fontScale } from '../../theme';
import { isAppError, periodName, perPeriodPhrase, perPeriodShort } from '../../services';
import { formatPrice } from '../../utils/format';
import { alwaysFreeNote } from '../../services/planCatalog';
import type { PlanBenefit, PlanOffer } from '../../types';

export { periodName, perPeriodPhrase, perPeriodShort };

// ─── Utilidades ──────────────────────────────────────────────────────────────

/** Mensaje listo para mostrar (los AppError ya vienen en español). */
export function errorMessage(e: unknown): string {
  return isAppError(e) ? e.message : 'Ha ocurrido un error. Inténtalo de nuevo.';
}

/** «39,99 € al año» */
export function priceWithPeriod(offer: PlanOffer): string {
  return `${offer.displayPrice} ${perPeriodPhrase(offer.plan.period)}`;
}

/** Plan inicial: el destacado; si no, el primero. */
export function defaultOffer(offers: PlanOffer[]): PlanOffer | null {
  return offers.find((o) => o.plan.highlighted) ?? offers[0] ?? null;
}

/** Texto de la cinta del plan destacado («RECOMENDADO», o la etiqueta configurada). */
function ribbonText(offer: PlanOffer): string | null {
  return offer.plan.badge ? offer.plan.badge.toUpperCase() : null;
}

function planAccessibilityLabel(offer: PlanOffer): string {
  const p = offer.plan;
  return [
    `Plan ${periodName(p.period).toLowerCase()}`,
    p.tagline,
    priceWithPeriod(offer),
    p.period !== 'monthly' ? `equivale a ${formatPrice(p.monthlyEquivalentCents)} al mes` : null,
    p.savingsLabel,
    p.badge,
  ]
    .filter(Boolean)
    .join(', ');
}

// ─── Marca ───────────────────────────────────────────────────────────────────

/** Etiqueta dorada «PREMIUM». */
export function PremiumPill({ style }: { style?: StyleProp<ViewStyle> }) {
  const c = useAppTheme().colors;
  return (
    <View style={[styles.pill, { backgroundColor: c.premiumSoft, borderColor: '#FCD34D' }, style]} accessibilityLabel="Premium">
      <AppText variant="small" style={[styles.pillText, { color: c.premiumText }]}>
        PREMIUM
      </AppText>
    </View>
  );
}

/**
 * Cabecera de las pantallas Premium: volver + logo de MediClaro (el del corazón) centrado.
 * `pill="inline"` pone «PREMIUM» junto al logo (pantalla de planes).
 */
export function BrandHeader({
  pill = false,
  showBack = true,
  onBack,
  fallbackHref = '/welcome',
  right,
}: {
  pill?: 'inline' | false;
  showBack?: boolean;
  onBack?: () => void;
  fallbackHref?: Href;
  right?: ReactNode;
}) {
  return (
    <AppHeader
      showBack={showBack}
      onBack={onBack}
      fallbackHref={fallbackHref}
      right={right}
      center={
        <View style={styles.brandRow}>
          <MediClaroLogo variant="horizontal" size="sm" />
          {pill === 'inline' ? <PremiumPill /> : null}
        </View>
      }
    />
  );
}

// ─── Radio ───────────────────────────────────────────────────────────────────

export function RadioMark({ selected }: { selected: boolean }) {
  const c = useAppTheme().colors;
  const scale = useRef(new Animated.Value(selected ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: selected ? 1 : 0, useNativeDriver: false, friction: 6, tension: 140 }).start();
  }, [selected, scale]);
  return (
    <View style={[styles.radio, { borderColor: selected ? c.primary : c.borderStrong, backgroundColor: c.surface }]}>
      <Animated.View style={[styles.radioDot, { backgroundColor: c.primary, transform: [{ scale }] }]} />
    </View>
  );
}

// ─── Chips ───────────────────────────────────────────────────────────────────

function PlanChip({ offer }: { offer: PlanOffer }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const savings = offer.plan.savingsLabel;
  const label = savings ?? (offer.plan.period === 'monthly' ? 'Cancela cuando quieras' : null);
  if (!label) return null;
  const green = !!savings;
  return (
    <View
      style={[
        styles.chip,
        { backgroundColor: green ? c.successSoft : c.primaryTint, borderColor: green ? '#A7F3D0' : c.primarySoft },
      ]}
    >
      <Icon name={green ? 'pricetag' : 'refresh-circle'} size={14} color={green ? c.successStrong : c.primaryPressed} />
      <AppText variant="small" style={{ color: green ? c.successText : c.primaryPressed, flexShrink: 1 }}>
        {label}
      </AppText>
    </View>
  );
}

function Ribbon({ text, compact = false }: { text: string; compact?: boolean }) {
  const c = useAppTheme().colors;
  const [size, setSize] = useState({ w: 0, h: 0 });
  return (
    <View
      style={[styles.ribbon, compact ? styles.ribbonCompact : null, { backgroundColor: c.primary }]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <AppText variant="small" style={styles.ribbonText} numberOfLines={1}>
        {text}
      </AppText>
      {size.w ? <Shimmer width={size.w} height={size.h} radius={10} /> : null}
    </View>
  );
}

// ─── Selector de planes ──────────────────────────────────────────────────────

interface PlanOptionProps {
  offer: PlanOffer;
  selected: boolean;
  onSelect: () => void;
  index: number;
}

function usePressScale(selected: boolean) {
  const bump = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!selected) return;
    Animated.sequence([
      Animated.timing(bump, { toValue: 0.97, duration: 90, useNativeDriver: false }),
      Animated.spring(bump, { toValue: 1, friction: 4, tension: 160, useNativeDriver: false }),
    ]).start();
  }, [selected, bump]);
  return bump;
}

/** Tarjeta vertical (3 columnas), como en el tablero. */
function PlanColumn({ offer, selected, onSelect }: PlanOptionProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const ribbon = ribbonText(offer);
  const bump = usePressScale(selected);
  return (
    <Animated.View style={[styles.flex, { transform: [{ scale: bump }] }]}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, selected }}
        accessibilityLabel={planAccessibilityLabel(offer)}
        testID={`plan-${offer.plan.period}`}
        style={({ pressed }) => [
          styles.planCol,
          {
            borderRadius: theme.radius.lg,
            borderColor: selected ? c.primary : c.border,
            borderWidth: selected ? 2 : 1,
            padding: selected ? 11 : 12,
            paddingTop: ribbon ? (selected ? 17 : 18) : selected ? 11 : 12,
            backgroundColor: selected ? c.primaryTint : pressed ? c.surfaceAlt : c.surface,
          },
          selected ? theme.shadow.card : null,
        ]}
      >
        <View style={styles.planColHead}>
          <AppText variant="label" color="heading" style={styles.flex} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {periodName(offer.plan.period)}
          </AppText>
          <RadioMark selected={selected} />
        </View>
        {offer.plan.tagline ? (
          <AppText variant="small" color="textSecondary" style={styles.tagline} numberOfLines={2}>
            {offer.plan.tagline}
          </AppText>
        ) : null}
        <View style={styles.flexGrow} />
        <AppText variant="price" color="heading" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.priceCol}>
          {offer.displayPrice}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {perPeriodShort(offer.plan.period)}
        </AppText>
        <View style={styles.chipWrap}>
          <PlanChip offer={offer} />
        </View>
      </Pressable>
      {ribbon ? (
        <View style={styles.ribbonAnchor} pointerEvents="none">
          <Ribbon text={ribbon} compact />
        </View>
      ) : null}
    </Animated.View>
  );
}

/** Fila a todo el ancho (pantallas estrechas o letra grande). */
function PlanRowItem({ offer, selected, onSelect }: PlanOptionProps) {
  const theme = useAppTheme();
  const c = theme.colors;
  const ribbon = ribbonText(offer);
  const bump = usePressScale(selected);
  return (
    <Animated.View style={{ transform: [{ scale: bump }] }}>
      <Pressable
        onPress={onSelect}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected, selected }}
        accessibilityLabel={planAccessibilityLabel(offer)}
        testID={`plan-${offer.plan.period}`}
        style={({ pressed }) => [
          styles.planRow,
          {
            minHeight: theme.touchTargets.large + 8,
            borderRadius: theme.radius.lg,
            borderColor: selected ? c.primary : c.border,
            borderWidth: selected ? 2 : 1,
            padding: selected ? 13 : 14,
            paddingTop: ribbon ? (selected ? 19 : 20) : selected ? 13 : 14,
            backgroundColor: selected ? c.primaryTint : pressed ? c.surfaceAlt : c.surface,
          },
          selected ? theme.shadow.card : null,
        ]}
      >
        <RadioMark selected={selected} />
        <View style={[styles.flex, { gap: 2 }]}>
          <AppText variant="bodyStrong" color="heading">
            {periodName(offer.plan.period)}
          </AppText>
          {offer.plan.tagline ? (
            <AppText variant="caption" color="textSecondary">
              {offer.plan.tagline}
            </AppText>
          ) : null}
          <View style={styles.chipStart}>
            <PlanChip offer={offer} />
          </View>
        </View>
        <View style={styles.endAligned}>
          <AppText variant="heading" color="heading">
            {offer.displayPrice}
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {perPeriodShort(offer.plan.period)}
          </AppText>
        </View>
      </Pressable>
      {ribbon ? (
        <View style={styles.ribbonAnchorRight} pointerEvents="none">
          <Ribbon text={ribbon} />
        </View>
      ) : null}
    </Animated.View>
  );
}

/**
 * Selector de planes adaptable: columnas si cada tarjeta tiene al menos ~104 pt (× tamaño de letra);
 * si no, filas legibles. Nunca se corta un precio.
 */
export function PlanPicker({
  offers,
  selectedId,
  onSelect,
}: {
  offers: PlanOffer[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const theme = useAppTheme();
  const [width, setWidth] = useState(0);
  const gap = theme.spacing.xs;
  const scale = fontScale[theme.fontSize];
  const n = offers.length;
  const columns = n >= 2 && n <= 3 && width > 0 && (width - gap * (n - 1)) / n >= 104 * scale;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} accessibilityRole="radiogroup" accessibilityLabel="Elige tu plan">
      {width === 0 ? null : columns ? (
        <View style={[styles.columns, { gap }]}>
          {offers.map((o, i) => (
            <FadeIn key={o.plan.id} delay={stagger(i, 90, 120)} style={styles.flex}>
              <PlanColumn offer={o} index={i} selected={o.plan.id === selectedId} onSelect={() => onSelect(o.plan.id)} />
            </FadeIn>
          ))}
        </View>
      ) : (
        <View style={{ gap: theme.spacing.sm }}>
          {offers.map((o, i) => (
            <FadeIn key={o.plan.id} delay={stagger(i, 90, 120)}>
              <PlanRowItem offer={o} index={i} selected={o.plan.id === selectedId} onSelect={() => onSelect(o.plan.id)} />
            </FadeIn>
          ))}
        </View>
      )}
    </View>
  );
}

/** Resumen del plan elegido (forma de pago, tarjeta, confirmación). */
export function PlanSummary({ offer, onChange }: { offer: PlanOffer; onChange?: () => void }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const p = offer.plan;
  return (
    <View
      style={[styles.summary, { backgroundColor: c.surface, borderColor: c.border, borderRadius: theme.radius.lg }, theme.shadow.card]}
      accessible={!onChange}
      accessibilityLabel={`Has elegido: MediClaro Premium, plan ${periodName(p.period).toLowerCase()}, ${priceWithPeriod(offer)}`}
    >
      <View style={[styles.summaryIcon, { backgroundColor: c.primaryTint }]}>
        <CrownIcon size={30} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" color="heading">
          {`Plan ${periodName(p.period).toLowerCase()}`}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {`MediClaro Premium · ${priceWithPeriod(offer)}`}
        </AppText>
      </View>
      {onChange ? <TextButton label="Cambiar" onPress={onChange} accessibilityHint="Vuelve a los planes" testID="summary-change-plan" /> : null}
    </View>
  );
}

// ─── Ventajas ────────────────────────────────────────────────────────────────

const BENEFIT_STYLE: Record<string, { icon: IconName; color: string; bg: string }> = {
  assistant: { icon: 'chatbubble-ellipses', color: '#2563EB', bg: '#DBEAFE' },
  medicines: { icon: 'heart', color: '#EF4444', bg: '#FEE2E2' },
  identify: { icon: 'camera', color: '#059669', bg: '#D1FAE5' },
  emergency: { icon: 'location', color: '#D97706', bg: '#FEF3C7' },
  voice: { icon: 'volume-high', color: '#7C3AED', bg: '#EDE9FE' },
  accessibility: { icon: 'settings', color: '#475569', bg: '#E2E8F0' },
};
const DEFAULT_BENEFIT_STYLE = { icon: 'checkmark-circle' as IconName, color: '#2563EB', bg: '#DBEAFE' };

export function BenefitIcon({ id, size = 40 }: { id: string; size?: number }) {
  const s = BENEFIT_STYLE[id] ?? DEFAULT_BENEFIT_STYLE;
  return (
    <View style={[styles.benefitIcon, { width: size, height: size, borderRadius: size / 2, backgroundColor: s.bg }]}>
      <Icon name={s.icon} size={Math.round(size * 0.5)} color={s.color} />
    </View>
  );
}

/** Ventajas en cuadrícula (2 columnas si caben; si no, 1). */
export function BenefitGrid({ benefits, title }: { benefits: PlanBenefit[]; title?: string }) {
  const theme = useAppTheme();
  const [width, setWidth] = useState(0);
  const scale = fontScale[theme.fontSize];
  const twoCols = width > 0 && (width - theme.spacing.sm) / 2 >= 150 * scale;
  const freeNote = alwaysFreeNote(benefits);
  if (!benefits.length) return null;
  return (
    <View
      style={[styles.benefits, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radius.lg }]}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 32)}
    >
      {title ? (
        <AppText variant="subheading" color="heading" accessibilityRole="header" style={{ marginBottom: theme.spacing.sm }}>
          {title}
        </AppText>
      ) : null}
      <View style={[styles.benefitWrap, { rowGap: theme.spacing.sm, columnGap: theme.spacing.sm }]}>
        {benefits.map((b, i) => (
          <FadeIn key={b.id} delay={stagger(i, 60, 250)} style={twoCols ? styles.half : styles.full}>
            <View style={styles.benefitItem} accessible accessibilityLabel={b.detail ? `${b.label}. ${b.detail}` : b.label}>
              <BenefitIcon id={b.id} />
              <View style={styles.flex}>
                <AppText variant="captionStrong" color="heading">
                  {b.label}
                </AppText>
                {b.detail ? (
                  <AppText variant="small" color="textSecondary" style={styles.benefitDetail}>
                    {b.detail}
                  </AppText>
                ) : null}
              </View>
            </View>
          </FadeIn>
        ))}
      </View>
      {freeNote ? (
        <View style={[styles.freeNote, { marginTop: theme.spacing.sm, borderTopColor: theme.colors.border }]} accessible testID="benefits-free-note">
          <Icon name="shield-checkmark" size={18} color={theme.colors.successStrong} />
          <AppText variant="small" color="textSecondary" style={styles.flex}>
            {freeNote}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/** Lista con checks (vista de suscripción activa). */
export function BenefitList({ benefits, title }: { benefits: PlanBenefit[]; title?: string }) {
  const theme = useAppTheme();
  if (!benefits.length) return null;
  return (
    <Card>
      {title ? (
        <AppText variant="subheading" color="heading" accessibilityRole="header" style={{ marginBottom: theme.spacing.xs }}>
          {title}
        </AppText>
      ) : null}
      <View style={{ gap: theme.spacing.xs }}>
        {benefits.map((b) => (
          <CheckItem key={b.id} label={b.label} detail={b.detail} />
        ))}
      </View>
    </Card>
  );
}

/** Lista de comprobación animada (confirmación). */
export function CheckList({ items, startDelay = 500 }: { items: string[]; startDelay?: number }) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      {items.map((label, i) => (
        <FadeIn key={label} delay={stagger(i, 110, startDelay)} from="left">
          <CheckItem label={label} />
        </FadeIn>
      ))}
    </View>
  );
}

// ─── Pago ────────────────────────────────────────────────────────────────────

/** Opción de forma de pago (tarjeta grande con flecha). */
export function MethodCard({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  onPress,
  loading = false,
  disabled = false,
  badge,
  extra,
  testID,
}: {
  icon: IconName;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Etiqueta breve junto al título («Recomendado», «Sin tarjeta»…). */
  badge?: { label: string; color: string; bg: string };
  /** Contenido debajo del texto (p. ej. marcas de tarjeta). */
  extra?: ReactNode;
  testID?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={`${title}${badge ? ` (${badge.label})` : ''}. ${subtitle}`}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.method,
        {
          minHeight: theme.touchTargets.large + 24,
          borderRadius: theme.radius.lg,
          borderColor: pressed ? c.primary : c.border,
          backgroundColor: pressed ? c.primaryTint : c.surface,
          opacity: disabled ? 0.5 : 1,
        },
        theme.shadow.card,
      ]}
    >
      <View style={[styles.methodIcon, { backgroundColor: iconBg, borderRadius: theme.radius.md }]}>
        <Icon name={icon} size={30} color={iconColor} />
      </View>
      <View style={[styles.flex, { gap: 2 }]}>
        {badge ? (
          <View style={[styles.methodBadge, { backgroundColor: badge.bg }]}>
            <AppText variant="small" style={{ color: badge.color }}>
              {badge.label}
            </AppText>
          </View>
        ) : null}
        <AppText variant="bodyStrong" color="heading">
          {title}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {subtitle}
        </AppText>
        {extra ? <View style={{ marginTop: 6 }}>{extra}</View> : null}
      </View>
      {loading ? (
        <ProgressRing size={28} strokeWidth={3} gradient={false} />
      ) : (
        <Icon name="chevron-forward" size={24} color={c.primary} />
      )}
    </Pressable>
  );
}

/** Marcas de tarjeta aceptadas (dibujadas, sin imágenes de terceros). */
export function CardBrands({ compact = false }: { compact?: boolean }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const h = compact ? 26 : 32;
  return (
    <View style={styles.brands} accessible accessibilityLabel="Tarjetas Visa, Mastercard y más">
      <View style={[styles.brandBox, { height: h, borderColor: c.border, backgroundColor: c.surface }]}>
        <AppText variant="captionStrong" style={styles.visa}>
          VISA
        </AppText>
      </View>
      <View style={[styles.brandBox, { height: h, borderColor: c.border, backgroundColor: c.surface }]}>
        <Svg width={34} height={20} viewBox="0 0 34 20">
          <Circle cx={12} cy={10} r={9} fill="#EB001B" />
          <Circle cx={22} cy={10} r={9} fill="#F79E1B" opacity={0.9} />
        </Svg>
      </View>
      <View style={[styles.brandBox, { height: h, borderColor: c.border, backgroundColor: c.surface }]}>
        <AppText variant="small" color="textSecondary">
          y más
        </AppText>
      </View>
    </View>
  );
}

/** Nota de seguridad con candado. */
export function SecureNote({ text, center = true }: { text: string; center?: boolean }) {
  const c = useAppTheme().colors;
  return (
    <View style={[styles.secure, center ? styles.center : null]} accessible accessibilityLabel={text}>
      <Icon name="lock-closed" size={15} color={c.textMuted} />
      <AppText variant="caption" color="textSecondary" style={styles.flexShrink} align={center ? 'center' : 'left'}>
        {text}
      </AppText>
    </View>
  );
}

/** Información obligatoria de la suscripción junto al botón de pago (precio, periodo, renovación). */
export function RenewalNote({ offer }: { offer: PlanOffer }) {
  return (
    <AppText variant="caption" color="textSecondary" align="center" testID="renewal-note">
      {`${priceWithPeriod(offer)} · Renovación automática. Cancela cuando quieras, sin permanencia.`}
    </AppText>
  );
}

/** Duración del periodo en palabras («1 mes», «3 meses», «12 meses»). */
export function periodSpan(period: PlanOffer['plan']['period']): string {
  return period === 'monthly' ? '1 mes' : period === 'quarterly' ? '3 meses' : '12 meses';
}

/** Bizum: pago único por el periodo, sin renovación automática (Bizum no admite cobros recurrentes). */
export function OneTimeNote({ offer }: { offer: PlanOffer }) {
  return (
    <AppText variant="caption" color="textSecondary" align="center" testID="one-time-note">
      {`${offer.displayPrice} · Pago único por ${periodSpan(offer.plan.period)}. No se renueva solo: te avisaremos antes de que termine.`}
    </AppText>
  );
}

/** «Restaurar compra | Condiciones de suscripción | Política de privacidad». */
export function LegalLinks({ onRestore, restoring = false }: { onRestore?: () => void; restoring?: boolean }) {
  const router = useRouter();
  const theme = useAppTheme();
  const sep = (
    <AppText variant="caption" color="textMuted" accessibilityElementsHidden importantForAccessibility="no">
      |
    </AppText>
  );
  return (
    <View style={[styles.legal, { gap: theme.spacing.xxs }]}>
      {onRestore ? (
        <>
          <TextButton
            label={restoring ? 'Comprobando…' : 'Restaurar compra'}
            tone="muted"
            onPress={onRestore}
            disabled={restoring}
            testID="premium-restore"
          />
          {sep}
        </>
      ) : null}
      <TextButton
        label="Condiciones de suscripción"
        tone="muted"
        onPress={() => router.push({ pathname: '/legal', params: { section: 'subscription' } })}
        testID="premium-terms"
      />
      {sep}
      <TextButton
        label="Política de privacidad"
        tone="muted"
        onPress={() => router.push({ pathname: '/legal', params: { section: 'privacy' } })}
        testID="premium-privacy"
      />
    </View>
  );
}

// ─── Corona (vista «Tu plan») ────────────────────────────────────────────────

export function CrownIcon({ size = 64, decorative = true }: { size?: number; decorative?: boolean }) {
  const height = Math.round((size * 50) / 64);
  const gradientId = `mcCrownGold${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  return (
    <View
      style={{ width: size, height }}
      accessible={!decorative}
      accessibilityRole={decorative ? undefined : 'image'}
      accessibilityLabel={decorative ? undefined : 'MediClaro Premium'}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : 'yes'}
    >
      <Svg width={size} height={height} viewBox="0 0 64 50">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FCD34D" />
            <Stop offset="1" stopColor="#F59E0B" />
          </LinearGradient>
        </Defs>
        <Path
          d="M10 17.5 L21 29 L32 12.5 L43 29 L54 17.5 L50.5 37 L13.5 37 Z"
          fill={`url(#${gradientId})`}
          stroke={`url(#${gradientId})`}
          strokeWidth={3.5}
          strokeLinejoin="round"
        />
        <Circle cx={9} cy={13.5} r={4.6} fill="#FBBF24" />
        <Circle cx={32} cy={8} r={5.2} fill="#FBBF24" />
        <Circle cx={55} cy={13.5} r={4.6} fill="#FBBF24" />
        <Rect x={12.5} y={41.5} width={39} height={6} rx={3} fill="#F59E0B" />
      </Svg>
    </View>
  );
}

// ─── Estados ─────────────────────────────────────────────────────────────────

export type HeroTone = 'success' | 'primary' | 'neutral';

/** Icono grande + título + mensaje. `spinning`: anillo de progreso alrededor del icono. */
export function StatusHero({
  icon,
  tone,
  title,
  message,
  spinning = false,
  children,
}: {
  icon: IconName;
  tone: HeroTone;
  title: string;
  message?: string;
  spinning?: boolean;
  children?: ReactNode;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const palette = {
    success: { halo: c.successSoft, fill: c.successStrong, fg: c.onPrimary },
    primary: { halo: c.primaryTint, fill: c.primarySoft, fg: c.primary },
    neutral: { halo: c.surfaceAlt, fill: c.surfaceMuted, fg: c.textSecondary },
  }[tone];
  const badge = (
    <View style={[styles.heroInner, { backgroundColor: palette.fill }]}>
      <Icon name={icon} size={46} color={palette.fg} />
    </View>
  );
  return (
    <View style={[styles.hero, { gap: theme.spacing.sm }]} accessibilityLiveRegion="polite">
      {spinning ? (
        <ProgressRing size={128} strokeWidth={9}>
          {badge}
        </ProgressRing>
      ) : (
        <View style={[styles.heroHalo, { backgroundColor: palette.halo }]}>{badge}</View>
      )}
      <AppText variant="title" align="center" accessibilityRole="header" style={{ marginTop: theme.spacing.xs }}>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" color="textSecondary" align="center" style={styles.heroMessage}>
          {message}
        </AppText>
      ) : null}
      {children}
    </View>
  );
}

export function PremiumSkeleton() {
  const theme = useAppTheme();
  return (
    <View style={{ gap: theme.spacing.md }} accessibilityRole="progressbar" accessibilityLabel="Cargando">
      <View style={[styles.columns, { gap: theme.spacing.xs }]}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={150} radius={theme.radius.lg} style={styles.flex} />
        ))}
      </View>
      <Skeleton height={190} radius={theme.radius.lg} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
  flexShrink: { flexShrink: 1 },
  center: { justifyContent: 'center' },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1, alignSelf: 'center' },
  pillText: { letterSpacing: 1.2, fontWeight: '800' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  chipWrap: { marginTop: 8, alignItems: 'flex-start' },
  chipStart: { alignSelf: 'flex-start', marginTop: 4 },
  ribbon: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  ribbonCompact: { paddingHorizontal: 8 },
  ribbonText: { color: '#FFFFFF', letterSpacing: 0.6, fontWeight: '800' },
  ribbonAnchor: { position: 'absolute', top: -11, left: 0, right: 0, alignItems: 'center' },
  ribbonAnchorRight: { position: 'absolute', top: -11, right: 14 },
  columns: { flexDirection: 'row', alignItems: 'stretch' },
  planCol: { flex: 1, minHeight: 176 },
  planColHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tagline: { marginTop: 2 },
  priceCol: { marginTop: 10 },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  endAligned: { alignItems: 'flex-end' },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderWidth: 1 },
  summaryIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  benefits: { padding: 16, borderWidth: 1 },
  benefitWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  half: { width: '48%', flexGrow: 1 },
  full: { width: '100%' },
  benefitItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  benefitIcon: { alignItems: 'center', justifyContent: 'center' },
  benefitDetail: { fontWeight: '400' },
  freeNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  method: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderWidth: 1.5 },
  methodIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  methodBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, marginBottom: 2 },
  brands: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  brandBox: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', minWidth: 52 },
  visa: { color: '#1A1F71', fontStyle: 'italic', fontWeight: '900', letterSpacing: 0.5 },
  secure: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legal: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingTop: 8 },
  heroHalo: { width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center' },
  heroInner: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  heroMessage: { maxWidth: 440 },
});
