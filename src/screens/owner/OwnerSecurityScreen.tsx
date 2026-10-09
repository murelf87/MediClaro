/**
 * /owner/security — Seguridad (código y autenticación), con el mismo estilo del diseño: cambiar el código de
 * administrador, Face ID (o huella) en este teléfono, teléfonos con Face ID (quitar), últimos accesos y cierre del panel.
 */
import { useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AppText, ErrorState, OtpInput, SkeletonList } from '../../components';
import { useAsync } from '../../hooks';
import { OwnerAdminService, type UnlockResult } from '../../services/OwnerAdminService';
import { confirmAsync } from '../../utils/dialogs';
import { toAppError } from '../../api/errors';
import { OButton, OCard, OIcon, OLink, ONote, OPill, ORow, OSection, OT, OwnerScreen, fmtDate, fmtDateTime, fmtTime } from './OwnerKit';

type PinStep = 'idle' | 'current' | 'new' | 'repeat';

function failText(r: UnlockResult): string {
  if (r.ok) return '';
  if (r.error === 'LOCKED') return `Demasiados intentos. Podrás volver a intentarlo a las ${fmtTime(r.lockedUntil)}.`;
  if (r.error === 'PIN_INCORRECT') return `El código actual no es correcto. ${r.attemptsLeft === 1 ? 'Te queda 1 intento' : `Te quedan ${r.attemptsLeft ?? 0} intentos`}.`;
  return 'No se ha podido comprobar el código.';
}

