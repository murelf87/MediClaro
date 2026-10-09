/**
 * /owner — Acceso privado del propietario (pantalla 1 del panel).
 *  - Primera vez: crea tu código de administrador (6 cifras, dos veces) y, si el teléfono lo permite, Face ID.
 *  - Después: entra con el código o con Face ID. El código lo comprueba el servidor y se bloquea 15 minutos tras 5
 *    fallos. Nada de esto se guarda en el teléfono salvo el permiso de Face ID, protegido por la biometría.
 *  - Si la cuenta no es de propietario, se explica y no se enseña nada más.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText, ErrorState, Icon, LoadingState, MediClaroLogo, OtpInput, Screen } from '../../components';
import { useAppTheme, useAsync } from '../../hooks';
import { OwnerAdminService, type UnlockResult } from '../../services/OwnerAdminService';
import { showAlert } from '../../utils/dialogs';
import { toAppError } from '../../api/errors';
import { OButton, OC, OIcon, OLink, ONote, OT, OwnerHeader, fmtTime, useOwnerUnlocked } from './OwnerKit';

type Step = 'enter' | 'create' | 'confirm';

// Mismas reglas que el servidor (owner_weak_pin): así se avisa antes de escribirlo dos veces.
const WEAK = new Set(['012345', '123456', '234567', '345678', '456789', '987654', '876543', '765432', '654321', '543210', '121212', '112233', '123123', '123321', '111222', '101010', '202020', '159753', '147258', '000111']);
export const isWeakPin = (p: string) => !/^[0-9]{6}$/.test(p) || /^(.)\1{5}$/.test(p) || WEAK.has(p);

export default function OwnerAccessScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const router = useRouter();
  const unlocked = useOwnerUnlocked();
  const status = useAsync(() => OwnerAdminService.status(), []);
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [step, setStep] = useState<Step>('enter');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'danger' | 'warning' | 'info'; text: string } | null>(null);
  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [faceIdReady, setFaceIdReady] = useState(false);
  const canFaceId = OwnerAdminService.canUseFaceId();
  const [rememberFaceId, setRememberFaceId] = useState(canFaceId);
  const lock = useRef(false);
  const faceTried = useRef(false);

  const goPanel = useCallback(() => router.replace('/owner/dashboard' as Href), [router]);

  useEffect(() => {
    if (unlocked) goPanel();
  }, [unlocked, goPanel]);

  useEffect(() => {
    const s = status.data;
    if (!s) return;
    setStep(s.hasPin ? 'enter' : 'create');
    setLockedUntil(s.lockedUntil);
  }, [status.data]);

  // Al terminar el bloqueo se puede volver a escribir.
  useEffect(() => {
    if (!lockedUntil) return undefined;
    const ms = new Date(lockedUntil).getTime() - Date.now();
    if (ms <= 0) {
      setLockedUntil(null);
      return undefined;
    }
    const t = setTimeout(() => {
      setLockedUntil(null);
      setMessage(null);
    }, ms + 500);
    return () => clearTimeout(t);
  }, [lockedUntil]);

  const explain = useCallback((r: UnlockResult) => {
    if (r.ok) return;
    if (r.error === 'LOCKED') {
      setLockedUntil(r.lockedUntil ?? null);
      setMessage({ tone: 'danger', text: `Demasiados intentos. Por seguridad, podrás volver a intentarlo a las ${fmtTime(r.lockedUntil)}.` });
    } else if (r.error === 'PIN_INCORRECT') {
      const left = r.attemptsLeft ?? 0;
      setMessage({ tone: 'warning', text: `Código incorrecto. ${left === 1 ? 'Te queda 1 intento' : `Te quedan ${left} intentos`} antes de que se bloquee 15 minutos.` });
    } else if (r.error === 'DEVICE_INVALID') {
      setFaceIdReady(false);
      setMessage({ tone: 'info', text: 'Face ID ya no está activo en este teléfono. Entra con tu código y vuelve a activarlo.' });
    } else if (r.error === 'CANCELLED') {
      setMessage({ tone: 'info', text: 'No se ha comprobado Face ID. Puedes entrar con tu código.' });
    } else if (r.error === 'PIN_NOT_SET') {
      setStep('create');
    }
  }, []);

  const run = useCallback(async (fn: () => Promise<UnlockResult & { faceIdSaved?: boolean }>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const r = await fn();
      if (r.ok) {
        if (r.faceIdSaved === false) {
          await showAlert('Face ID no se ha activado', 'El panel está abierto, pero no se ha guardado Face ID en este teléfono. Puedes activarlo en Configuración › Seguridad.');
        }
        goPanel();
      } else {
        setPin('');
        explain(r);
      }
    } catch (e) {
      setPin('');
      // Si no se ha podido crear el código, se vuelve a elegir desde el principio.
      setStep((s) => (s === 'confirm' ? 'create' : s));
      setFirstPin('');
      setMessage({ tone: 'danger', text: toAppError(e).message });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, [explain, goPanel]);

  const submit = useCallback((value: string) => {
    if (value.length !== 6 || lockedUntil) return;
    if (step === 'enter') {
      void run(() => OwnerAdminService.unlock(value, canFaceId && rememberFaceId && !faceIdReady));
    } else if (step === 'create') {
      if (isWeakPin(value)) {
        setPin('');
        setMessage({ tone: 'warning', text: 'Ese código es muy fácil de adivinar. Elige 6 cifras sin repetir ni seguir un orden (nada de 123456 o 111111).' });
        return;
      }
      setMessage(null);
      setFirstPin(value);
      setPin('');
      setStep('confirm');
    } else if (value !== firstPin) {
      setPin('');
      setFirstPin('');
      setStep('create');
      setMessage({ tone: 'warning', text: 'Los dos códigos no coinciden. Vuelve a crearlo.' });
    } else {
      void run(() => OwnerAdminService.setupPin(value, canFaceId && rememberFaceId));
    }
  }, [step, firstPin, lockedUntil, run, canFaceId, rememberFaceId, faceIdReady]);

  const faceId = useCallback(() => void run(() => OwnerAdminService.unlockWithFaceId()), [run]);

  // ¿Hay Face ID guardado? Si lo hay, se ofrece al entrar (una vez).
  useEffect(() => {
    let alive = true;
    if (status.data?.hasPin) {
      void OwnerAdminService.hasFaceId().then((has) => {
        if (!alive) return;
        setFaceIdReady(has);
        if (has && !faceTried.current && !status.data?.lockedUntil) {
          faceTried.current = true;
          faceId();
        }
      });
    }
    return () => {
      alive = false;
    };
  }, [status.data, faceId]);

  const onChange = (v: string) => {
    setPin(v);
    if (v.length === 6) submit(v);
  };

  const forgot = () =>
    void showAlert(
      '¿Has olvidado tu código?',
      'Por seguridad no se puede recuperar desde la app. Bórralo desde el panel de Supabase (las instrucciones están en el documento de despliegue: «Restablecer el código del panel») y al volver aquí podrás crear uno nuevo.',
    );

  const title = step === 'enter' ? 'Acceso exclusivo' : step === 'create' ? 'Crea tu código' : 'Repite el código';
  const text =
    step === 'enter'
      ? 'Introduce tu código de administrador para acceder al Dashboard.'
      : step === 'create'
        ? 'Elige 6 cifras fáciles de recordar para ti y difíciles de adivinar. Te lo pediremos al abrir el Dashboard.'
        : 'Escríbelo otra vez para comprobar que es el mismo.';

  let body;
  if (status.status === 'loading') {
    body = <LoadingState message="Comprobando tu acceso…" />;
  } else if (status.error) {
    body = (
      <ErrorState
        kind={status.error.kind}
        title={status.error.code === 'OWNER_REQUIRED' ? 'Panel solo para el propietario' : undefined}
        message={status.error.message}
        onRetry={status.error.code === 'OWNER_REQUIRED' ? undefined : () => void status.reload()}
        secondaryAction={{ label: 'Volver', onPress: () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile' as Href)) }}
      />
    );
  } else {
    body = (
      <View style={styles.page}>
        <View style={styles.logo}>
          <MediClaroLogo variant="horizontal" size="lg" />
        </View>
        <View style={styles.card} testID="owner-access-card">
          <View style={styles.titleRow}>
            <OIcon icon="lock-closed" variant="soft" size={50} bg="#DCE8FF" round />
            <View style={[styles.flex, { gap: 6, paddingTop: 2 }]}>
              <AppText style={[OT.h2, { fontSize: 19, lineHeight: 25 }]} color="heading" accessibilityRole="header">{title}</AppText>
              <AppText style={OT.subtitle} color="textSecondary">{text}</AppText>
            </View>
          </View>
          <OtpInput
            value={pin}
            onChange={onChange}
            kind="pin"
            disabled={busy || !!lockedUntil}
            error={message?.tone === 'warning' || message?.tone === 'danger'}
            accessibilityLabel={step === 'enter' ? 'Código de administrador' : 'Nuevo código de administrador'}
            testID="owner-pin"
          />
          {message ? (
            <ONote tone={message.tone === 'danger' ? 'red' : message.tone === 'warning' ? 'amber' : 'blue'} testID="owner-access-message">
              {message.text}
            </ONote>
          ) : null}
          {step === 'enter' && faceIdReady ? (
            <Pressable
              onPress={faceId}
              disabled={busy || !!lockedUntil}
              accessibilityRole="button"
              accessibilityLabel={Platform.OS === 'android' ? 'Usar la huella' : 'Usar Face ID'}
              testID="owner-faceid"
              style={({ pressed }) => [styles.faceBtn, { backgroundColor: pressed ? OC.blueSoft : '#FFFFFF' }]}
            >
              <Icon name="scan-outline" size={22} color={OC.blue} />
              <AppText style={[OT.label, { color: c.heading }]}>{Platform.OS === 'android' ? 'Usar la huella' : 'Usar Face ID'}</AppText>
            </Pressable>
          ) : null}
          {canFaceId && !faceIdReady && step !== 'confirm' ? (
            <View style={styles.toggleRow}>
              <AppText style={[OT.cardText, styles.flex]} color="text">
                {Platform.OS === 'ios' ? 'Entrar con Face ID la próxima vez en este iPhone' : 'Entrar con la huella la próxima vez en este móvil'}
              </AppText>
              <Switch value={rememberFaceId} onValueChange={setRememberFaceId} accessibilityLabel="Recordar con Face ID" testID="owner-remember-faceid" />
            </View>
          ) : null}
        </View>
        <OButton
          label={step === 'enter' ? 'Acceder' : step === 'create' ? 'Continuar' : 'Crear código y acceder'}
          onPress={() => submit(pin)}
          loading={busy}
          disabled={pin.length !== 6 || busy || !!lockedUntil}
          testID="owner-access-submit"
        />
        <View style={styles.center}>
          {step === 'enter' ? <OLink label="¿Olvidaste tu código?" onPress={forgot} testID="owner-forgot" /> : null}
          {step === 'confirm' ? (
            <OLink label="Volver a elegir el código" onPress={() => { setStep('create'); setPin(''); setFirstPin(''); }} />
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <Screen header={<OwnerHeader right={null} logo={false} />} gradient="soft" keyboard testID="owner-access">
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { gap: 18, paddingTop: 0 },
  logo: { alignItems: 'center', paddingTop: 6, paddingBottom: 10 },
  card: { gap: 20, backgroundColor: 'rgba(226, 236, 252, 0.55)', borderRadius: 20, borderWidth: 1, borderColor: '#E1EAF8', padding: 18 },
  center: { alignItems: 'center' },
  titleRow: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  faceBtn: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: OC.line },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
