/**
 * /owner/review — «Revisar la app» (panel del propietario).
 *
 *  1. «Ver la app como…»: recorre la app tal como la ve un visitante sin cuenta, una cuenta Básica (gratis), una
 *     Premium o un cuidador/a. Es SOLO visual y SOLO en este teléfono (src/services/OwnerPreview.ts): no cambia nada
 *     en el servidor, no cobra nada y no cancela avisos. Arriba aparece la etiqueta «Vista: … · Salir».
 *  2. «Pruebas de este móvil»: voz natural (la de la IA), voz del teléfono, servidor, planes y pagos, permisos y
 *     código MediClaro, con una frase clara de qué falla y dónde.
 *  3. Accesos directos: errores que han notificado los usuarios y el estado del servidor.
 */
import { useCallback, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText, Icon, type IconName } from '../../components';
import { usePreferences } from '../../hooks';
import { OwnerPreview, PREVIEW_LABEL, type PreviewRole } from '../../services/OwnerPreview';
import type { GeminiVoice } from '../../services/PreferencesService';
import { OButton, OC, OCard, OChips, OIcon, ONote, ORow, OSection, OT, OwnerScreen } from './OwnerKit';
import {
  appInfo,
  checkAccessCode,
  checkDeviceVoice,
  checkPermissions,
  checkServerAndPayments,
  sayOnDevice,
  testNaturalVoice,
  type CheckResult,
} from './reviewChecks';

const ROLES: { role: PreviewRole; icon: IconName; title: string; subtitle: string; to: string }[] = [
  { role: 'visitor', icon: 'person-outline', title: 'Sin cuenta', subtitle: 'La entrada, «Conocer MediClaro», «Ya soy Premium» y los planes.', to: '/welcome' },
  { role: 'free', icon: 'happy-outline', title: 'Básico (gratis)', subtitle: 'Qué está bloqueado y cómo se le ofrece Premium.', to: '/(tabs)' },
  { role: 'premium', icon: 'star', title: 'Premium', subtitle: 'Todo desbloqueado, como un cliente que paga.', to: '/(tabs)' },
  { role: 'caregiver', icon: 'people', title: 'Cuidador/a', subtitle: 'Su pantalla de avisos, el chat y el simulacro.', to: '/caregiver' },
];

const VOICES: { value: GeminiVoice; label: string }[] = [
  { value: 'Sulafat', label: 'Sulafat' },
  { value: 'Achird', label: 'Achird' },
];

type Running = Record<string, boolean>;

function stateLook(result: CheckResult | undefined, running: boolean): { icon: IconName; color: string; said: string } {
  if (running) return { icon: 'time', color: '#D97706', said: 'comprobando' };
  if (!result) return { icon: 'ellipse-outline', color: '#94A3B8', said: 'sin comprobar' };
  switch (result.state) {
    case 'ok':
      return { icon: 'checkmark-circle', color: '#16A34A', said: 'bien' };
    case 'warn':
      return { icon: 'alert-circle', color: '#D97706', said: 'aviso' };
    case 'fail':
      return { icon: 'close-circle', color: OC.red, said: 'falla' };
    default:
      return { icon: 'information-circle', color: OC.blue, said: 'información' };
  }
}

function CheckRow({ label, result, running, action, testID }: { label: string; result?: CheckResult; running?: boolean; action?: ReactNode; testID?: string }) {
  const look = stateLook(result, !!running);
  const detail = running ? 'Comprobando…' : result?.detail ?? 'Sin comprobar todavía.';
  return (
    <OCard style={styles.checkRow} accessibilityLabel={`${label}: ${look.said}. ${detail}`} testID={testID}>
      <Icon name={look.icon} size={26} color={look.color} />
      <View style={[styles.flex, { gap: 2 }]}>
        <AppText style={OT.cardTitle} color="heading">{label}</AppText>
        <AppText style={OT.cardText} color="textSecondary">{detail}</AppText>
        {action ? <View style={styles.rowAction}>{action}</View> : null}
      </View>
    </OCard>
  );
}

