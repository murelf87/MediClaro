/**
 * /scan — Cámara (referencia 04_camera). La app ya no ofrece el código de barras (las farmacias suelen recortarlo);
 * /scan?mode=barcode sigue funcionando solo por compatibilidad con enlaces antiguos.
 * - Foto de la caja → se reduce a 1280 px (JPEG) y se envía a identificar.
 * - Código de barras → lectura automática (solo la primera lectura).
 * - Galería, linterna y cámara delantera/trasera.
 * - Sin permiso o sin cámara: explicación + alternativas (galería o escribir el código).
 * La foto no se guarda: solo se usa para identificar el medicamento.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useIsFocused, useLocalSearchParams, useRouter } from 'expo-router';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
  type BarcodeSettings,
  type CameraType,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import {
  AppText,
  Card,
  Icon,
  IconButton,
  PrimaryButton,
  Screen,
  SecondaryButton,
  TextButton,
  type IconName,
} from '../../components';
import { useAppTheme } from '../../hooks';
import { AiConsentService, MedicationService } from '../../services';
import { confirmAsync, showAlert } from '../../utils/dialogs';
import { openAppSettings } from '../../utils/device';
import type { IdentifyInput } from '../../types';
import { firstParam } from './helpers';
import { prepareImageForUpload } from './image';

type ScanMode = 'photo' | 'barcode';
type Busy = 'capture' | 'gallery' | 'scanned' | null;

const MODES: { value: ScanMode; label: string }[] = [
  { value: 'photo', label: 'Foto de la caja' },
  { value: 'barcode', label: 'Código de barras' },
];

/** EAN-13/EAN-8 (código de barras de la caja), DataMatrix (código 2D) y Code 128. */
const BARCODE_SETTINGS: BarcodeSettings = { barcodeTypes: ['ean13', 'ean8', 'datamatrix', 'code128'] };

const HINTS: Record<ScanMode, string> = {
  photo: 'Coloca el medicamento dentro del recuadro',
  barcode: 'Apunta al código de barras de la caja',
};

const SETTINGS_PATH = Platform.select({
  ios: 'Ajustes › MediClaro',
  default: 'Ajustes › Aplicaciones › MediClaro › Permisos',
});

