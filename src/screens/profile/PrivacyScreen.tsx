/**
 * /privacy — Privacidad y datos: qué guardamos, qué no, permisos del teléfono y
 * acciones RGPD (descargar mis datos, eliminar la cuenta).
 * Los textos describen lo que hace de verdad el backend actual (sin fotos ni conversaciones en servidor).
 */
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  Card,
  Icon,
  ListGroup,
  Screen,
  SecondaryButton,
  SettingRow,
  TextButton,
  type IconName,
} from '../../components';
import { useAppTheme } from '../../hooks';
import { AiConsentService, AssistantService, useAiConsentStatus } from '../../services';
import { confirmAsync, showAlert } from '../../utils/dialogs';
import { formatDateLong } from '../../utils/format';
import { PURCHASES_ENABLED } from '../../config/app';
import { ASSISTANT_NAME } from '../../config/assistant';
import { openAppSettings } from '../../utils/device';
import { useAccountActions } from './accountActions';
import { BulletItem } from './parts';

const WE_STORE = [
  'Tu número de teléfono, para que puedas entrar',
  'Los medicamentos que guardas',
  'El historial de tus identificaciones',
  'Tus ajustes de accesibilidad',
  'Tu perfil de emergencia, si lo creas',
  `Tus conversaciones con ${ASSISTANT_NAME}, para que las sigas en cualquier móvil (puedes borrarlas aquí abajo)`,
  `Lo que ${ASSISTANT_NAME} recuerda de ti, solo si activas su memoria: gustos y rutinas, nunca datos médicos`,
];

const WE_DO_NOT_STORE = [
  'Las fotos de las cajas: solo se usan para identificar el medicamento',
  'Tus mensajes de voz: solo se usan para pasarlos a texto',
  ...(PURCHASES_ENABLED ? ['Los datos de tu tarjeta o de Bizum: el pago se hace en la página segura del proveedor'] : []),
];

const PERMISSIONS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'camera-outline', title: 'Cámara', text: 'Para hacer la foto de la caja del medicamento. Solo cuando tú la abres.' },
  { icon: 'images-outline', title: 'Fotos', text: 'Solo si eliges una foto de la caja que ya tienes en el teléfono.' },
  { icon: 'location-outline', title: 'Ubicación', text: 'Solo durante una emergencia, para ayudar a que te encuentren.' },
];

