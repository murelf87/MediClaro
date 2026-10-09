/**
 * Piezas del panel del propietario, copiadas del diseño que dio el propietario (12 pantallas), con el logo de
 * MediClaro:
 *  - Cabecera con el logo a la izquierda (flecha atrás en las pantallas interiores) y título grande con subtítulo.
 *  - Tarjetas blancas con borde fino, iconos azules (macizos o suaves), pastillas verdes / grises, pestañas con la
 *    seleccionada en azul, chips de periodo, buscador redondeado, botones azules y la barra inferior de la app.
 *  - Guardia: si el panel está cerrado, vuelve al acceso privado.
 * Textos con tamaños fijos de panel (el sistema puede agrandarlos hasta 1,3×).
 */
import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, RefreshControl, StyleSheet, TextInput, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText, Avatar, Icon, MediClaroLogo, Screen, type IconName } from '../../components';
import { StandaloneTabBar } from '../../components/BottomNavigation';
import { useAppTheme, useAsync } from '../../hooks';
import { MAX_FONT_SIZE_MULTIPLIER } from '../../theme';
import { OwnerAdminService, type OwnerPlan, type OwnerUser } from '../../services/OwnerAdminService';
import { ProfileService } from '../../services/ProfileService';
import { planText } from './ownerFormat';

export * from './ownerFormat';

// ── Colores y textos del diseño ──────────────────────────────────────────────────────────────────────────
export const OC = {
  blue: '#2563EB',
  bluePressed: '#1D4ED8',
  blueSoft: '#EAF1FF',
  blueLine: '#D5E3FF',
  card: '#FFFFFF',
  line: '#E3EAF5',
  green: '#15803D',
  greenSoft: '#DCF5E5',
  gray: '#475569',
  graySoft: '#EEF1F5',
  red: '#DC2626',
  redSoft: '#FDE8E8',
  pink: '#F472B6',
};

export const OT = StyleSheet.create({
  title: { fontSize: 27, lineHeight: 33, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  h2: { fontSize: 18, lineHeight: 24, fontWeight: '800', letterSpacing: -0.2 },
  cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  cardText: { fontSize: 12.5, lineHeight: 17, fontWeight: '400' },
  meta: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  number: { fontSize: 26, lineHeight: 31, fontWeight: '800', letterSpacing: -0.3 },
  button: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  label: { fontSize: 14, lineHeight: 19, fontWeight: '600' },
});

// ── Guardia y medidas ────────────────────────────────────────────────────────────────────────────────────
export function useOwnerUnlocked(): boolean {
  useSyncExternalStore(OwnerAdminService.subscribe, OwnerAdminService.snapshot, OwnerAdminService.snapshot);
  return OwnerAdminService.isUnlocked();
}

export function useOwnerGuard(): boolean {
  const unlocked = useOwnerUnlocked();
  const router = useRouter();
  useEffect(() => {
    if (!unlocked) router.replace('/owner' as Href);
  }, [unlocked, router]);
  return unlocked;
}

/** Foto de perfil del propietario (si tiene), para la cabecera y «Mi cuenta». Sin foto → iniciales. */
export function useOwnerPhoto(): string | null {
  const profile = useAsync(() => ProfileService.getProfile(), []);
  return profile.data?.avatarUrl ?? null;
}

/** ¿Pantalla estrecha o letra del sistema muy grande? (una columna en vez de dos). */
export function useNarrow(): boolean {
  const { width, fontScale } = useWindowDimensions();
  return width < 350 || fontScale > 1.25;
}

// ── Cabecera y pantalla ──────────────────────────────────────────────────────────────────────────────────
export function OwnerHeader({ back = true, right, admin, logo = true }: { back?: boolean; right?: ReactNode; admin?: boolean; logo?: boolean }) {
  const router = useRouter();
  const theme = useAppTheme();
  return (
    <View style={styles.header}>
      {back ? (
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/owner/dashboard' as Href))}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={10}
          testID="owner-back"
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon name="chevron-back" size={26} color={theme.colors.heading} />
        </Pressable>
      ) : null}
      {logo ? (
        <View style={styles.headerLogo}>
          <MediClaroLogo variant="horizontal" size="sm" />
          {admin ? <AppText style={[OT.meta, styles.adminLabel]} color="textSecondary">Administrador</AppText> : null}
        </View>
      ) : null}
      <View style={styles.flex} />
      {right}
    </View>
  );
}

export function OwnerScreen({
  title,
  subtitle,
  titleRight,
  children,
  back = true,
  headerRight,
  admin,
  refreshing,
  onRefresh,
  footer,
  keyboard,
  tabBar = true,
  testID,
}: {
  title?: string;
  subtitle?: string;
  titleRight?: ReactNode;
  children: ReactNode;
  back?: boolean;
  headerRight?: ReactNode;
  admin?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
  keyboard?: boolean;
  tabBar?: boolean;
  testID?: string;
}) {
  const unlocked = useOwnerGuard();
  return (
    <View style={styles.flex}>
      <Screen
        edges={tabBar ? ['top'] : ['top', 'bottom']}
        header={<OwnerHeader back={back} right={headerRight} admin={admin} />}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
        footer={footer}
        keyboard={keyboard}
        testID={testID}
      >
        {unlocked ? (
          <View style={styles.body}>
            {title ? <OwnerTitle title={title} subtitle={subtitle} right={titleRight} /> : null}
            {children}
          </View>
        ) : null}
      </Screen>
      {tabBar ? <StandaloneTabBar active="profile" /> : null}
    </View>
  );
}

export function OwnerTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.titleBlock}>
      <View style={styles.titleRow}>
        <AppText style={[OT.title, styles.flex]} color="heading" accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          {title}
        </AppText>
        {right}
      </View>
      {subtitle ? <AppText style={OT.subtitle} color="textSecondary">{subtitle}</AppText> : null}
    </View>
  );
}

