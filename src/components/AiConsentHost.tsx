/**
 * Pantalla del permiso para la inteligencia artificial (se monta UNA vez en el layout raíz).
 *
 * Aparece cuando una pantalla llama a `AiConsentService.ensure()` sin permiso concedido:
 * antes de enviar la primera foto de una caja o la primera pregunta al asistente.
 * Explica con claridad qué se envía, a quién y qué no se envía (norma 5.1.2(i) de Apple),
 * y pide un sí explícito. «Ahora no», el botón atrás de Android o cerrar = no se envía nada.
 */
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { PrimaryButton, SecondaryButton } from './Buttons';
import { useAppTheme } from '../providers/PreferencesProvider';
import { AiConsentService, useAiConsentRequestOpen } from '../services/AiConsentService';
import { ASSISTANT_NAME } from '../config/assistant';

const POINTS: { icon: IconName; text: string }[] = [
  { icon: 'person-remove-outline', text: `Solo enviamos la foto o tu pregunta (y tu nombre, para que ${ASSISTANT_NAME} te llame por él). Nunca tu teléfono.` },
  {
    icon: 'shield-checkmark-outline',
    text: 'Google no las usa para mejorar sus productos y solo las guarda hasta 55 días para evitar abusos.',
  },
  { icon: 'trash-outline', text: `MediClaro no guarda tus fotos. Tus conversaciones con ${ASSISTANT_NAME} se guardan en tu cuenta y puedes borrarlas cuando quieras.` },
  { icon: 'settings-outline', text: 'Puedes retirar este permiso cuando quieras en Perfil › Privacidad y datos.' },
];

export function AiConsentHost() {
  const open = useAiConsentRequestOpen();
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();

  const accept = () => void AiConsentService.answer(true);
  const decline = () => void AiConsentService.answer(false);

  return (
    <Modal visible={open} animationType="slide" onRequestClose={decline} transparent={false} statusBarTranslucent>
      <View
        style={[styles.root, { backgroundColor: c.background, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}
        accessibilityViewIsModal
        testID="ai-consent"
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: theme.layout.screenPaddingH, paddingVertical: theme.spacing.lg, gap: theme.spacing.md }}
        >
          <View style={[styles.badge, { backgroundColor: c.aiSoft }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Icon name="sparkles" size={36} color={c.ai} />
          </View>
          <AppText variant="title" accessibilityRole="header">
            Antes de usar la inteligencia artificial
          </AppText>
          <AppText variant="body" color="text">
            Para leer la caja de tus fotos y responder a tus preguntas, MediClaro usa Gemini, la inteligencia artificial de
            Google.
          </AppText>
          <View style={{ gap: theme.spacing.sm }}>
            {POINTS.map((p) => (
              <View key={p.text} style={styles.point}>
                <Icon name={p.icon} size={26} color={c.aiText} />
                <AppText variant="body" color="text" style={styles.flex}>
                  {p.text}
                </AppText>
              </View>
            ))}
          </View>
          <View style={[styles.note, { backgroundColor: c.surfaceAlt, borderRadius: theme.radius.md }]}>
            <AppText variant="caption" color="textSecondary">
              Sin este permiso puedes seguir identificando tus medicamentos con el código nacional (C.N.) de la caja.
            </AppText>
          </View>
        </ScrollView>
        <View style={{ paddingHorizontal: theme.layout.screenPaddingH, gap: theme.spacing.sm }}>
          <PrimaryButton label="Aceptar y continuar" icon="checkmark" tone="ai" onPress={accept} testID="ai-consent-accept" />
          <SecondaryButton label="Ahora no" variant="neutral" onPress={decline} testID="ai-consent-decline" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  badge: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  note: { padding: 14 },
});
