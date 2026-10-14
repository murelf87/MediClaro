/**
 * Confianza al pagar (pantalla «¿Cómo quieres pagar?»).
 *
 * Solo dice cosas CIERTAS y comprobables:
 *  - el pago lo procesa Stripe (proveedor certificado PCI DSS de nivel 1) en una conexión cifrada;
 *  - MediClaro no ve ni guarda la tarjeta, el IBAN ni la contraseña de PayPal;
 *  - sin permanencia (se cancela cuando se quiera) y derecho de desistimiento de 14 días (Condiciones);
 *  - un sello externo (p. ej. «Confianza Online») SOLO si el titular está adherido y lo configura con su página de
 *    verificación (EXPO_PUBLIC_TRUST_SEAL_NAME / _URL). Nunca se dibuja el logotipo de un tercero.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppText, Icon, type IconName } from '../../components';
import { useAppTheme } from '../../hooks';
import { SUPPORT_EMAIL, SUPPORT_PHONE, TRUST_SEAL } from '../../config/app';
import { callPhone, openExternalUrl } from '../../utils/device';
import { formatPhoneForDisplay } from '../../utils/format';

interface Seal {
  icon: IconName;
  title: string;
  text: string;
}

const SEALS: Seal[] = [
  { icon: 'lock-closed', title: 'Pago cifrado', text: 'Conexión segura de principio a fin' },
  { icon: 'shield-checkmark', title: 'Stripe, nivel 1 PCI', text: 'La máxima certificación de seguridad en pagos' },
  { icon: 'eye-off', title: 'No vemos tus datos', text: 'Ni tu tarjeta, ni tu IBAN, ni tu PayPal' },
  { icon: 'refresh-circle', title: 'Sin permanencia', text: 'Cancela cuando quieras, sin llamar a nadie' },
];

export function TrustPanel({ provider }: { provider: string }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const router = useRouter();
  const seal = TRUST_SEAL.name && /^https:\/\//.test(TRUST_SEAL.url) ? TRUST_SEAL : null;
  return (
    <View
      style={[styles.panel, { borderColor: c.border, backgroundColor: c.surface, borderRadius: theme.radius.lg, padding: theme.spacing.md, gap: theme.spacing.sm }]}
      testID="payment-trust"
    >
      <View style={styles.titleRow} accessibilityRole="header">
        <View style={[styles.shield, { backgroundColor: c.successSoft }]}>
          <Icon name="shield-checkmark" size={22} color={c.successStrong} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" color="heading">
            Pago 100 % seguro
          </AppText>
          <AppText variant="caption" color="textSecondary">
            {`Lo procesa ${provider}, el mismo sistema que usan millones de tiendas.`}
          </AppText>
        </View>
      </View>
      <View style={styles.grid}>
        {SEALS.map((s) => (
          <View
            key={s.title}
            style={[styles.seal, { borderColor: c.border, backgroundColor: c.surfaceAlt, borderRadius: theme.radius.md }]}
            accessible
            accessibilityLabel={`${s.title}. ${s.text}`}
          >
            <Icon name={s.icon} size={22} color={c.primary} />
            <AppText variant="captionStrong" color="heading">
              {s.title}
            </AppText>
            <AppText variant="small" color="textSecondary" style={styles.sealText}>
              {s.text}
            </AppText>
          </View>
        ))}
      </View>
      <Pressable
        onPress={() => router.push({ pathname: '/legal', params: { section: 'subscription' } })}
        accessibilityRole="link"
        accessibilityLabel="14 días para desistir. Ver las condiciones de la suscripción"
        style={styles.inline}
        testID="payment-trust-withdrawal"
      >
        <Icon name="calendar" size={18} color={c.textSecondary} />
        <AppText variant="caption" color="textSecondary" style={styles.flex}>
          Tienes 14 días para desistir de la contratación (te lo explicamos en las condiciones).
        </AppText>
        <Icon name="chevron-forward" size={18} color={c.textMuted} />
      </Pressable>
      {seal ? (
        <Pressable
          onPress={() => void openExternalUrl(seal.url)}
          accessibilityRole="link"
          accessibilityLabel={`Adherido a ${seal.name}. Ver el certificado`}
          style={[styles.inline, styles.sealLink, { borderColor: c.border, borderRadius: theme.radius.md }]}
          testID="payment-trust-seal"
        >
          <Icon name="ribbon" size={20} color={c.primary} />
          <AppText variant="captionStrong" color="heading" style={styles.flex}>
            {`Adherido a ${seal.name}`}
          </AppText>
          <AppText variant="caption" color="primary">
            Ver certificado
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

/** «¿Te ayudamos a pagar?»: el familiar como alternativa y el contacto de ayuda (solo si está configurado). */
export function PaymentHelp({ onFamily }: { onFamily?: () => void }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const email = SUPPORT_EMAIL.trim();
  return (
    <View style={[styles.help, { backgroundColor: c.primaryTint, borderRadius: theme.radius.lg, padding: theme.spacing.md, gap: theme.spacing.xs }]} testID="payment-help">
      <View style={styles.titleRow}>
        <Icon name="help-buoy" size={22} color={c.primary} />
        <AppText variant="bodyStrong" color="heading" style={styles.flex}>
          ¿Te ayudamos a pagar?
        </AppText>
      </View>
      <AppText variant="caption" color="textSecondary">
        {onFamily
          ? 'Si prefieres no pagar tú desde el móvil, elige «Que pague mi familiar o cuidador/a»: le enviamos un enlace seguro y tú no tienes que hacer nada más.'
          : 'Elige la forma que te resulte más cómoda. Todas son seguras y puedes cancelar cuando quieras.'}
      </AppText>
      {onFamily ? (
        <Pressable onPress={onFamily} accessibilityRole="button" style={styles.inline} testID="payment-help-family">
          <Icon name="people" size={18} color={c.primary} />
          <AppText variant="captionStrong" color="primary">
            Que pague mi familiar
          </AppText>
        </Pressable>
      ) : null}
      {SUPPORT_PHONE ? (
        <Pressable onPress={() => void callPhone(SUPPORT_PHONE)} accessibilityRole="button" style={styles.inline} testID="payment-help-phone">
          <Icon name="call" size={18} color={c.primary} />
          <AppText variant="captionStrong" color="primary">
            {`Llámanos: ${formatPhoneForDisplay(SUPPORT_PHONE)}`}
          </AppText>
        </Pressable>
      ) : null}
      {email ? (
        <Pressable onPress={() => void openExternalUrl(`mailto:${email}`)} accessibilityRole="button" style={styles.inline} testID="payment-help-email">
          <Icon name="mail" size={18} color={c.primary} />
          <AppText variant="captionStrong" color="primary">
            {`Escríbenos: ${email}`}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  panel: { borderWidth: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shield: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  seal: { flexGrow: 1, flexBasis: '46%', minWidth: 130, borderWidth: 1, padding: 10, gap: 3 },
  sealText: { fontWeight: '400' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36 },
  sealLink: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  help: {},
});