// ── Piezas ───────────────────────────────────────────────────────────────────────────────────────────────
/** Icono del diseño: «solid» (cuadrado azul con icono blanco), «soft» (fondo azul claro) o «plain» (solo el icono). */
export function OIcon({
  icon,
  variant = 'solid',
  size = 36,
  color = OC.blue,
  bg,
  round,
}: {
  icon: IconName;
  variant?: 'solid' | 'soft' | 'plain';
  size?: number;
  color?: string;
  bg?: string;
  round?: boolean;
}) {
  if (variant === 'plain') return <Icon name={icon} size={Math.round(size * 0.72)} color={color} />;
  const background = bg ?? (variant === 'solid' ? color : OC.blueSoft);
  return (
    <View style={[styles.oicon, { width: size, height: size, borderRadius: round ? size / 2 : Math.round(size * 0.27), backgroundColor: background }]}>
      <Icon name={icon} size={Math.round(size * 0.56)} color={variant === 'solid' ? '#FFFFFF' : color} />
    </View>
  );
}

export function OCard({
  children,
  onPress,
  style,
  tone = 'white',
  selected,
  accessibilityLabel,
  testID,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: 'white' | 'blue';
  selected?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const base = [
    styles.card,
    tone === 'blue' ? { backgroundColor: '#F1F6FF', borderColor: OC.blueLine } : null,
    selected ? { borderColor: OC.blue, borderWidth: 2, backgroundColor: '#F5F9FF' } : null,
  ];
  if (!onPress) {
    return (
      <View style={[...base, style]} testID={testID} accessible={!!accessibilityLabel} accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      style={({ pressed }) => [...base, pressed ? { backgroundColor: '#F3F7FF' } : null, style]}
    >
      {children}
    </Pressable>
  );
}

export function OPill({ label, tone = 'green', solid, testID }: { label: string; tone?: 'green' | 'gray' | 'blue' | 'amber' | 'red'; solid?: boolean; testID?: string }) {
  const t =
    tone === 'green'
      ? { bg: OC.greenSoft, fg: OC.green }
      : tone === 'blue'
        ? { bg: OC.blueSoft, fg: OC.blue }
        : tone === 'amber'
          ? { bg: '#FEF3C7', fg: '#B45309' }
          : tone === 'red'
            ? { bg: OC.redSoft, fg: OC.red }
            : { bg: OC.graySoft, fg: OC.gray };
  const bg = solid ? (tone === 'green' ? '#139E64' : t.fg) : t.bg;
  return (
    <View style={[styles.pill, { backgroundColor: bg }]} testID={testID} accessible accessibilityLabel={label}>
      <AppText style={[OT.meta, { color: solid ? '#FFFFFF' : t.fg }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
        {label}
      </AppText>
    </View>
  );
}

export function OButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  disabled,
  loading,
  testID,
  style,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  variant?: 'primary' | 'outline' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const off = disabled || loading;
  const fg = variant === 'primary' ? '#FFFFFF' : variant === 'danger' ? OC.red : OC.blue;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      accessibilityLabel={label}
      testID={testID}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary'
          ? { backgroundColor: pressed ? OC.bluePressed : OC.blue }
          : { backgroundColor: pressed ? '#F3F7FF' : '#FFFFFF', borderWidth: 1.5, borderColor: variant === 'danger' ? '#F5C2C2' : OC.blueLine },
        off ? { opacity: 0.5 } : null,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={20} color={fg} /> : null}
      <AppText style={[OT.button, { color: fg }]} numberOfLines={2} align="center" maxFontSizeMultiplier={1.2}>
        {loading ? 'Un momento…' : label}
      </AppText>
    </Pressable>
  );
}

export function OLink({ label, onPress, testID, tone = 'blue', underline }: { label: string; onPress: () => void; testID?: string; tone?: 'blue' | 'red'; underline?: boolean }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="link" accessibilityLabel={label} hitSlop={8} testID={testID} style={styles.link}>
      <AppText style={[OT.label, { color: tone === 'red' ? OC.red : OC.blue }, underline ? { textDecorationLine: 'underline' } : null]}>{label}</AppText>
    </Pressable>
  );
}