export default function OwnerReviewScreen() {
  const router = useRouter();
  const { prefs } = usePreferences();
  const [voice, setVoice] = useState<GeminiVoice>(prefs.assistantVoice === 'Achird' ? 'Achird' : 'Sulafat');
  const [results, setResults] = useState<Record<string, CheckResult>>({ app: appInfo() });
  const [permissions, setPermissions] = useState<{ label: string; result: CheckResult }[]>([]);
  const [running, setRunning] = useState<Running>({});

  const run = useCallback(async (key: string, task: () => Promise<void>) => {
    setRunning((r) => ({ ...r, [key]: true }));
    try {
      await task();
    } finally {
      setRunning((r) => ({ ...r, [key]: false }));
    }
  }, []);

  const put = (key: string, value: CheckResult) => setResults((r) => ({ ...r, [key]: value }));

  const runVoice = useCallback(
    (v: GeminiVoice) => run('voice', async () => put('voice', await testNaturalVoice(v))),
    [run],
  );
  const runServer = useCallback(
    () =>
      run('server', async () => {
        const { server, payments } = await checkServerAndPayments();
        setResults((r) => ({ ...r, server, payments }));
      }),
    [run],
  );
  const runDeviceVoice = useCallback(() => run('device', async () => put('device', await checkDeviceVoice())), [run]);
  const runPermissions = useCallback(() => run('permissions', async () => setPermissions(await checkPermissions())), [run]);
  const runCode = useCallback(() => run('code', async () => put('code', await checkAccessCode())), [run]);

  const runAll = async () => {
    // La voz natural va al final: se oye cuando ya están todas las demás comprobaciones.
    await Promise.all([runServer(), runDeviceVoice(), runPermissions(), runCode()]);
    await runVoice(voice);
  };

  const preview = (role: PreviewRole, to: string) => {
    OwnerPreview.set(role);
    router.replace(to as Href);
  };

  const anyRunning = Object.values(running).some(Boolean);

  return (
    <OwnerScreen title="Revisar la app" subtitle="Cómo la ve cada persona y si algo falla en este móvil" testID="owner-review">
      <OSection title="Ver la app como…" />
      {ROLES.map((r) => (
        <ORow
          key={r.role}
          left={<OIcon icon={r.icon} variant="soft" size={40} />}
          title={r.title}
          subtitle={r.subtitle}
          onPress={() => preview(r.role, r.to)}
          testID={`owner-review-as-${r.role}`}
          accessibilityLabel={`Ver la app como ${PREVIEW_LABEL[r.role]}. ${r.subtitle}`}
        />
      ))}
      <ONote>
        Es solo para mirar y solo en este teléfono: no cambia nada en el servidor ni en ninguna cuenta, no se cobra nada y
        tus avisos siguen funcionando. Para volver, pulsa «Salir» en la etiqueta de arriba.
      </ONote>

      <OSection title="Pruebas de este móvil" />
      <OButton label="Probar todo" icon="pulse" onPress={() => void runAll()} loading={anyRunning} testID="owner-review-run-all" />

      <CheckRow label="Versión" result={results.app} testID="owner-review-app" />
      <CheckRow
        label="Voz natural (IA y lecturas)"
        result={results.voice}
        running={running.voice}
        testID="owner-review-voice"
        action={
          <View style={{ gap: 8 }}>
            <OChips options={VOICES} value={voice} onChange={setVoice} />
            <OButton label={`Escuchar ${voice}`} icon="volume-high" variant="outline" onPress={() => void runVoice(voice)} disabled={!!running.voice} testID="owner-review-voice-test" />
          </View>
        }
      />
      <CheckRow
        label="Voz del teléfono (respaldo)"
        result={results.device}
        running={running.device}
        testID="owner-review-device-voice"
        action={
          <View style={styles.actions}>
            <OButton label="Comprobar" variant="outline" onPress={() => void runDeviceVoice()} disabled={!!running.device} style={styles.half} />
            <OButton label="Escuchar" icon="volume-medium" variant="outline" onPress={sayOnDevice} style={styles.half} />
          </View>
        }
      />
      <CheckRow label="Servidor" result={results.server} running={running.server} testID="owner-review-server" />
      <CheckRow
        label="Planes y pagos"
        result={results.payments}
        running={running.server}
        testID="owner-review-payments"
        action={<OButton label="Comprobar" variant="outline" onPress={() => void runServer()} disabled={!!running.server} />}
      />
      {permissions.length ? (
        permissions.map((p) => <CheckRow key={p.label} label={p.label} result={p.result} running={running.permissions} />)
      ) : (
        <CheckRow
          label="Permisos del móvil"
          running={running.permissions}
          action={<OButton label="Comprobar" variant="outline" onPress={() => void runPermissions()} disabled={!!running.permissions} />}
        />
      )}
      <CheckRow
        label="Código MediClaro"
        result={results.code}
        running={running.code}
        testID="owner-review-code"
        action={<OButton label="Comprobar" variant="outline" onPress={() => void runCode()} disabled={!!running.code} />}
      />

      <OSection title="Lo que nos cuentan y el servidor" />
      <ORow
        left={<OIcon icon="chatbox-ellipses" variant="soft" size={40} />}
        title="Errores notificados"
        subtitle="Lo que los usuarios han escrito desde «Ayuda → Notifícanos un error»."
        onPress={() => router.push('/owner/reports' as Href)}
        testID="owner-review-reports"
      />
      <ORow
        left={<OIcon icon="server" variant="soft" size={40} />}
        title="Estado del servidor"
        subtitle="Funciones, errores de las últimas 24 h y configuración."
        onPress={() => router.push('/owner/system' as Href)}
        testID="owner-review-system"
      />
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rowAction: { marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
});
