/**
 * /emergency/notify · Aviso a familiar (referencia e09_family).
 * Abre la aplicación de mensajes del teléfono con el texto ya escrito: la persona pulsa
 * «Enviar» (iOS y Android no permiten enviar SMS en segundo plano). También puede llamarle.
 */
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AppHeader,
  AppText,
  Avatar,
  Card,
  EmergencyCallButton,
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  MediClaroMark,
  PrimaryButton,
  Screen,
  SecondaryButton,
  TextButton,
} from '../../components';
import { useAppTheme, useSession } from '../../hooks';
import { EmergencyService, EmergencySession } from '../../services';
import { formatPhoneForDisplay } from '../../utils/format';
import { DemoNotice, EMERGENCY_HREF, callNumberOrExplain, firstName, useOfficialCall, usePreparedEmergency, useNavigateOnce } from './parts';

const OPENED_MESSAGES = 'Hemos abierto tus mensajes con el texto preparado. Pulsa «Enviar» en tu teléfono.';

export default function EmergencyNotifyScreen() {
  const go = useNavigateOnce();
  const theme = useAppTheme();
  const { session: auth } = useSession();
  const demo = auth?.mode === 'demo';
  const { prepared, error, retry, session } = usePreparedEmergency();
  const { callOfficial, callingOfficial } = useOfficialCall();
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const caregiver = prepared?.profile.caregiver ?? null;
  const caregiverPhone = caregiver?.phone.trim() ?? '';
  const phoneDisplay = caregiverPhone ? formatPhoneForDisplay(caregiverPhone) : '';
  const notifyAllowed = prepared?.profile.permissions.notifyContact ?? true;
  const alreadySent = result?.ok === true || session.caregiverNotifiedAt !== null;

  const send = async () => {
    if (!prepared || sendingRef.current) return;
    sendingRef.current = true;
    setSending(true);
    try {
      const res = await EmergencyService.notifyCaregiver(prepared.report);
      if (res.ok) {
        EmergencySession.caregiverNotified();
        setResult({ ok: true, message: res.message ?? OPENED_MESSAGES });
      } else {
        setResult({ ok: false, message: res.message ?? 'No hemos podido abrir tus mensajes. Puedes llamar a tu contacto.' });
      }
    } catch {
      setResult({ ok: false, message: 'No hemos podido abrir tus mensajes. Puedes llamar a tu contacto.' });
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const footer = <EmergencyCallButton variant="soft" onPress={() => void callOfficial()} loading={callingOfficial} />;

  let body;
  if (!prepared && error) {
    body = <ErrorState title="No hemos podido preparar el aviso" message={error} onRetry={() => void retry()} />;
  } else if (!prepared) {
    body = <LoadingState message="Preparando el aviso…" />;
  } else if (!caregiver) {
    body = (
      <EmptyState
        icon="people-outline"
        title="No tienes un contacto de emergencia"
        message="Añade a un familiar o a una persona de confianza para poder avisarle desde aquí."
        action={{ label: 'Añadir contacto', icon: 'person-add-outline', onPress: () => go(EMERGENCY_HREF.profileEdit) }}
      />
    );
  } else {
    const first = firstName(caregiver.name);
    body = (
      <View style={{ gap: theme.spacing.md }}>
        <Card tone="primary" elevated={false}>
          <View style={styles.contact} accessible accessibilityLabel={[caregiver.name, caregiver.relationship, phoneDisplay].filter(Boolean).join(', ')}>
            <Avatar name={caregiver.name} size={76} />
            <View style={[styles.flex, { gap: 2 }]}>
              <AppText variant="heading" color="heading">
                {caregiver.name}
              </AppText>
              {caregiver.relationship.trim() ? (
                <AppText variant="body" color="textSecondary">
                  {caregiver.relationship.trim()}
                </AppText>
              ) : null}
              <AppText variant="body" color="text">
                {phoneDisplay || 'Sin teléfono'}
              </AppText>
            </View>
          </View>
        </Card>

        {!notifyAllowed ? (
          <InfoBanner
            tone="warning"
            title="Has desactivado avisar a tu contacto"
            message="Puedes activarlo cuando quieras. Llamarle sigue estando disponible."
          >
            <TextButton label="Cambiar permisos" align="flex-start" style={styles.bannerAction} onPress={() => go(EMERGENCY_HREF.sharing)} />
          </InfoBanner>
        ) : null}

        {notifyAllowed && !caregiverPhone ? (
          <InfoBanner tone="warning" title="Falta el teléfono de tu contacto" message="Añádelo en tu perfil de emergencia para poder avisarle.">
            <TextButton label="Completar mi perfil" align="flex-start" style={styles.bannerAction} onPress={() => go(EMERGENCY_HREF.profileEdit)} />
          </InfoBanner>
        ) : null}

        {prepared.caregiverMessage ? (
          <Card style={{ gap: theme.spacing.sm }}>
            <AppText variant="bodyStrong" color="heading">
              Este es el mensaje que prepararemos:
            </AppText>
            <View style={[styles.bubble, { backgroundColor: theme.colors.surfaceAlt, borderRadius: theme.radius.md }]}>
              <View style={styles.bubbleHeader}>
                <MediClaroMark size={26} accessibilityLabel="" />
                <AppText variant="label" color="heading">
                  MediClaro
                </AppText>
              </View>
              <AppText variant="body" color="text" selectable>
                {prepared.caregiverMessage}
              </AppText>
            </View>
            <AppText variant="caption" color="textSecondary">
              {`Se abrirá tu aplicación de mensajes con este texto para ${first}. Tú decides si lo envías.`}
            </AppText>
          </Card>
        ) : null}

        {demo && prepared.caregiverMessage ? <DemoNotice message="Modo demostración: no se enviará ningún SMS real." /> : null}

        {result ? (
          <InfoBanner tone={result.ok ? 'success' : 'danger'} title={result.message} />
        ) : null}

        <View style={{ gap: theme.spacing.sm }}>
          {prepared.caregiverMessage ? (
            <PrimaryButton
              label={alreadySent ? 'Enviar otro aviso' : `Enviar mensaje a ${first}`}
              icon="chatbubble-ellipses"
              onPress={() => void send()}
              loading={sending}
              testID="notify-send"
            />
          ) : null}
          {caregiverPhone ? (
            <SecondaryButton
              label={`Llamar a ${first}`}
              icon="call"
              variant="tonal"
              size="lg"
              onPress={() => void callNumberOrExplain(caregiverPhone, phoneDisplay)}
              testID="notify-call"
            />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <Screen header={<AppHeader title="Aviso a familiar" fallbackHref={EMERGENCY_HREF.main} />} footer={footer} testID="emergency-notify">
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  bubble: { padding: 14, gap: 8 },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bannerAction: { marginLeft: -8 },
});