export default function ScanScreen() {
  const theme = useAppTheme();
  const c = theme.colors;
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string | string[] }>();
  const isFocused = useIsFocused();

  const [mode, setMode] = useState<ScanMode>(firstParam(params.mode) === 'barcode' ? 'barcode' : 'photo');
  const [permission, requestPermission, refreshPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [torch, setTorch] = useState(false);
  const [ready, setReady] = useState(false);
  const [mountError, setMountError] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [busy, setBusy] = useState<Busy>(null);
  const [asking, setAsking] = useState(false);

  const busyRef = useRef<Busy>(null);
  busyRef.current = busy;
  const scannedRef = useRef(false);
  const pickingRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Al volver de Ajustes, se comprueba otra vez el permiso de la cámara.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshPermission().catch(() => undefined);
    });
    return () => sub.remove();
  }, [refreshPermission]);

  // Al salir de la pantalla se apaga la linterna (y la vista previa se desmonta).
  useFocusEffect(
    useCallback(
      () => () => {
        setTorch(false);
        setReady(false);
      },
      [],
    ),
  );

  const goToProcessing = useCallback(
    (input: IdentifyInput) => {
      setTorch(false);
      MedicationService.setPendingIdentification(input);
      router.replace('/processing');
    },
    [router],
  );

  const cancel = () => {
    setTorch(false);
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const changeMode = (next: ScanMode) => {
    if (next === mode) return;
    scannedRef.current = false;
    setMode(next);
    router.setParams({ mode: next });
  };

  const flip = () => {
    setTorch(false);
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
  };

  /**
   * La foto la lee una IA de terceros (Gemini): antes, permiso explícito.
   * Si no lo da, se ofrece escribir el código nacional de la caja (no usa IA).
   */
  const ensureAiConsent = async (): Promise<boolean> => {
    if (await AiConsentService.ensure()) return true;
    if (!mounted.current) return false;
    const typeCode = await confirmAsync({
      title: 'Sin permiso no podemos leer la foto',
      message: 'Puedes escribir el código nacional (C.N.) que aparece en la caja. No usa inteligencia artificial.',
      confirmText: 'Escribir el código',
      cancelText: 'Ahora no',
    });
    if (typeCode && mounted.current) goToTypeCode();
    return false;
  };

  const capture = async () => {
    const camera = cameraRef.current;
    if (busyRef.current || !ready || !camera) return;
    if (!(await ensureAiConsent())) return;
    if (busyRef.current || !cameraRef.current) return;
    busyRef.current = 'capture';
    setBusy('capture');
    try {
      const photo = await (cameraRef.current ?? camera).takePictureAsync({ quality: 0.8 });
      const base64 = await prepareImageForUpload(photo.uri, photo.width);
      if (!mounted.current || scannedRef.current) return;
      goToProcessing({ imageBase64: base64 });
    } catch {
      if (!mounted.current) return;
      setBusy(null);
      await showAlert('No se ha podido hacer la foto', 'Inténtalo otra vez. También puedes elegir una foto de la galería.');
    }
  };

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (scannedRef.current || busyRef.current) return;
    const data = result.data?.trim();
    if (!data) return;
    scannedRef.current = true;
    busyRef.current = 'scanned';
    setBusy('scanned');
    goToProcessing({ barcode: data });
  };

  const pickFromGallery = async () => {
    if (pickingRef.current || busyRef.current) return;
    pickingRef.current = true;
    setTorch(false);
    try {
      // Abrimos primero el selector nativo. El consentimiento de IA se pide DESPUÉS de elegir
      // la imagen y antes de procesarla/enviarla, para que el botón Fotos nunca parezca bloqueado.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
        allowsEditing: false,
        exif: false,
      });
      if (result.canceled || !result.assets?.length || !mounted.current) return;
      if (!(await ensureAiConsent()) || !mounted.current) return;
      const asset = result.assets[0];
      busyRef.current = 'gallery';
      setBusy('gallery');
      const base64 = await prepareImageForUpload(asset.uri, asset.width);
      if (!mounted.current) return;
      goToProcessing({ imageBase64: base64 });
    } catch {
      if (!mounted.current) return;
      busyRef.current = null;
      setBusy(null);
      await showAlert('No se ha podido abrir la foto', 'Prueba con otra foto o hazla con la cámara.');
    } finally {
      pickingRef.current = false;
    }
  };

  const askPermission = async () => {
    setAsking(true);
    try {
      await requestPermission();
    } catch {
      // El estado del permiso se queda como estaba.
    } finally {
      if (mounted.current) setAsking(false);
    }
  };

  const openSettings = async () => {
    const ok = await openAppSettings();
    if (!ok) await showAlert('No se han podido abrir los ajustes', `Ábrelos desde el teléfono (${SETTINGS_PATH}) y activa la cámara.`);
  };

  const retryCamera = () => {
    setMountError(null);
    setReady(false);
    setCameraKey((k) => k + 1);
  };

  const goToTypeCode = () => router.replace('/add-medication?form=cn');

  const granted = permission?.granted === true;
  const cameraOn = granted && !mountError;

  return (
    <Screen scroll={false} padded={false} background="callBackground" statusBar="light">
      <View style={[styles.topBar, { paddingHorizontal: theme.spacing.xs, minHeight: theme.layout.headerHeight }]}>
        <TextButton label="Cancelar" tone="inverse" onPress={cancel} align="flex-start" testID="scan-cancel" />
        {cameraOn && facing === 'back' ? (
          <IconButton
            icon={torch ? 'flash' : 'flash-off'}
            color={c.callText}
            size={28}
            selected={torch}
            onPress={() => setTorch((t) => !t)}
            accessibilityLabel={torch ? 'Apagar la linterna' : 'Encender la linterna'}
            testID="scan-torch"
          />
        ) : (
          <View style={{ width: theme.touchTargets.min }} />
        )}
      </View>

      {permission === null ? (
        <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel="Preparando la cámara">
          <ActivityIndicator size="large" color={c.callText} />
          <AppText variant="body" color="callTextMuted" align="center" style={{ marginTop: theme.spacing.md }}>
            Preparando la cámara…
          </AppText>
        </View>
      ) : cameraOn ? (
        <>
          {mode === 'barcode' ? <ModeSwitch mode={mode} onChange={changeMode} disabled={!!busy} /> : null}

          <View style={[styles.viewfinder, { marginHorizontal: theme.spacing.md, borderRadius: theme.radius.xl, backgroundColor: c.callSurface }]}>
            {isFocused ? (
              <CameraView
                key={cameraKey}
                ref={cameraRef}
                style={StyleSheet.absoluteFill}
                facing={facing}
                mode="picture"
                enableTorch={torch && facing === 'back'}
                barcodeScannerSettings={mode === 'barcode' ? BARCODE_SETTINGS : undefined}
                onBarcodeScanned={mode === 'barcode' && !busy ? handleBarcode : undefined}
                onCameraReady={() => setReady(true)}
                onMountError={(e) => {
                  setReady(false);
                  setTorch(false);
                  setMountError(e.message || 'La cámara no está disponible.');
                }}
              />
            ) : null}

            <View style={[StyleSheet.absoluteFill, styles.overlay, { padding: theme.spacing.md }]}>
              <View style={styles.frameArea}>
                <ScanFrame mode={mode} />
              </View>
              <View
                style={[styles.hint, { backgroundColor: c.overlay, borderRadius: theme.radius.lg, paddingHorizontal: theme.spacing.lg }]}
                accessible
                accessibilityLiveRegion="polite"
              >
                <AppText variant="subheading" color="callText" align="center">
                  {HINTS[mode]}
                </AppText>
              </View>
            </View>

            {busy === 'capture' || busy === 'gallery' ? (
              <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: c.overlay }]} accessibilityRole="progressbar" accessibilityLabel="Preparando la foto">
                <ActivityIndicator size="large" color={c.callText} />
                <AppText variant="bodyStrong" color="callText" align="center" style={{ marginTop: theme.spacing.sm }}>
                  Preparando la foto…
                </AppText>
              </View>
            ) : null}
          </View>

          <View style={[styles.bottomBar, { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.md }]}>
            <RoundControl icon="image-outline" label="Elegir una foto de la galería" onPress={pickFromGallery} disabled={!!busy} testID="scan-gallery" />
            <Shutter
              onPress={capture}
              busy={busy === 'capture'}
              disabled={!ready || !!busy}
              label={mode === 'photo' ? 'Hacer la foto' : 'Hacer una foto del código'}
            />
            <RoundControl
              icon="camera-reverse-outline"
              label={facing === 'back' ? 'Usar la cámara delantera' : 'Usar la cámara trasera'}
              onPress={flip}
              disabled={!!busy}
              testID="scan-flip"
            />
          </View>
        </>
      ) : (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.panel, { padding: theme.spacing.lg, gap: theme.spacing.md }]}
          showsVerticalScrollIndicator={false}
        >
          <Card padding={theme.spacing.lg} style={[styles.panelCard, { gap: theme.spacing.sm }]}>
            <View style={[styles.panelIcon, { backgroundColor: c.primaryTint }]}>
              <Icon name={mountError ? 'videocam-off-outline' : 'camera-outline'} size={40} color={c.primary} />
            </View>
            {mountError ? (
              <>
                <AppText variant="heading" align="center" accessibilityRole="header">
                  No hemos podido abrir la cámara
                </AppText>
                <AppText variant="body" color="textSecondary" align="center">
                  Puede que otra aplicación la esté usando. Ciérrala y vuelve a intentarlo.
                </AppText>
                <PrimaryButton label="Reintentar" icon="refresh" onPress={retryCamera} style={styles.panelButton} />
              </>
            ) : (
              <>
                <AppText variant="heading" align="center" accessibilityRole="header">
                  Necesitamos permiso para usar la cámara
                </AppText>
                <AppText variant="body" color="textSecondary" align="center">
                  {mode === 'photo'
                    ? 'Así podrás hacer una foto a la caja de tu medicamento para identificarlo. MediClaro no guarda la foto: solo se usa para identificar el medicamento.'
                    : 'Así podrás escanear el código de barras de la caja de tu medicamento. MediClaro no guarda ninguna imagen de la cámara.'}
                </AppText>
                {permission.canAskAgain ? (
                  <PrimaryButton label="Permitir cámara" icon="camera" onPress={askPermission} loading={asking} style={styles.panelButton} />
                ) : (
                  <>
                    <AppText variant="bodyStrong" color="heading" align="center">
                      {`El permiso está desactivado. Actívalo en ${SETTINGS_PATH}.`}
                    </AppText>
                    <PrimaryButton label="Abrir ajustes" icon="settings-outline" onPress={openSettings} style={styles.panelButton} />
                  </>
                )}
              </>
            )}
          </Card>

          <AppText variant="captionStrong" color="callTextMuted" align="center">
            También puedes
          </AppText>
          <SecondaryButton
            label="Elegir una foto de la galería"
            icon="images-outline"
            onPress={pickFromGallery}
            loading={busy === 'gallery'}
            size="lg"
          />
          <SecondaryButton label="Escribir el código de la caja" icon="keypad-outline" onPress={goToTypeCode} size="lg" />
        </ScrollView>
      )}
    </Screen>
  );
}

