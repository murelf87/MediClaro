/**
 * 5 · Inicio (referencia: "Inicio" + acceso a emergencia).
 * "Hola 👋 ¿Qué quieres hacer hoy?" y las acciones principales, sin tarjetas gigantes.
 * Emergencia visible, pero sin romper la jerarquía (y nunca bloqueada).
 * Sin Premium (cuando se puede contratar): tarjeta con la guía «Activa MediClaro Premium» y candado en
 * las funciones reales; al tocarlas se explica la función y se ofrecen los planes.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, MediClaroLogo, AppText, ActionRow, Avatar, Icon } from '../../components';
import { FadeIn, stagger } from '../../components/Motion';
import { GuideIllustration } from '../../components/Guide';
import { useAsync } from '../../hooks/useAsync';
import { useRefreshOnFocus } from '../../hooks/useRefreshOnFocus';
import { useEntitlement } from '../../providers/EntitlementProvider';
import { usePreferences, useAppTheme } from '../../providers/PreferencesProvider';
import { ProfileService } from '../../services';

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

  const settings = useAsync(() => ProfileService.getSettings(), []);
  const entitlement = useEntitlement();
  useRefreshOnFocus(settings.refresh);
  useRefreshOnFocus(entitlement.refresh);

  const firstName = settings.data?.displayName?.split(' ')[0] ?? null;
  const usage = entitlement.subscription?.usage ?? null;
  const isPremium = entitlement.isPremium;
  // Funciones reales con candado: solo si hacen falta Premium y se sabe que no lo tiene.
  const locked = entitlement.required && entitlement.status === 'ready' && !isPremium;
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
          <Avatar name={settings.data?.displayName} size={48} tone="neutral" />
        </Pressable>
      </View>

      <View style={{ marginTop: theme.spacing.xl, marginBottom: theme.spacing.lg }}>
        <AppText variant="display" accessibilityRole="header">
          {firstName ? `Hola, ${firstName} 👋` : 'Hola 👋'}
        </AppText>
        <AppText variant="display">¿Qué quieres hacer hoy?</AppText>
        {usage && !easy ? (
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
            <ActionRow icon="time" label="Historial de búsquedas" tone="info" onPress={() => router.push('/history')} testID="home-history" />
          </FadeIn>
        ) : null}
        <FadeIn delay={stagger(4, 60)}>
          <ActionRow
            icon="call"
            label="Emergencia"
            sublabel="Ayuda inmediata · 112"
            tone="danger"
            onPress={() => router.push('/emergency')}
            testID="home-emergency"
          />
        </FadeIn>
      </View>

      <AppText variant="caption" color="textMuted" align="center" style={{ marginTop: theme.spacing.xl }}>
        Información oficial de la AEMPS. No sustituye la opinión de tu médico o farmacéutico.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  premiumCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, paddingRight: 8, borderWidth: 1, overflow: 'hidden' },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  seePlans: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  usage: { justifyContent: 'center', alignSelf: 'flex-start', marginTop: 6 },
});
