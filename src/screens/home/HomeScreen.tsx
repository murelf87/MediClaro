/**
 * 5 · Inicio (referencia: "Inicio" + acceso a emergencia).
 * "Hola 👋 ¿Qué quieres hacer hoy?" y las acciones principales, sin tarjetas gigantes, en este orden:
 * identificar (principal) · mis pastillas · mis medicamentos · preguntar · historial · mi cuidador/a · emergencia,
 * y abajo la tarjeta grande del chat con el cuidador/a (siempre está: encendida, apagada o con candado).
 * La misma letra y la misma forma en todos los perfiles (Premium, Básico y cuidador/a): las filas no cambian de
 * tamaño por los candados (un candado pequeño sustituye a la flecha) y ninguna palabra se parte en móviles estrechos.
 * Con perfil de cuidador/a, un aviso arriba lleva a los avisos y al chat.
 * Emergencia visible, pero sin romper la jerarquía (y nunca bloqueada).
 * Sin Premium (cuando se puede contratar): tarjeta con la guía «Activa MediClaro Premium» y candado en
 * las funciones reales; al tocarlas se explica la función y se ofrecen los planes. Las identificaciones que quedan
 * solo se dicen cuando de verdad se puede identificar sin Premium.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, MediClaroLogo, AppText, ActionRow, Avatar, FitGroup, FitText, Icon, InfoBanner } from '../../components';
import { FadeIn, stagger } from '../../components/Motion';
import { AppNoticeBanner } from '../../components/AppNoticeBanner';
import { CareChatHomeCard, type CareChatCardState } from '../../components/CareChatWindow';
import { useCareChatSummary } from '../../hooks/useCareChat';
import { chatOpen } from '../../services/CareChatService';
import { chatTime } from '../../utils/chatTimeline';
import { GuideIllustration } from '../../components/Guide';
import { useAsync } from '../../hooks/useAsync';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import { useEntitlement } from '../../providers/EntitlementProvider';
import { useCareSnapshot } from '../../hooks/useCareSnapshot';
import { usePreferences, useAppTheme } from '../../providers/PreferencesProvider';
import { ProfileService } from '../../services';
import { AuthService } from '../../services/AuthService';
import { showAlert } from '../../utils/dialogs';
import { formatDateLong } from '../../utils/format';
import { useNow, usePillState } from '../../hooks/usePillPlan';
import { doseViews, nextDose, occurrencesForDate } from '../../domain/medication';
import { ZONE, todayDate } from '../pills/parts';

/** Tarjeta de Premium con la guía (solo sin Premium, cuando se puede contratar). */
function PremiumCard({ onPress }: { onPress: () => void }) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Activa MediClaro Premium. Identifica medicamentos, pregunta al asistente y escucha el prospecto. Ver planes"
      testID="home-premium-card"
      style={({ pressed }) => [
        styles.premiumCard,
        { backgroundColor: c.surface, borderColor: c.primarySoft, borderRadius: theme.radius.xl, opacity: pressed ? 0.9 : 1 },
        theme.shadow.card,
      ]}
    >
      <View style={[styles.flex, { gap: 6 }]}>
        <View style={[styles.pill, { backgroundColor: c.premiumSoft }]}>
          <AppText variant="small" style={{ color: c.premiumText, letterSpacing: 1 }}>
            PREMIUM
          </AppText>
        </View>
        <AppText variant="subheading" color="heading">
          Activa MediClaro Premium
        </AppText>
        <AppText variant="caption" color="textSecondary">
          Identifica medicamentos, pregunta al asistente y escucha el prospecto.
        </AppText>
        <View style={styles.seePlans}>
          <AppText variant="captionStrong" color="link">
            Ver planes
          </AppText>
          <Icon name="arrow-forward" size={16} color={c.link} />
        </View>
      </View>
      <GuideIllustration size={112} halo={false} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { prefs } = usePreferences();
  const easy = prefs.easyMode;

  const profile = useAsync(() => ProfileService.getProfile(), []);
  const entitlement = useEntitlement();
  const { caregiver, patients } = useCareSnapshot();
  // Bizum no se renueva solo: 7 días antes de que termine, se recuerda aquí.
  const bizumEnd = entitlement.subscription?.oneTimePayment ? entitlement.subscription.renewsAt : null;
  const bizumEndsSoon = !!bizumEnd && Date.parse(bizumEnd) - Date.now() < 7 * 86_400_000;
  useRefreshOnFocus(profile.refresh);
  useRefreshOnFocus(entitlement.refresh);

  const firstName = profile.data?.displayName?.split(' ')[0] ?? null;
  const usage = entitlement.subscription?.usage ?? null;
  const isPremium = entitlement.isPremium;
  // Funciones reales con candado: solo si hacen falta Premium y se sabe que no lo tiene.
  const locked = entitlement.required && entitlement.status === 'ready' && !isPremium;
  // «Mis pastillas»: la próxima toma de hoy, con lo guardado en el teléfono (sin esperar a internet).
  const pills = usePillState();
  const pillsNow = useNow(60_000);
  const nextPill = pills
    ? nextDose(doseViews(occurrencesForDate(pills.treatments.filter((t) => t.active), todayDate(pillsNow), ZONE), pills.events, pillsNow))
    : null;
  const pillsSublabel = nextPill
    ? `${nextPill.status === 'pending' ? 'Ahora' : 'Próxima'}: ${nextPill.occurrence.time} · ${nextPill.occurrence.treatment.name.split(' ')[0]}`
    : 'Avisos de cada toma';
  const leftText = usage
    ? isPremium
      ? usage.scansLeft === 1
        ? 'Te queda 1 identificación incluida este mes'
        : `Te quedan ${usage.scansLeft} identificaciones incluidas este mes`
      : usage.scansLeft === 1
        ? 'Te queda 1 identificación este mes'
        : `Te quedan ${usage.scansLeft} identificaciones este mes`
    : '';
  // «Ver Premium» solo si se puede contratar dentro de la app (y no lo tiene ya).
  const showUpgrade = entitlement.canSell && !isPremium && !locked;
  // Las identificaciones que quedan solo tienen sentido si se puede identificar sin Premium (nunca con candado).
  const showUsage = !!usage && !usage.unlimited && !easy && !locked;

  // Chat con el cuidador/a: la tarjeta grande de abajo, en el estado que toque.
  const chats = useCareChatSummary();
  const chatNow = pillsNow.getTime();
  const conv = chats.conversations[0] ?? null;
  const chatState: CareChatCardState = caregiver
    ? conv && chatOpen(conv, chatNow)
      ? 'on'
      : 'off'
    : locked
      ? 'locked'
      : conv
        ? 'ready'
        : 'unlinked';
  const chatOther = conv ? conv.otherName.trim().split(/\s+/)[0] || conv.otherName : caregiver ? patients[0]?.split(' ')[0] ?? 'tu familiar' : 'tu cuidador/a';
  const openChat = () => {
    if (chatState === 'locked') {
      router.push('/premium');
      return;
    }
    if (conv && chats.conversations.length === 1 && chatState !== 'off') {
      router.push({ pathname: '/caregiver-chat', params: { link: conv.linkId } });
      return;
    }
    router.push('/caregiver');
  };
  const openHistory = async () => {
    try {
      await AuthService.ensureAccount();
      router.push('/history');
    } catch {
      await showAlert('Historial de búsquedas', 'No se ha podido abrir el historial. Comprueba la conexión y vuelve a intentarlo.');
    }
  };

  return (
    <Screen edges={['top']}>
      <View style={[styles.header, { marginTop: theme.spacing.xs }]}>
        <MediClaroLogo variant="horizontal" size="sm" />
        <Pressable
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityRole="button"
          accessibilityLabel="Abrir perfil y ajustes"
          hitSlop={6}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
        >
          <Avatar name={profile.data?.displayName} uri={profile.data?.avatarUrl} size={48} tone="neutral" />
        </Pressable>
      </View>

      {/* Aviso general del propietario (p. ej. un mantenimiento): solo si hay uno activo. */}
      <AppNoticeBanner style={{ marginTop: theme.spacing.sm }} />

      <View style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.lg }}>
        {/* Se adapta al ancho del móvil: cada frase en una línea, sin palabras sueltas abajo. */}
        <FitText variant="display" accessibilityRole="header" testID="home-hello">
          {firstName ? `Hola, ${firstName} 👋` : 'Hola 👋'}
        </FitText>
        <FitText variant="display" testID="home-question">
          ¿Qué quieres hacer hoy?
        </FitText>
        {showUsage ? (
          showUpgrade ? (
            <Pressable
              onPress={() => router.push('/premium')}
              accessibilityRole="button"
              accessibilityLabel={`${leftText}. Ver Premium`}
              style={({ pressed }) => [styles.usage, { opacity: pressed ? 0.7 : 1, minHeight: theme.touchTargets.min }]}
            >
              <AppText variant="caption" color="textSecondary">
                {`${leftText} · `}
                <AppText variant="captionStrong" color="link">
                  Ver Premium
                </AppText>
              </AppText>
            </Pressable>
          ) : (
            <View style={[styles.usage, { minHeight: theme.touchTargets.min }]} testID="home-usage">
              <AppText variant="caption" color="textSecondary">
                {leftText}
              </AppText>
            </View>
          )
        ) : null}
      </View>

      {bizumEndsSoon && bizumEnd ? (
        <InfoBanner
          tone="warning"
          icon="phone-portrait-outline"
          title="Tu Premium termina pronto"
          message={`Lo pagaste con Bizum y termina el ${formatDateLong(bizumEnd)}. Si quieres seguir, paga otro periodo.`}
          action={{ label: 'Renovar con Bizum', onPress: () => router.push({ pathname: '/payment-card', params: { plan: 'premium_monthly', method: 'bizum' } }) }}
          style={{ marginBottom: theme.spacing.lg }}
          testID="home-bizum-renew"
        />
      ) : null}

      {caregiver ? (
        <InfoBanner
          tone="success"
          icon="people-outline"
          title="Perfil de cuidador/a"
          message={patients.length ? `Recibes los avisos de ${patients.join(', ')}.` : 'Aquí recibirás los avisos de la persona vinculada.'}
          action={{ label: 'Ver avisos y chat', onPress: () => router.push('/caregiver') }}
          style={{ marginBottom: theme.spacing.lg }}
        />
      ) : null}

      {locked ? (
        <FadeIn style={{ marginBottom: theme.spacing.lg }}>
          <PremiumCard onPress={() => router.push('/premium')} />
        </FadeIn>
      ) : null}

      <View style={{ gap: theme.layout.stackGap }}>
        <FadeIn delay={stagger(0, 60)}>
          <ActionRow
            hero
            icon="camera"
            label="Identificar un medicamento"
            tone="primary"
            locked={locked}
            onPress={() => router.push('/scan')}
            testID="home-identify"
          />
        </FadeIn>
        <FitGroup minScale={0.75}>
          <FadeIn delay={stagger(1, 60)}>
            <ActionRow
              icon="alarm"
              label="Mis pastillas"
              sublabel={pillsSublabel}
              tone="primary"
              locked={locked}
              onPress={() => router.push('/pills')}
              testID="home-pills"
            />
          </FadeIn>
          <FadeIn delay={stagger(1, 60)}>
            <ActionRow icon="medkit" label="Mis medicamentos" tone="success" onPress={() => router.push('/(tabs)/medicines')} testID="home-medicines" />
          </FadeIn>
          <FadeIn delay={stagger(2, 60)}>
            <ActionRow
              icon="chatbubble-ellipses"
              label="Preguntar a la IA"
              tone="ai"
              locked={locked}
              onPress={() => router.push('/(tabs)/chat')}
              testID="home-assistant"
            />
          </FadeIn>
          {!easy ? (
            <FadeIn delay={stagger(3, 60)}>
              <ActionRow icon="time" label="Historial de búsquedas" tone="info" onPress={() => void openHistory()} testID="home-history" />
            </FadeIn>
          ) : null}
          {isPremium && !caregiver ? (
            <FadeIn delay={stagger(4, 60)}>
              <ActionRow icon="people" label="Mi cuidador/a" tone="info" onPress={() => router.push('/caregiver')} testID="home-caregiver" />
            </FadeIn>
          ) : null}
          <FadeIn delay={stagger(5, 60)}>
            <ActionRow
              icon="call"
              label="Emergencia"
              sublabel="Ayuda inmediata · 112"
              tone="danger"
              onPress={() => router.push('/emergency')}
              testID="home-emergency"
            />
          </FadeIn>
        </FitGroup>
      </View>

      <FadeIn delay={stagger(6, 60)} style={{ marginTop: theme.layout.stackGap }}>
        <CareChatHomeCard
          state={chatState}
          otherFirst={chatOther}
          unread={conv?.unread ?? 0}
          until={conv?.openUntil ? chatTime(conv.openUntil) : ''}
          onPress={openChat}
        />
      </FadeIn>

      <AppText variant="small" color="textMuted" align="center" style={[styles.disclaimer, { marginTop: theme.spacing.lg }]} testID="home-disclaimer">
        Información oficial de la AEMPS. No sustituye la opinión de tu médico o farmacéutico.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Aviso legal discreto: letra pequeña y sin negrita (sigue siendo legible y lo lee el lector de pantalla).
  disclaimer: { fontWeight: '400' },
  flex: { flex: 1 },
  premiumCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingRight: 8, borderWidth: 1, overflow: 'hidden' },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  seePlans: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  usage: { justifyContent: 'center', alignSelf: 'flex-start', marginTop: 6 },
});
