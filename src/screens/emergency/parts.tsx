/**
 * Piezas LOCALES del módulo de emergencia (solo para src/screens/emergency).
 *
 * Reglas que cumplen todas las pantallas del flujo:
 *  - El 112 (botón ROJO) está siempre visible y puede abrirse por pulsación o tras la escalada configurada.
 *  - La escalada al 112 solo ocurre después de detectar la posible emergencia, falta de respuesta
 *    y el intento previo de contacto con la persona designada cuando existe.
 *  - La app abre el mecanismo telefónico permitido por el sistema; iOS/Android pueden exigir confirmación.
 *  - Nada de diagnósticos: solo se muestra lo que la persona declaró o indicó.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused, useNavigation, useRouter } from 'expo-router';
import { AppText, Card, Icon, InfoBanner, PrimaryButton, type IconName } from '../../components';
import { useAppTheme, useAsync, useEmergencySession, useRefreshOnFocus, useSession } from '../../hooks';
import {
  EmergencyService,
  EmergencySession,
  QUICK_SYMPTOMS,
  isAppError,
  type ActivationMode,
  type PreparedEmergency,
  type QuickSymptomId,
} from '../../services';
import { DEMO_ACCESS_ENABLED, PUBLIC_HEALTH_RESOURCES } from '../../config/app';
import { callPhone, openMaps } from '../../utils/device';
import { showAlert } from '../../utils/dialogs';
import { formatTime } from '../../utils/format';

// ─── Rutas del flujo (mapa de rutas del proyecto) ─────────────────────────────

export type CallTargetParam = 'private' | 'official';

export const EMERGENCY_HREF = {
  main: '/emergency',
  confirm: '/emergency/confirm',
  prepared: '/emergency/prepared',
  calling: '/emergency/calling',
  noAnswer: '/emergency/no-answer',
  notify: '/emergency/notify',
  voiceMessage: '/emergency/voice-message',
  profile: '/emergency-profile',
  profileEdit: '/emergency-profile-edit',
  sharing: '/emergency-sharing',
  privateAssistance: '/private-assistance',
  home: '/(tabs)',
} as const;

/** `from=prepared`: el asistente se abrió desde "Tu información" y vuelve a ella. */
export function assistantHref(mode: ActivationMode, fromPrepared = false): string {
  return `/emergency/assistant?mode=${mode}${fromPrepared ? '&from=prepared' : ''}`;
}

export function inCallHref(target: CallTargetParam): string {
  return `/emergency/in-call?target=${target}`;
}

export function callDoneHref(target: CallTargetParam): string {
  return `/emergency/call-done?target=${target}`;
}