export default function OwnerSecurityScreen() {
  const account = useAsync(() => OwnerAdminService.account(), []);
  const devices = useAsync(() => OwnerAdminService.devices(), []);
  const faceHere = useAsync(() => OwnerAdminService.hasFaceId(), []);
  const canFaceId = OwnerAdminService.canUseFaceId();
  const faceName = Platform.OS === 'android' ? 'la huella' : 'Face ID';
  const faceTitle = Platform.OS === 'android' ? 'Huella en este móvil' : Platform.OS === 'ios' ? 'Face ID en este iPhone' : 'Face ID';

  const [step, setStep] = useState<PinStep>('idle');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [value, setValue] = useState('');
  const [faceStep, setFaceStep] = useState(false);
  const [facePin, setFacePin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'green' | 'amber' | 'red'; text: string } | null>(null);
  const lock = useRef(false);

  const refreshAll = () => {
    void account.refresh();
    void devices.refresh();
    void faceHere.refresh();
  };

  const runSafe = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await fn();
    } catch (e) {
      setMessage({ tone: 'amber', text: toAppError(e).message });
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };

  const cancelPin = () => {
    setStep('idle');
    setValue('');
    setCurrent('');
    setNext('');
  };

  const onPin = (v: string) => {
    setValue(v);
    if (v.length !== 6) return;
    if (step === 'current') {
      setCurrent(v);
      setValue('');
      setStep('new');
    } else if (step === 'new') {
      setNext(v);
      setValue('');
      setStep('repeat');
    } else if (step === 'repeat') {
      if (v !== next) {
        setValue('');
        setNext('');
        setStep('new');
        setMessage({ tone: 'amber', text: 'Los dos códigos nuevos no coinciden. Escríbelo otra vez.' });
        return;
      }
      void runSafe(async () => {
        const r = await OwnerAdminService.changePin(current, v);
        setValue('');
        if (!r.ok) {
          setStep('current');
          setCurrent('');
          setNext('');
          setMessage({ tone: 'red', text: failText(r) });
          return;
        }
        cancelPin();
        await OwnerAdminService.disableFaceIdHere();
        setMessage({ tone: 'green', text: `Código cambiado. Por seguridad se ha quitado ${faceName} de todos los teléfonos y se han cerrado los demás accesos.` });
        refreshAll();
      });
    }
  };

  const onFacePin = (v: string) => {
    setFacePin(v);
    if (v.length !== 6) return;
    void runSafe(async () => {
      const r = await OwnerAdminService.enableFaceId(v);
      setFacePin('');
      if (!r.ok) {
        setMessage({ tone: 'red', text: failText(r) });
        return;
      }
      setFaceStep(false);
      setMessage(r.faceIdSaved ? { tone: 'green', text: `${faceName === 'la huella' ? 'Huella' : 'Face ID'} activado en este teléfono.` } : { tone: 'amber', text: `No se ha podido guardar ${faceName} en este teléfono.` });
      refreshAll();
    });
  };

  const removeDevice = (id: string, label: string) =>
    void runSafe(async () => {
      const ok = await confirmAsync({ title: 'Quitar el teléfono', message: `«${label}» ya no podrá abrir el panel con ${faceName}.`, confirmText: 'Quitar', destructive: true });
      if (!ok) return;
      await OwnerAdminService.deviceRevoke(id);
      refreshAll();
    });

  const pinTitle = step === 'current' ? 'Escribe tu código actual' : step === 'new' ? 'Escribe el código nuevo' : 'Repite el código nuevo';
  const a = account.data;

  return (
    <OwnerScreen title="Seguridad" subtitle="Código y autenticación." keyboard testID="owner-security">
      {message ? <ONote tone={message.tone} testID="owner-security-message">{message.text}</ONote> : null}

      <OCard style={styles.card}>
        <View style={styles.cardHead}>
          <OIcon icon="keypad" size={42} />
          <View style={[styles.flex, { gap: 2 }]}>
            <AppText style={OT.cardTitle} color="heading">Código de administrador</AppText>
            <AppText style={OT.h2} color="heading" accessibilityLabel="Código oculto">••••••</AppText>
            {a?.pinUpdatedAt ? <AppText style={OT.meta} color="textSecondary">{`Cambiado el ${fmtDate(a.pinUpdatedAt)}`}</AppText> : null}
          </View>
        </View>
        {step === 'idle' ? (
          <OButton
            label="Cambiar código"
            icon="key-outline"
            variant="outline"
            onPress={() => {
              setMessage(null);
              setStep('current');
            }}
            testID="owner-change-pin"
          />
        ) : (
          <View style={{ gap: 10 }}>
            <AppText style={OT.label} color="heading">{pinTitle}</AppText>
            <OtpInput value={value} onChange={onPin} kind="pin" disabled={busy} accessibilityLabel={pinTitle} testID="owner-change-pin-input" />
            <OLink label="Cancelar" onPress={cancelPin} />
          </View>
        )}
      </OCard>

      <OCard style={styles.card}>
        <View style={styles.cardHead}>
          <OIcon icon="scan" size={42} />
          <View style={[styles.flex, { gap: 2 }]}>
            <AppText style={OT.cardTitle} color="heading">{faceTitle}</AppText>
            <AppText style={OT.cardText} color="textSecondary">
              {!canFaceId
                ? Platform.OS === 'web'
                  ? 'En el navegador no se puede usar Face ID: entra con tu código.'
                  : 'Este teléfono no tiene Face ID ni huella configurados.'
                : faceHere.data
                  ? `Activado: puedes abrir el panel con ${faceName}.`
                  : 'Abre el panel sin escribir el código.'}
            </AppText>
          </View>
          {canFaceId ? <OPill label={faceHere.data ? 'Activado' : 'Apagado'} tone={faceHere.data ? 'green' : 'gray'} /> : null}
        </View>
        {!canFaceId ? null : faceHere.data ? (
          <OButton
            label={`Dejar de usar ${faceName} aquí`}
            icon="close-circle-outline"
            variant="outline"
            onPress={() =>
              void runSafe(async () => {
                await OwnerAdminService.disableFaceIdHere();
                refreshAll();
              })
            }
            testID="owner-faceid-off"
          />
        ) : faceStep ? (
          <View style={{ gap: 10 }}>
            <AppText style={OT.label} color="heading">Escribe tu código para activarlo</AppText>
            <OtpInput value={facePin} onChange={onFacePin} kind="pin" disabled={busy} accessibilityLabel="Código de administrador" testID="owner-faceid-pin" />
            <OLink
              label="Cancelar"
              onPress={() => {
                setFaceStep(false);
                setFacePin('');
              }}
            />
          </View>
        ) : (
          <OButton
            label={`Activar ${faceName}`}
            icon="scan-outline"
            onPress={() => {
              setMessage(null);
              setFaceStep(true);
            }}
            testID="owner-faceid-on"
          />
        )}
      </OCard>

      <OSection title={`Teléfonos con ${faceName}`} />
      {devices.status === 'loading' ? <SkeletonList rows={1} /> : null}
      {devices.error ? <ErrorState kind={devices.error.kind} message={devices.error.message} onRetry={() => void devices.reload()} /> : null}
      {devices.data && !devices.data.length ? <AppText style={OT.cardText} color="textSecondary">Ninguno: solo se entra con el código.</AppText> : null}
      {devices.data?.map((d) => (
        <ORow
          key={d.id}
          left={<OIcon icon="phone-portrait" variant="soft" size={40} />}
          title={d.current ? `${d.label} (este)` : d.label}
          subtitle={`${d.lastUsedAt ? `Último uso: ${fmtDateTime(d.lastUsedAt)}` : 'Sin usar todavía'} · caduca el ${fmtDate(d.expiresAt)}`}
          right={<OLink label="Quitar" tone="red" onPress={() => removeDevice(d.id, d.label)} testID={`owner-device-remove-${d.id}`} />}
        />
      ))}

      {a?.recentUnlocks.length ? (
        <>
          <OSection title="Últimos accesos" />
          <OCard style={{ gap: 2, paddingVertical: 8 }}>
            {a.recentUnlocks.map((u, i) => (
              <View key={`${u.at}-${i}`} style={[styles.unlock, i ? styles.divider : null]}>
                <OIcon icon={u.via === 'device' ? 'scan' : 'keypad'} variant="plain" size={30} />
                <AppText style={[OT.label, styles.flex]} color="heading">{fmtDateTime(u.at)}</AppText>
                <AppText style={OT.meta} color="textSecondary">{u.via === 'device' ? `Con ${faceName}` : u.via === 'setup' ? 'Al crear el código' : 'Con código'}</AppText>
              </View>
            ))}
          </OCard>
        </>
      ) : null}

      <ONote>El panel se cierra solo tras 15 minutos sin usarlo, a las 8 horas como máximo y al volver a la app después de 2 minutos fuera.</ONote>
      <OButton label="Cerrar el panel ahora" icon="lock-closed-outline" variant="outline" onPress={() => void OwnerAdminService.lock()} testID="owner-security-lock" />
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  unlock: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, flexWrap: 'wrap' },
  divider: { borderTopWidth: 1, borderTopColor: '#EEF2F8' },
});