// ─── Piezas de la cámara ──────────────────────────────────────────────────────

function ModeSwitch({ mode, onChange, disabled }: { mode: ScanMode; onChange: (m: ScanMode) => void; disabled: boolean }) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <View
      style={[styles.modeSwitch, { backgroundColor: c.callSurface, borderRadius: theme.radius.pill, marginHorizontal: theme.spacing.md, marginBottom: theme.spacing.sm }]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Qué quieres escanear"
    >
      {MODES.map((m) => {
        const active = m.value === mode;
        return (
          <Pressable
            key={m.value}
            onPress={() => onChange(m.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={m.label}
            accessibilityState={{ selected: active, checked: active, disabled }}
            style={({ pressed }) => [
              styles.modeItem,
              {
                minHeight: theme.touchTargets.min,
                borderRadius: theme.radius.pill,
                backgroundColor: active ? c.surface : pressed ? c.overlay : 'transparent',
              },
            ]}
          >
            <AppText variant="captionStrong" align="center" style={{ color: active ? c.heading : c.callText }} numberOfLines={2}>
              {m.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Esquinas blancas del recuadro (más ancho y bajo para el código de barras). */
function ScanFrame({ mode }: { mode: ScanMode }) {
  const color = useAppTheme().colors.callText;
  const size = 44;
  const w = 5;
  return (
    <View style={[styles.frame, mode === 'barcode' ? styles.frameBarcode : styles.framePhoto]}>
      <View style={[styles.corner, { width: size, height: size, borderColor: color, top: 0, left: 0, borderTopWidth: w, borderLeftWidth: w, borderTopLeftRadius: 18 }]} />
      <View style={[styles.corner, { width: size, height: size, borderColor: color, top: 0, right: 0, borderTopWidth: w, borderRightWidth: w, borderTopRightRadius: 18 }]} />
      <View style={[styles.corner, { width: size, height: size, borderColor: color, bottom: 0, left: 0, borderBottomWidth: w, borderLeftWidth: w, borderBottomLeftRadius: 18 }]} />
      <View style={[styles.corner, { width: size, height: size, borderColor: color, bottom: 0, right: 0, borderBottomWidth: w, borderRightWidth: w, borderBottomRightRadius: 18 }]} />
    </View>
  );
}

function RoundControl({
  icon,
  label,
  onPress,
  disabled,
  testID,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}) {
  const c = useAppTheme().colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      hitSlop={6}
      style={({ pressed }) => [
        styles.round,
        { backgroundColor: c.callSurface, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name={icon} size={30} color={c.callText} />
    </Pressable>
  );
}

function Shutter({ onPress, busy, disabled, label }: { onPress: () => void; busy: boolean; disabled: boolean; label: string }) {
  const c = useAppTheme().colors;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      testID="scan-shutter"
      style={({ pressed }) => [styles.shutterRing, { borderColor: c.callText, opacity: disabled && !busy ? 0.5 : 1 }, pressed ? styles.shutterPressed : null]}
    >
      <View style={[styles.shutterInner, { backgroundColor: c.callText }]}>
        {busy ? <ActivityIndicator color={c.primary} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modeSwitch: { flexDirection: 'row', padding: 4, gap: 4 },
  modeItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  viewfinder: { flex: 1, overflow: 'hidden' },
  /** Superposición del visor: no captura toques (los recibe la cámara). */
  overlay: { justifyContent: 'space-between', pointerEvents: 'none' },
  frameArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  frame: { maxHeight: '100%' },
  framePhoto: { width: '82%', aspectRatio: 1.1 },
  frameBarcode: { width: '86%', aspectRatio: 2.2 },
  corner: { position: 'absolute' },
  hint: { alignSelf: 'center', paddingVertical: 14, maxWidth: 420 },
  bottomBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  round: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  shutterRing: { width: 86, height: 86, borderRadius: 43, borderWidth: 5, alignItems: 'center', justifyContent: 'center' },
  shutterPressed: { transform: [{ scale: 0.94 }] },
  shutterInner: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  panel: { flexGrow: 1, justifyContent: 'center' },
  panelCard: { alignItems: 'center' },
  panelIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  panelButton: { alignSelf: 'stretch', marginTop: 8 },
});