/** `reason=failed`: no se pudo ni abrir la llamada (distinto de "no contestan"). */
export function noAnswerHref(failedToOpen = false): string {
  return failedToOpen ? `${EMERGENCY_HREF.noAnswer}?reason=failed` : EMERGENCY_HREF.noAnswer;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseTarget(value: string | string[] | undefined, fallback: string | null = null): CallTargetParam {
  const v = firstParam(value) ?? fallback ?? undefined;
  return v === 'official' ? 'official' : 'private';
}

export function parseMode(value: string | string[] | undefined): ActivationMode {
  const v = firstParam(value);
  return v === 'can_speak' || v === 'cannot_speak' ? v : 'unsure';
}

// ─── Textos ───────────────────────────────────────────────────────────────────

/** "Ana García" → "Ana" (botones cortos: "Llamar a Ana"). */
export function firstName(name: string | null | undefined): string {
  const clean = (name ?? '').trim();
  return clean.split(/\s+/)[0] || clean;
}

/** 75 → "01:15" · 3725 → "1:02:05" */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// ─── Síntomas rápidos (botones del asistente) ─────────────────────────────────

const SYMPTOM_COPY: Partial<Record<QuickSymptomId, { label: string; icon: IconName }>> = {
  wrong_med: { label: 'He tomado el medicamento equivocado', icon: 'medkit-outline' },
  overdose: { label: 'He tomado medicación de más', icon: 'add-circle-outline' },
  unwell: { label: 'Me encuentro mareado/a o muy mal', icon: 'sad-outline' },
  chest: { label: 'Tengo dolor en el pecho', icon: 'heart-outline' },
  breathing: { label: 'Me cuesta respirar', icon: 'pulse-outline' },
  cant_speak: { label: 'No puedo hablar bien', icon: 'mic-off-outline' },
  other: { label: 'Otra situación', icon: 'ellipsis-horizontal-circle-outline' },
};

const SYMPTOM_ORDER: QuickSymptomId[] = ['wrong_med', 'overdose', 'unwell', 'chest', 'breathing', 'cant_speak', 'other'];

function sentenceCase(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function orderOf(id: QuickSymptomId): number {
  const i = SYMPTOM_ORDER.indexOf(id);
  return i === -1 ? SYMPTOM_ORDER.length : i;
}

/** Botones rápidos a partir de QUICK_SYMPTOMS (textos en tipo oración, con icono). */
export const SYMPTOM_OPTIONS: { id: QuickSymptomId; label: string; icon: IconName }[] = [...QUICK_SYMPTOMS]
  .map((s) => ({
    id: s.id,
    label: SYMPTOM_COPY[s.id]?.label ?? sentenceCase(s.label),
    icon: SYMPTOM_COPY[s.id]?.icon ?? ('ellipse-outline' as IconName),
  }))
  .sort((a, b) => orderOf(a.id) - orderOf(b.id));

export function symptomLabel(id: string): string {
  return SYMPTOM_OPTIONS.find((s) => s.id === id)?.label ?? id;
}

// ─── Acciones del teléfono ────────────────────────────────────────────────────

/** Abre el teléfono con un número; si no se puede, explica cómo marcarlo a mano. */
export async function callNumberOrExplain(phone: string, display: string): Promise<void> {
  const ok = await callPhone(phone);
  if (!ok) await showAlert('No se ha podido abrir el teléfono', `Marca el ${display} desde tu teléfono.`);
}

export async function openMapsOrExplain(lat: number, lng: number): Promise<void> {
  const ok = await openMaps(lat, lng, 'Mi ubicación');
  if (!ok) await showAlert('No se ha podido abrir el mapa', 'Tu ubicación sigue preparada en esta pantalla.');
}

/** Espera máxima a la configuración remota antes de marcar el 112 igualmente. */
const OFFICIAL_NUMBER_WAIT_MS = 1500;

/**
 * Abre el marcador con el número oficial de emergencias.
 * Usa EmergencyService.callOfficialEmergency(); si la configuración remota tarda
 * (sin red o red lenta), marca directamente el 112 público: el 112 nunca espera al servidor.
 */
async function openOfficialDialer(): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const configReady = await Promise.race([
    EmergencyService.getOfficialEmergencyNumber().then(
      () => true,
      () => false,
    ),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), OFFICIAL_NUMBER_WAIT_MS);
    }),
  ]);
  if (timer) clearTimeout(timer);
  if (configReady) return EmergencyService.callOfficialEmergency().catch(() => false);
  return callPhone(PUBLIC_HEALTH_RESOURCES.emergency.phone);
}

export interface OfficialCallOptions {
  /** Cómo ir a la pantalla de llamada ('none' = quedarse en la pantalla actual). */
  navigate?: 'push' | 'replace' | 'none';
  /** Empieza una emergencia nueva (pantalla principal). */
  fresh?: boolean;
}

/**
 * Llamada al 112: abre el mecanismo oficial del teléfono. Puede iniciarse por pulsación
 * o por la escalada tras inactividad; iOS/Android pueden exigir confirmación antes de marcar.
 * Sin sesión (pantalla pública) solo abre el teléfono.
 */
