/**
 * /report-problem — «Notifícanos un error» (desde Ayuda). Pública: sirve con y sin cuenta.
 *
 *  - La persona elige dónde le ha pasado (opcional), lo cuenta con sus palabras (o lo dicta con el micrófono del
 *    teclado) y, si quiere que le contestemos, deja un teléfono o correo (con cuenta Premium se rellena con el suyo).
 *  - Llega a la bandeja «Errores notificados» del panel del propietario con los datos técnicos del móvil
 *    (ProblemReportService: versión, sistema, últimas pantallas…; nunca medicamentos, salud ni ubicación).
 *  - Al enviarlo se le da una referencia corta («E-7K2PX») para citarla si nos llama.
 */
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, AppText, Card, Chip, Icon, InfoBanner, PrimaryButton, Screen, SecondaryButton, TextField } from '../../components';
import { useAppTheme, useEntitlement, useOwnerPreview, usePreferences, useSession } from '../../hooks';
import { ProblemReportService, REPORT_MAX, validateReport } from '../../services/ProblemReportService';
import { RecentScreens } from '../../services/RecentScreens';
import { isAppError } from '../../services';
import { formatPhoneForDisplay } from '../../utils/format';
import { useHomeHref } from './parts';

const AREAS = ['Identificar medicamento', 'Asistente', 'Voz', 'Mis pastillas', 'Pagos o Premium', 'Cuidador/a y avisos', 'Emergencia', 'Otro'];

export default function ReportProblemScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const homeHref = useHomeHref();
  const { session } = useSession();
  const entitlement = useEntitlement();
  const { prefs } = usePreferences();
  const preview = useOwnerPreview();
  const [area, setArea] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [contact, setContact] = useState(() => (session?.phone ? formatPhoneForDisplay(session.phone) : ''));
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentRef, setSentRef] = useState<string | null>(null);
  const running = useRef(false);

  const send = async () => {
    if (running.current) return;
    const invalid = validateReport(message, contact);
    if (invalid) {
      setError(invalid);
      return;
    }
    running.current = true;
    setSending(true);
    setError(null);
    try {
      const { ref } = await ProblemReportService.send(message, contact, {
        screen: RecentScreens.before('/help', '/report-problem'),
        screens: RecentScreens.list(),
        area,
        sessionMode: session?.mode ?? null,
        premium: entitlement.isPremium,
        fontSize: prefs.fontSize,
        easyMode: prefs.easyMode,
        readingVoice: prefs.readingVoice,
        assistantVoice: prefs.assistantVoice,
        preview,
      });
      setSentRef(ref || 'recibido');
    } catch (e) {
      setError(isAppError(e) ? e.message : 'No se ha podido enviar. Comprueba la conexión y vuelve a intentarlo.');
    } finally {
      running.current = false;
      setSending(false);
    }
  };

  if (sentRef) {
    return (
      <Screen header={<AppHeader title="Notifícanos un error" fallbackHref="/help" />} testID="report-sent">
        <View style={[styles.center, { gap: theme.spacing.md, marginTop: theme.spacing.xl }]}>
          <View style={[styles.okCircle, { backgroundColor: theme.colors.successSoft }]}>
            <Icon name="checkmark" size={56} color={theme.colors.successStrong} />
          </View>
          <AppText variant="heading" align="center" accessibilityRole="header">
            ¡Gracias! Lo hemos recibido.
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            Lo revisaremos para solucionarlo cuanto antes.
            {contact.trim() ? ' Si hace falta, te contestaremos.' : ''}
          </AppText>
          {sentRef !== 'recibido' ? (
            <Card style={{ alignSelf: 'stretch', alignItems: 'center', gap: 4 }}>
              <AppText variant="caption" color="textSecondary">
                Tu referencia
              </AppText>
              <AppText variant="heading" selectable testID="report-ref">
                {sentRef}
              </AppText>
              <AppText variant="caption" color="textSecondary" align="center">
                Si nos llamas o escribes por este error, dinos esta referencia.
              </AppText>
            </Card>
          ) : null}
          <PrimaryButton label="Volver" icon="arrow-back" onPress={() => (router.canGoBack() ? router.back() : router.replace(homeHref))} testID="report-done" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen header={<AppHeader title="Notifícanos un error" fallbackHref="/help" />} keyboard testID="report-problem">
      <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing.xs }}>
        Cuéntanos qué ha pasado y lo revisaremos para solucionarlo. No hace falta saber de tecnología: escríbelo con tus
        palabras.
      </AppText>

      <AppText variant="label" color="heading" style={{ marginTop: theme.spacing.md }}>
        ¿Dónde te ha pasado?{' '}
        <AppText variant="caption" color="textMuted">
          (opcional)
        </AppText>
      </AppText>
      <View style={[styles.chips, { marginTop: theme.spacing.xs }]}>
        {AREAS.map((a) => (
          <Chip key={a} label={a} selected={area === a} onPress={() => setArea((cur) => (cur === a ? null : a))} />
        ))}
      </View>

      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.md }}>
        <TextField
          label="¿Qué ha pasado?"
          value={message}
          onChangeText={(v) => {
            setMessage(v);
            if (error) setError(null);
          }}
          placeholder="Por ejemplo: al pulsar «Escuchar» no se oye nada."
          multiline
          maxLength={REPORT_MAX}
          hint="También puedes dictarlo con el micrófono del teclado."
          testID="report-message"
        />
        <TextField
          label="Teléfono o correo para contestarte"
          optional
          value={contact}
          onChangeText={setContact}
          placeholder="Por ejemplo: 600 123 456"
          autoComplete="tel"
          maxLength={120}
          hint="Solo lo usaremos para contestarte sobre este error."
          testID="report-contact"
        />
        <InfoBanner
          tone="info"
          message="Con tu mensaje se envían datos técnicos del móvil (versión de la app y del sistema, y las últimas pantallas que has usado). Nunca tus medicamentos, tu salud ni tu ubicación."
        />
        {error ? <InfoBanner tone="danger" message={error} /> : null}
        <PrimaryButton label="Enviar" icon="send" onPress={() => void send()} loading={sending} disabled={sending} testID="report-send" />
        <SecondaryButton label="Cancelar" variant="outline" onPress={() => (router.canGoBack() ? router.back() : router.replace('/help'))} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  okCircle: { width: 104, height: 104, borderRadius: 52, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