/** Pestañas del diseño: la elegida en azul con letra blanca. */
export function OSegments<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel?: string;
}) {
  return (
    <View style={styles.segments} accessibilityRole="tablist" accessibilityLabel={accessibilityLabel}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            testID={`owner-tab-${o.value}`}
            style={[styles.segment, on ? { backgroundColor: OC.blue } : null]}
          >
            <AppText style={[OT.label, { color: on ? '#FFFFFF' : OC.gray }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Chips sueltos (periodos de las estadísticas). */
export function OChips<T extends string>({ options, value, onChange, fill }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; fill?: boolean }) {
  return (
    <View style={[styles.chips, fill ? { flexWrap: 'nowrap' } : null]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            testID={`owner-chip-${o.value}`}
            style={[styles.chip, fill ? styles.chipFill : null, on ? { backgroundColor: OC.blue, borderColor: OC.blue } : null]}
          >
            <AppText style={[OT.label, { color: on ? '#FFFFFF' : OC.gray }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function OSearch({ value, onChangeText, placeholder, testID }: { value: string; onChangeText: (v: string) => void; placeholder: string; testID?: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.search}>
      <Icon name="search" size={20} color="#94A3B8" />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        accessibilityLabel={placeholder.replace(/…|\.\.\./g, '')}
        autoCorrect={false}
        returnKeyType="search"
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        testID={testID}
        style={[styles.searchInput, { color: theme.colors.text }]}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} accessibilityRole="button" accessibilityLabel="Borrar la búsqueda" hitSlop={8}>
          <Icon name="close-circle" size={20} color="#94A3B8" />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Fila de lista del diseño: icono o foto, título, subtítulo, extra a la derecha y flecha. */
export function ORow({
  left,
  title,
  subtitle,
  meta,
  right,
  onPress,
  selected,
  chevron = !!onPress,
  danger,
  titleColor,
  testID,
  accessibilityLabel,
}: {
  left?: ReactNode;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  right?: ReactNode;
  onPress?: () => void;
  selected?: boolean;
  chevron?: boolean;
  danger?: boolean;
  titleColor?: string;
  testID?: string;
  accessibilityLabel?: string;
}) {
  return (
    <OCard onPress={onPress} selected={selected} testID={testID} accessibilityLabel={accessibilityLabel ?? [title, subtitle, meta].filter(Boolean).join('. ')} style={styles.row}>
      {left}
      <View style={[styles.flex, { gap: 2 }]}>
        <AppText style={[OT.cardTitle, danger ? { color: OC.red } : titleColor ? { color: titleColor } : null]} color="heading" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? <AppText style={OT.cardText} color="textSecondary" numberOfLines={2}>{subtitle}</AppText> : null}
        {meta ? <AppText style={OT.meta} color="textSecondary">{meta}</AppText> : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron-forward" size={20} color="#94A3B8" /> : null}
    </OCard>
  );
}

/** Ficha del panel principal: cuadrado azul con icono blanco, título y una línea. */
export function ODashTile({ icon, title, subtitle, onPress, wide, testID }: { icon: IconName; title: string; subtitle: string; onPress: () => void; wide?: boolean; testID?: string }) {
  return (
    <OCard onPress={onPress} testID={testID} accessibilityLabel={`${title}. ${subtitle}`} style={[styles.dashTile, { width: wide ? '100%' : '48%' }]}>
      <OIcon icon={icon} size={34} />
      <AppText style={OT.cardTitle} color="heading" numberOfLines={2}>{title}</AppText>
      <AppText style={OT.cardText} color="textSecondary" numberOfLines={3}>{subtitle}</AppText>
    </OCard>
  );
}

/** Cifra del diseño (estadísticas): icono redondo azul claro, etiqueta y número grande. */
export function OKpi({ icon, label, value, hint, wide, testID }: { icon: IconName; label: string; value: number | string; hint?: string; wide?: boolean; testID?: string }) {
  const shown = typeof value === 'number' ? value.toLocaleString('es-ES') : value;
  const word = typeof value === 'string' && /[a-záéíóúñ]{3,}/i.test(value);
  return (
    <OCard style={[styles.kpi, { width: wide ? '100%' : '48%' }]} testID={testID} accessibilityLabel={`${label}: ${shown}${hint ? `. ${hint}` : ''}`}>
      <OIcon icon={icon} variant="soft" size={40} round />
      <View style={[styles.flex, { gap: 2 }]}>
        <AppText style={styles.kpiLabel} color="textSecondary" numberOfLines={2}>{label}</AppText>
        <AppText style={word ? OT.h2 : OT.number} color="heading" numberOfLines={1} maxFontSizeMultiplier={1.15}>{shown}</AppText>
        {hint ? <AppText style={OT.meta} color="textSecondary" numberOfLines={2}>{hint}</AppText> : null}
      </View>
    </OCard>
  );
}

export function Grid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** Grupo de opciones con círculo (tipo de bono, duración). */
export function ORadioCard<T extends string | number | null>({
  title,
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  title: string;
  options: { value: T; label: string; description?: string }[];
  value: T;
  onChange: (v: T) => void;
  testIDPrefix?: string;
}) {
  return (
    <OCard style={{ gap: 2 }}>
      <AppText style={[OT.cardTitle, { marginBottom: 6 }]} color="heading">{title}</AppText>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.description ? `${o.label}. ${o.description}` : o.label}
            testID={testIDPrefix ? `${testIDPrefix}-${o.value ?? 'life'}` : undefined}
            style={styles.radioRow}
          >
            <View style={[styles.radio, { borderColor: on ? OC.blue : '#94A3B8' }]}>{on ? <View style={styles.radioDot} /> : null}</View>
            <View style={styles.flex}>
              <AppText style={[OT.subtitle, { fontWeight: on ? '700' : '500' }]} color="heading">{o.label}</AppText>
              {o.description ? <AppText style={OT.cardText} color="textSecondary">{o.description}</AppText> : null}
            </View>
          </Pressable>
        );
      })}
    </OCard>
  );
}

export function OStepper({ value, onChange, min = 1, max = 1000, testID }: { value: number; onChange: (v: number) => void; min?: number; max?: number; testID?: string }) {
  const btn = (icon: IconName, next: number, label: string, disabled: boolean) => (
    <Pressable
      onPress={() => onChange(next)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => [styles.stepBtn, { opacity: disabled ? 0.4 : 1, backgroundColor: pressed ? OC.blueSoft : '#FFFFFF' }]}
    >
      <Icon name={icon} size={22} color={OC.blue} />
    </Pressable>
  );
  return (
    <View style={styles.stepper}>
      {btn('remove', Math.max(min, value - 1), 'Uno menos', value <= min)}
      <View style={styles.stepValue} accessible accessibilityLabel={String(value)} accessibilityLiveRegion="polite">
        <AppText style={OT.h2} color="heading" testID={testID}>{value}</AppText>
      </View>
      {btn('add', Math.min(max, value + 1), 'Uno más', value >= max)}
    </View>
  );
}

/** Nota azul clara con icono de información. */
export function ONote({ children, tone = 'blue', testID }: { children: ReactNode; tone?: 'blue' | 'amber' | 'green' | 'red'; testID?: string }) {
  const t =
    tone === 'amber'
      ? { bg: '#FFF7E6', line: '#FBD38D', fg: '#B45309', icon: 'warning' as IconName }
      : tone === 'green'
        ? { bg: '#ECFBF2', line: '#BBE7CB', fg: OC.green, icon: 'checkmark-circle' as IconName }
        : tone === 'red'
          ? { bg: OC.redSoft, line: '#F5C2C2', fg: OC.red, icon: 'alert-circle' as IconName }
          : { bg: '#EEF4FF', line: OC.blueLine, fg: OC.blue, icon: 'information-circle' as IconName };
  return (
    <View style={[styles.note, { backgroundColor: t.bg, borderColor: t.line }]} testID={testID}>
      <Icon name={t.icon} size={22} color={t.fg} />
      <View style={styles.flex}>{typeof children === 'string' ? <AppText style={OT.cardText} color="text">{children}</AppText> : children}</View>
    </View>
  );
}

/** Línea de una lista de comprobación: círculo verde con ✓ (hecho), reloj ámbar (pendiente) o círculo gris (falta). */
export function OCheck({ label, detail, state = 'done', testID }: { label: string; detail?: string; state?: 'done' | 'pending' | 'todo'; testID?: string }) {
  const icon: IconName = state === 'done' ? 'checkmark-circle' : state === 'pending' ? 'time' : 'ellipse-outline';
  const color = state === 'done' ? '#16A34A' : state === 'pending' ? '#D97706' : '#94A3B8';
  const said = state === 'done' ? '' : state === 'pending' ? ' (pendiente)' : ' (falta)';
  return (
    <View style={styles.check} accessible accessibilityLabel={`${label}${said}${detail ? `. ${detail}` : ''}`} testID={testID}>
      <Icon name={icon} size={24} color={color} />
      <View style={[styles.flex, { gap: 1 }]}>
        <AppText style={OT.label} color="heading">{label}</AppText>
        {detail ? <AppText style={OT.cardText} color="textSecondary">{detail}</AppText> : null}
      </View>
    </View>
  );
}

/** Título de sección dentro de una pantalla del panel. */
export function OSection({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText style={[OT.h2, styles.flex]} color="heading" accessibilityRole="header">{title}</AppText>
      {right}
    </View>
  );
}

/** Campo de texto del panel (borde fino, etiqueta encima y contador opcional). */
export function OField({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  multiline,
  optional,
  counter,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  maxLength?: number;
  multiline?: boolean;
  optional?: boolean;
  counter?: boolean;
  testID?: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.section}>
        <AppText style={[OT.label, styles.flex]} color="heading">{optional ? `${label} (opcional)` : label}</AppText>
        {counter && maxLength ? <AppText style={OT.meta} color="textSecondary">{`${value.length}/${maxLength}`}</AppText> : null}
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        maxLength={maxLength}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        accessibilityLabel={label}
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        testID={testID}
        style={[styles.field, multiline ? styles.fieldMulti : null, { color: theme.colors.text }]}
      />
    </View>
  );
}

// ── Personas y planes ────────────────────────────────────────────────────────────────────────────────────
export const PLAN_TONE: Record<OwnerPlan, 'green' | 'gray' | 'blue'> = { owner: 'blue', paid: 'green', courtesy: 'green', free: 'gray' };

/** Etiqueta corta del diseño: Premium / Premium regalo / Propietario / Básico. */
export function planShort(plan: OwnerPlan): string {
  return plan === 'owner' ? 'Propietario' : plan === 'paid' ? 'Premium' : plan === 'courtesy' ? 'Premium regalo' : 'Básico';
}

export function PlanBadge({ plan }: { plan: OwnerPlan; provider?: string }) {
  return <OPill label={planShort(plan)} tone={PLAN_TONE[plan]} />;
}

/** Fila de una persona: iniciales, nombre, teléfono (oculto) y su plan. */
export function UserRow({ user, onPress, selected, testID }: { user: OwnerUser; onPress?: () => void; selected?: boolean; testID?: string }) {
  const name = user.name ?? 'Sin nombre';
  const sub = [user.phone ?? (user.anonymous ? 'Sin teléfono' : null), user.caregiver ? 'Cuidador/a' : null].filter(Boolean).join(' · ');
  return (
    <ORow
      left={<Avatar name={name} size={44} tone={user.plan === 'free' ? 'neutral' : 'primary'} />}
      title={name}
      subtitle={sub || null}
      right={<PlanBadge plan={user.plan} />}
      onPress={onPress}
      selected={selected}
      testID={testID}
      accessibilityLabel={`${name}. ${sub}. ${planText(user)}`}
    />
  );
}

export function Pager({ page, total, pageSize, onChange }: { page: number; total: number; pageSize: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <View style={styles.pager}>
      <OButton label="Anterior" icon="chevron-back" variant="outline" style={styles.flex} disabled={page <= 0} onPress={() => onChange(page - 1)} testID="owner-page-prev" />
      <AppText style={OT.meta} color="textSecondary">{`${page + 1} de ${pages}`}</AppText>
      <OButton label="Siguiente" variant="outline" style={styles.flex} disabled={page + 1 >= pages} onPress={() => onChange(page + 1)} testID="owner-page-next" />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingHorizontal: 20, gap: 6 },
  backBtn: { width: 34, height: 44, alignItems: 'flex-start', justifyContent: 'center', marginLeft: -4 },
  headerLogo: { alignItems: 'flex-start' },
  adminLabel: { marginLeft: 44, marginTop: -6 },
  body: { gap: 14, paddingTop: 4 },
  titleBlock: { gap: 4, marginBottom: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  oicon: { alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: OC.card,
    borderColor: OC.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  button: { minHeight: 50, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  link: { minHeight: 40, justifyContent: 'center', alignSelf: 'flex-start' },
  segments: { flexDirection: 'row', backgroundColor: '#FFFFFF', borderColor: OC.line, borderWidth: 1, borderRadius: 12, padding: 4, gap: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E4ECF8', backgroundColor: '#F1F5FC', alignItems: 'center', justifyContent: 'center' },
  chipFill: { flex: 1, paddingHorizontal: 4 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: OC.line, backgroundColor: '#FFFFFF', paddingHorizontal: 14 },
  searchInput: { flex: 1, fontSize: 15, minHeight: 44, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  dashTile: { gap: 8, minHeight: 132 },
  kpi: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  kpiLabel: { fontSize: 11.5, lineHeight: 15, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: OC.blue },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: OC.line, alignItems: 'center', justifyContent: 'center' },
  stepValue: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: OC.line, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  note: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: 12, padding: 12, alignItems: 'flex-start' },
  pager: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 6 },
  section: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  field: { fontSize: 16, minHeight: 48, borderWidth: 1, borderColor: OC.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#FFFFFF' },
  fieldMulti: { minHeight: 110 },
});