function SectionCard({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  const theme = useAppTheme();
  return (
    <Card>
      <View style={[styles.cardHead, { marginBottom: theme.spacing.sm }]}>
        <Icon name={icon} size={24} color={theme.colors.primary} />
        <AppText variant="subheading" color="heading" accessibilityRole="header" style={styles.flex}>
          {title}
        </AppText>
      </View>
      {children}
    </Card>
  );
}

/**
 * Permiso para la inteligencia artificial (Gemini): estado, fecha y dar / retirar.
 * Sin permiso no se envían fotos ni preguntas; el código nacional (C.N.) sigue funcionando.
 */
function AiPermissionCard() {
  const theme = useAppTheme();
  const c = theme.colors;
  const router = useRouter();
  const status = useAiConsentStatus();
  const [date, setDate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    let alive = true;
    void Promise.all([AiConsentService.getStatus(), AiConsentService.getDecisionDate()]).then(([, d]) => {
      if (alive) setDate(d);
    });
    return () => {
      alive = false;
    };
  }, []);
  useFocusEffect(refresh);

  const give = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await AiConsentService.ensure();
      setDate(await AiConsentService.getDecisionDate());
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    if (busy) return;
    const ok = await confirmAsync({
      title: '¿Retirar el permiso?',
      message:
        'Dejaremos de enviar fotos y preguntas a la inteligencia artificial. Podrás seguir identificando medicamentos con el código nacional (C.N.) de la caja.',
      confirmText: 'Retirar el permiso',
      cancelText: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await AiConsentService.revoke();
      setDate(await AiConsentService.getDecisionDate());
    } finally {
      setBusy(false);
    }
  };

  const when = date ? formatDateLong(date) : '';
  const statusText =
    status === 'granted'
      ? `Has dado permiso${when ? ` el ${when}` : ''}.`
      : status === 'denied'
        ? `Has retirado el permiso${when ? ` el ${when}` : ''}.`
        : 'Todavía no has dado permiso. Te lo pediremos la primera vez que hagas una foto o una pregunta.';

  return (
    <Card>
      <View style={[styles.cardHead, { marginBottom: theme.spacing.sm }]}>
        <Icon name="sparkles" size={24} color={c.ai} />
        <AppText variant="subheading" color="heading" accessibilityRole="header" style={styles.flex}>
          Inteligencia artificial
        </AppText>
      </View>
      <AppText variant="body" color="text">
        Para leer las fotos de las cajas y responder a tus preguntas usamos Gemini, la inteligencia artificial de Google.
        Solo enviamos la foto o la pregunta, nunca tu nombre ni tu teléfono.
      </AppText>
      <View
        style={[styles.aiStatus, { backgroundColor: status === 'granted' ? c.aiSoft : c.surfaceAlt, borderRadius: theme.radius.md, marginTop: theme.spacing.sm }]}
        accessible
        accessibilityLabel={`Estado del permiso: ${statusText}`}
        testID="privacy-ai-status"
      >
        <Icon name={status === 'granted' ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={status === 'granted' ? c.aiText : c.textMuted} />
        <AppText variant="caption" color="text" style={styles.flex}>
          {statusText}
        </AppText>
      </View>
      {status === 'granted' ? (
        <SecondaryButton
          label="Retirar el permiso"
          icon="close-circle-outline"
          variant="dangerTonal"
          loading={busy}
          onPress={() => void withdraw()}
          style={{ marginTop: theme.spacing.md }}
          testID="privacy-ai-revoke"
        />
      ) : (
        <SecondaryButton
          label="Dar el permiso"
          icon="checkmark-circle-outline"
          loading={busy}
          onPress={() => void give()}
          style={{ marginTop: theme.spacing.md }}
          testID="privacy-ai-grant"
        />
      )}
      <TextButton
        label="Más información"
        onPress={() => router.push({ pathname: '/legal', params: { section: 'ai' } })}
        style={{ marginTop: theme.spacing.xs, alignSelf: 'flex-start' }}
      />
    </Card>
  );
}

export default function PrivacyScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  const { exporting, deleting, downloadMyData, deleteMyAccount } = useAccountActions();
  const [clearingChats, setClearingChats] = useState(false);

  /** Borra las conversaciones con el asistente guardadas en la cuenta (derecho de supresión). */
  const clearChats = async () => {
    if (clearingChats) return;
    const ok = await confirmAsync({
      title: 'Borrar tus conversaciones',
      message: `Se borrarán todas tus conversaciones con ${ASSISTANT_NAME} de tu cuenta, en todos tus móviles. No se puede deshacer.`,
      confirmText: 'Borrar conversaciones',
      cancelText: 'Cancelar',
      destructive: true,
    });
    if (!ok) return;
    setClearingChats(true);
    try {
      await AssistantService.deletePersistentHistory();
      await showAlert('Conversaciones borradas', `Ya no hay ninguna conversación con ${ASSISTANT_NAME} guardada en tu cuenta.`);
    } catch (e) {
      await showAlert('No se han podido borrar', (e as Error).message || 'Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setClearingChats(false);
    }
  };

  const openSettings = async () => {
    const ok = await openAppSettings();
    if (!ok) {
      await showAlert('No hemos podido abrir los ajustes', 'Abre los Ajustes de tu teléfono y busca MediClaro para revisar sus permisos.');
    }
  };

  return (
    <Screen header={<AppHeader title="Privacidad y datos" />}>
      <View style={[styles.hero, { gap: theme.spacing.xs }]}>
        <View style={[styles.heroIcon, { backgroundColor: c.successSoft }]}>
          <Icon name="shield-checkmark" size={46} color={c.successStrong} />
        </View>
        <AppText variant="title" align="center" accessibilityRole="header">
          Tus datos son tuyos
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          Te contamos qué guardamos y para qué. Puedes descargar o borrar tus datos cuando quieras.
        </AppText>
      </View>

      <View style={{ gap: theme.spacing.md, marginTop: theme.spacing.lg }}>
        <SectionCard icon="folder-open-outline" title="Qué guardamos">
          <View style={{ gap: theme.spacing.xxs }}>
            {WE_STORE.map((t) => (
              <BulletItem key={t} icon="checkmark" tone="primary" text={t} />
            ))}
          </View>
        </SectionCard>

        <SectionCard icon="eye-off-outline" title="Qué no guardamos">
          <View style={{ gap: theme.spacing.xxs }}>
            {WE_DO_NOT_STORE.map((t) => (
              <BulletItem key={t} icon="close" tone="neutral" text={t} />
            ))}
          </View>
          <AppText variant="caption" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
            Por tu seguridad, tus últimas preguntas al asistente se guardan unos minutos en este teléfono para poder
            compartirlas en una emergencia, solo si tú lo permites.
          </AppText>
        </SectionCard>

        <AiPermissionCard />

        <SectionCard icon="phone-portrait-outline" title="Permisos del teléfono">
          <View style={{ gap: theme.spacing.sm }}>
            {PERMISSIONS.map((p) => (
              <View key={p.title} style={styles.permission} accessible accessibilityLabel={`${p.title}. ${p.text}`}>
                <View style={[styles.permissionIcon, { backgroundColor: c.primaryTint }]}>
                  <Icon name={p.icon} size={22} color={c.primary} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" color="heading">
                    {p.title}
                  </AppText>
                  <AppText variant="caption" color="textSecondary">
                    {p.text}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
          <SecondaryButton
            label="Abrir ajustes del teléfono"
            icon="settings-outline"
            onPress={() => void openSettings()}
            style={{ marginTop: theme.spacing.md }}
            testID="privacy-open-settings"
          />
        </SectionCard>

        <ListGroup title="Tus datos">
          <SettingRow
            icon="download-outline"
            label="Descargar mis datos"
            onPress={() => void downloadMyData()}
            right={exporting ? <ActivityIndicator color={c.primary} /> : undefined}
            showChevron={!exporting}
            testID="privacy-export"
          />
          <SettingRow
            icon="chatbubbles-outline"
            label={`Borrar mis conversaciones con ${ASSISTANT_NAME}`}
            onPress={() => void clearChats()}
            right={clearingChats ? <ActivityIndicator color={c.primary} /> : undefined}
            showChevron={false}
            testID="privacy-clear-chats"
          />
          <SettingRow
            icon="shield-checkmark-outline"
            label="Qué compartir en una emergencia"
            onPress={() => router.push('/emergency-sharing')}
          />
          <SettingRow
            icon="document-text-outline"
            label="Política de privacidad"
            onPress={() => router.push({ pathname: '/legal', params: { section: 'privacy' } })}
          />
          <SettingRow
            icon="trash-outline"
            label="Eliminar mi cuenta"
            destructive
            onPress={() => void deleteMyAccount()}
            right={deleting ? <ActivityIndicator color={c.danger} /> : undefined}
            showChevron={false}
            testID="privacy-delete"
          />
        </ListGroup>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', marginTop: 8 },
  heroIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  permission: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  permissionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  aiStatus: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
});