export function useOfficialCall() {
  const router = useRouter();
  const { status } = useSession();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  // Precarga la configuración para que el botón responda al instante.
  useEffect(() => {
    void EmergencyService.getOfficialEmergencyNumber().catch(() => undefined);
  }, []);

  const callOfficial = useCallback(
    async (opts: OfficialCallOptions = {}): Promise<boolean> => {
      if (busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      try {
        EmergencyService.stopSpeaking();
        if (DEMO_ACCESS_ENABLED) {
          await showAlert(
            'Prueba interna del 112',
            'La escalada ha llegado correctamente al paso de llamada al 112. En esta compilación de pruebas no se realizará una llamada real.',
          );
          if (status === 'signedIn') {
            if (opts.fresh) EmergencySession.start('unsure');
            else EmergencySession.ensureStarted();
            EmergencySession.callStarted('official');
            const href = inCallHref('official');
            if (opts.navigate === 'replace') router.replace(href);
            else if (opts.navigate !== 'none') router.push(href);
          }
          return true;
        }
        const opened = await openOfficialDialer();
        if (!opened) {
          await showAlert('No se ha podido abrir el teléfono', 'Marca el 112 desde tu teléfono.');
          return false;
        }
        if (status === 'signedIn') {
          if (opts.fresh) EmergencySession.start('unsure');
          else EmergencySession.ensureStarted();
          EmergencySession.callStarted('official');
          const href = inCallHref('official');
          if (opts.navigate === 'replace') router.replace(href);
          else if (opts.navigate !== 'none') router.push(href);
        }
        return true;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [router, status],
  );

  return { callOfficial, callingOfficial: busy };
}

/** Margen en el que un segundo toque sobre un botón de navegación se ignora. */
const DOUBLE_TAP_MS = 900;

/**
 * Navegación a prueba de doble toque (frecuente en personas mayores): evita abrir
 * dos veces la misma pantalla, p. ej. dos cuentas atrás de llamada a la vez.
 */
export function useNavigateOnce() {
  const router = useRouter();
  const lastRef = useRef(0);
  return useCallback(
    (href: string, mode: 'push' | 'replace' = 'push') => {
      const now = Date.now();
      if (now - lastRef.current < DOUBLE_TAP_MS) return;
      lastRef.current = now;
      if (mode === 'replace') router.replace(href);
      else router.push(href);
    },
    [router],
  );
}

/**
 * Termina la emergencia (borra lo contado) y vuelve al Inicio sin dejar pantallas
 * de emergencia en la pila (si el Inicio no está en la pila, lo abre en su lugar).
 */
export function useFinishAndGoHome() {
  const router = useRouter();
  const navigation = useNavigation();
  return useCallback(() => {
    const routes = navigation.getState()?.routes ?? [];
    if (routes.some((r) => r.name === '(tabs)')) {
      router.dismissTo(EMERGENCY_HREF.home);
    } else {
      // Se entró directamente en emergencia (sin el Inicio debajo): se vacía la pila y se abre el Inicio.
      if (router.canDismiss()) router.dismissAll();
      router.replace(EMERGENCY_HREF.home);
    }
    void EmergencySession.finish();
  }, [router, navigation]);
}

// ─── Datos ────────────────────────────────────────────────────────────────────

/** Servicio privado de asistencia configurado (o null) y si la llamada es simulada (demo). */
export function usePrivateAssistance(enabled = true) {
  const service = useAsync(() => EmergencyService.getPrivateAssistanceNumber(), [], { enabled });
  const simulated = useAsync(() => EmergencyService.isPrivateCallSimulated(), [], { enabled });
  const refreshService = service.refresh;
  const refreshSimulated = simulated.refresh;
  // Al volver de "Configurar servicio de asistencia" se actualiza.
  useRefreshOnFocus(
    useCallback(() => {
      if (!enabled) return undefined;
      void refreshSimulated();
      return refreshService();
    }, [enabled, refreshService, refreshSimulated]),
  );
  return {
    service: enabled ? service.data ?? null : null,
    loading: enabled && service.status === 'loading',
    simulated: enabled && simulated.data === true,
    reload: service.reload,
  };
}

/** Perfil de emergencia (contacto, médico...). Nunca bloquea la pantalla: si falla, no se muestra. */
export function useEmergencyProfileData(enabled = true) {
  const state = useAsync(() => EmergencyService.getEmergencyProfile(), [], { enabled });
  const refresh = state.refresh;
  useRefreshOnFocus(useCallback(() => (enabled ? refresh() : undefined), [enabled, refresh]));
  return {
    profile: enabled ? state.data : null,
    loading: enabled && state.status === 'loading',
  };
}

/**
 * Prepara (o reutiliza) la información de la emergencia en curso.
 * - Funciona aunque la pantalla se abra directamente (inicia la emergencia).
 * - Solo trabaja con la pantalla visible (no repite la preparación desde el fondo de la pila).
 * - Si la emergencia ha terminado (Volver al inicio), no la vuelve a abrir.
 */
export function usePreparedEmergency(opts: { refreshIfOlderThanMs?: number } = {}) {
  const session = useEmergencySession();
  const focused = useIsFocused();
  const [error, setError] = useState<string | null>(null);
  /** Esta pantalla, visible, ha visto la emergencia activa (si termina ahora, no se reabre). */
  const sawActiveRef = useRef(false);
  const maxAge = opts.refreshIfOlderThanMs;

  const run = useCallback(async (force: boolean) => {
    setError(null);
    try {
      await EmergencySession.prepare(force);
    } catch (e) {
      setError(isAppError(e) ? e.message : 'No hemos podido preparar tu información. Inténtalo de nuevo.');
    }
  }, []);

  useEffect(() => {
    if (!focused) {
      sawActiveRef.current = false;
      return;
    }
    if (error !== null) return;
    const s = EmergencySession.getSnapshot();
    if (s.state !== 'IDLE') sawActiveRef.current = true;
    else if (sawActiveRef.current) return; // «Volver al inicio»: la emergencia terminó con esta pantalla delante.
    if (s.preparing) return;
    if (!s.prepared) {
      void run(false);
      return;
    }
    if (maxAge !== undefined && Date.now() - Date.parse(s.prepared.preparedAt) > maxAge) void run(true);
  }, [focused, session.prepared, session.preparing, session.state, error, run, maxAge]);

  const retry = useCallback(() => run(true), [run]);

  return {
    session,
    prepared: session.prepared,
    loading: !session.prepared && error === null,
    refreshing: session.preparing && session.prepared !== null,
    error,
    retry,
  };
}

// ─── Resumen de lo preparado (listas con check) ───────────────────────────────

export type CheckState = 'done' | 'pending' | 'todo';

export interface PreparedCheck {
  key: string;
  label: string;
  state: CheckState;
  detail?: string;
}

const CHECK_LABELS: { key: string; label: string }[] = [
  { key: 'identity', label: 'Tus datos personales' },
  { key: 'location', label: 'Tu ubicación' },
  { key: 'medical', label: 'Tus medicamentos y alergias' },
  { key: 'told', label: 'Lo que nos has contado' },
  { key: 'contact', label: 'Tu contacto de emergencia' },
];

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Estado de cada bloque según lo disponible y lo que la persona permite compartir. */
export function buildPreparedChecks(
  prepared: PreparedEmergency | null,
  loading: boolean,
  caregiverNotifiedAt: string | null,
): PreparedCheck[] {
  if (!prepared) {
    return CHECK_LABELS.map((c) => ({ ...c, state: loading ? 'pending' : 'todo' }));
  }
  const { report, profile } = prepared;
  const perms = profile.permissions;
  const [identityL, locationL, medicalL, toldL, contactL] = CHECK_LABELS;

  const name = profile.fullName.trim();
  const identity: PreparedCheck = name
    ? { ...identityL, state: 'done', detail: name }
    : { ...identityL, state: 'todo', detail: 'Falta tu nombre en el perfil' };

  let location: PreparedCheck;
  if (report.currentLocation) location = { ...locationL, state: 'done', detail: 'Ubicación del teléfono' };
  else if (report.registeredAddress) location = { ...locationL, state: 'done', detail: 'Dirección de tu perfil' };
  else if (!perms.shareLocation && !perms.shareAddress) location = { ...locationL, state: 'todo', detail: 'No compartida' };
  else location = { ...locationL, state: 'todo', detail: 'No disponible ahora' };

  const meds = report.medications.length;
  const allergies = report.declaredAllergies.map((a) => a.value);
  let medical: PreparedCheck;
  if (!perms.shareMedications && !perms.shareAllergies) medical = { ...medicalL, state: 'todo', detail: 'No compartido' };
  else if (meds + allergies.length > 0) {
    const parts: string[] = [];
    if (meds > 0) parts.push(plural(meds, 'medicamento', 'medicamentos'));
    if (allergies.length > 0) parts.push(`Alergias: ${allergies.join(', ')}`);
    medical = { ...medicalL, state: 'done', detail: parts.join(' · ') };
  } else medical = { ...medicalL, state: 'todo', detail: 'No hay datos en tu perfil' };

  const told = report.symptomsSelected.length;
  const conversation = report.recentStatements.filter((s) => s.provenance === 'RECENT_CONVERSATION').length;
  let toldCheck: PreparedCheck;
  if (told > 0) toldCheck = { ...toldL, state: 'done', detail: report.symptomsSelected.map(symptomLabel).join(' · ') };
  else if (conversation > 0) toldCheck = { ...toldL, state: 'done', detail: 'Tu conversación reciente con MediClaro' };
  else toldCheck = { ...toldL, state: 'todo', detail: 'No has indicado nada' };

  let contact: PreparedCheck;
  const caregiver = profile.caregiver;
  if (!caregiver) contact = { ...contactL, state: 'todo', detail: 'No tienes contacto de emergencia' };
  else if (!perms.notifyContact) contact = { ...contactL, state: 'todo', detail: `${caregiver.name} · aviso desactivado` };
  else if (!caregiver.phone.trim()) contact = { ...contactL, state: 'todo', detail: `${caregiver.name} · falta su teléfono` };
  else {
    contact = {
      ...contactL,
      state: 'done',
      detail: caregiverNotifiedAt ? `${caregiver.name} · aviso preparado a las ${formatTime(caregiverNotifiedAt)}` : caregiver.name,
    };
  }

  return [identity, location, medical, toldCheck, contact];
}

// ─── Componentes visuales locales ─────────────────────────────────────────────

/** Círculo de color con icono blanco (cabeceras de estado, opciones). */
export function IconCircle({
  icon,
  size = 56,
  iconSize,
  background,
  iconColor,
}: {
  icon: IconName;
  size?: number;
  iconSize?: number;
  background: string;
  iconColor?: string;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: background }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Icon name={icon} size={iconSize ?? Math.round(size * 0.5)} color={iconColor ?? theme.colors.onPrimary} />
    </View>
  );
}

/** Tarjeta blanca con título de sección ("Datos del usuario", "Ubicación actual"...). */
export function SectionCard({
  title,
  children,
  style,
  testID,
}: {
  title: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const theme = useAppTheme();
  return (
    <Card style={style} testID={testID}>
      <AppText variant="subheading" color="heading" accessibilityRole="header">
        {title}
      </AppText>
      <View style={{ gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>{children}</View>
    </Card>
  );
}

/** Fila con icono y texto (nombre, edad, teléfono, dirección...). */
export function LineRow({
  icon,
  iconColor,
  text,
  secondary,
  muted,
}: {
  icon: IconName;
  iconColor?: string;
  text: string;
  secondary?: string;
  muted?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.lineRow} accessible accessibilityLabel={secondary ? `${text}. ${secondary}` : text}>
      <View style={styles.lineIcon}>
        <Icon name={icon} size={22} color={iconColor ?? theme.colors.heading} />
      </View>
      <View style={styles.flex}>
        <AppText variant="body" color={muted ? 'textMuted' : 'text'}>
          {text}
        </AppText>
        {secondary ? (
          <AppText variant="caption" color="textSecondary">
            {secondary}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

/** Fila "etiqueta · valor" (información médica). `stacked` pone el valor debajo. */
export function ValueRow({
  icon,
  iconColor,
  label,
  value,
  muted,
  stacked,
  children,
}: {
  icon: IconName;
  iconColor?: string;
  label: string;
  value?: string;
  muted?: boolean;
  stacked?: boolean;
  children?: ReactNode;
}) {
  const theme = useAppTheme();
  const valueText = value ? (
    <AppText
      variant={stacked ? 'body' : 'label'}
      color={muted ? 'textMuted' : stacked ? 'text' : 'heading'}
      align={stacked ? 'left' : 'right'}
      style={stacked ? null : styles.valueRight}
    >
      {value}
    </AppText>
  ) : null;
  const a11y = value ? `${label}: ${value}` : label;
  return (
    <View style={styles.valueRow}>
      <View style={styles.lineIcon}>
        <Icon name={icon} size={22} color={iconColor ?? theme.colors.danger} />
      </View>
      <View style={styles.flex}>
        {stacked ? (
          <View accessible accessibilityLabel={a11y}>
            <AppText variant="body" color="text">
              {label}
            </AppText>
            {valueText}
          </View>
        ) : (
          <View style={styles.valueInline} accessible accessibilityLabel={a11y}>
            <AppText variant="body" color="text" style={styles.flex}>
              {label}
            </AppText>
            {valueText}
          </View>
        )}
        {children}
      </View>
    </View>
  );
}

/** Opción grande (tarjeta blanca con círculo de color, título y explicación). */
export function OptionCard({
  icon,
  color,
  title,
  subtitle,
  onPress,
  testID,
}: {
  icon: IconName;
  color: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  testID?: string;
}) {
  const theme = useAppTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={`${title}. ${subtitle}`} testID={testID} padding={theme.spacing.md}>
      <View style={styles.optionRow}>
        <IconCircle icon={icon} background={color} size={60} iconSize={30} />
        <View style={[styles.flex, { gap: 2 }]}>
          <AppText variant="heading" color="heading">
            {title}
          </AppText>
          <AppText variant="body" color="textSecondary">
            {subtitle}
          </AppText>
        </View>
        <Icon name="chevron-forward" size={24} color={theme.colors.textMuted} />
      </View>
    </Card>
  );
}

/** Fila de contacto pulsable (llamar a un número o ir a una pantalla). */
export function ContactRow({
  icon,
  title,
  subtitle,
  onPress,
  trailing = 'call',
  accessibilityLabel,
  testID,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  trailing?: 'call' | 'chevron';
  accessibilityLabel?: string;
  testID?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}. ${subtitle}` : title)}
      testID={testID}
      style={({ pressed }) => [
        styles.contactRow,
        { minHeight: theme.touchTargets.comfortable, borderRadius: theme.radius.md, backgroundColor: pressed ? c.surfaceAlt : 'transparent' },
      ]}
    >
      <View style={[styles.contactIcon, { backgroundColor: c.primaryTint, borderRadius: theme.radius.sm }]}>
        <Icon name={icon} size={22} color={c.primary} />
      </View>
      <View style={styles.flex}>
        <AppText variant="label" color="heading">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <Icon name={trailing === 'call' ? 'call' : 'chevron-forward'} size={22} color={trailing === 'call' ? c.primary : c.textMuted} />
    </Pressable>
  );
}

/** Aviso "Importante" (la decisión de enviar recursos es del servicio de emergencias). */
export function ImportantNotice({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  return (
    <Card tone="danger" style={[{ backgroundColor: theme.colors.dangerTint, gap: theme.spacing.sm }, style]} elevated={false}>
      <View style={styles.importantTitle} accessible accessibilityRole="header">
        <Icon name="shield-checkmark" size={30} color={theme.colors.danger} />
        <AppText variant="heading" color="dangerText">
          Importante
        </AppText>
      </View>
      <AppText variant="body" color="text">
        Esta función está diseñada para facilitar la comunicación con el 112.
      </AppText>
      <AppText variant="body" color="text">
        La decisión sobre el envío de una ambulancia u otro recurso la toma siempre el servicio de emergencias.
      </AppText>
      <AppText variant="body" color="text">
        MediClaro no sustituye la atención médica profesional.
      </AppText>
    </Card>
  );
}

/** Aviso discreto del modo demostración (nada es real salvo el 112 y los números públicos). */
export function DemoNotice({ message, style }: { message: string; style?: StyleProp<ViewStyle> }) {
  return <InfoBanner tone="neutral" icon="flask-outline" message={message} style={style} />;
}

/**
 * Botón AZUL del servicio privado con texto propio (p. ej. "Volver a llamar a …").
 * Mismo aspecto que AssistanceCallButton, que no admite otro texto.
 */
export function AssistanceActionButton({
  label,
  onPress,
  loading,
  testID,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  testID?: string;
}) {
  return (
    <PrimaryButton
      label={label}
      onPress={onPress}
      icon="headset"
      size="lg"
      loading={loading}
      accessibilityHint="Llama a tu servicio privado de asistencia. Es distinto del 112."
      testID={testID}
    />
  );
}

/** Botón redondo de la pantalla de llamada (icono + texto debajo). */
export function RoundAction({
  icon,
  label,
  onPress,
  tone = 'neutral',
  accessibilityLabel,
  disabled,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tone?: 'neutral' | 'primary' | 'danger';
  accessibilityLabel?: string;
  disabled?: boolean;
  testID?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const size = theme.touchTargets.easyMode;
  const bg = tone === 'primary' ? c.primary : tone === 'danger' ? c.danger : c.callSurface;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => [styles.roundAction, { opacity: disabled ? 0.5 : pressed ? 0.75 : 1 }]}
    >
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
        <Icon name={icon} size={30} color={c.callText} />
      </View>
      <AppText variant="label" color="callText" align="center">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  circle: { alignItems: 'center', justifyContent: 'center' },
  lineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  lineIcon: { width: 28, alignItems: 'center', paddingTop: 1 },
  valueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  valueInline: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  valueRight: { flexShrink: 1, maxWidth: '55%' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: 4 },
  contactIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  importantTitle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roundAction: { alignItems: 'center', gap: 8, minWidth: 96, paddingVertical: 4 },
});
