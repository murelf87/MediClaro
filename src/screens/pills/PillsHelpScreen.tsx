/**
 * /pills/help — «Cómo funciona Mis pastillas»: qué hace y todo lo que se puede hacer, explicado con calma y con un
 * dibujo por paso (grande, para personas mayores). Se abre desde la tarjeta «¿Cómo funciona?» de Mis pastillas y
 * desde sus ajustes. Con Premium (como el resto de Mis pastillas).
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, AppText, Card, Icon, PrimaryButton, Screen, SecondaryButton, type IconName } from '../../components';
import { useAppTheme } from '../../hooks';
import { withPremium } from '../premium/PremiumGate';

type Step = { icon: IconName; color: string; bg: string; title: string; text: string };

const STEPS: Step[] = [
  {
    icon: 'add-circle',
    color: '#2563EB',
    bg: '#DBEAFE',
    title: '1 · Apunta cada medicamento',
    text: 'Escribe la pauta tal como te la dio tu médico o farmacéutico: cuánto, a qué horas y hasta cuándo. Si identificas la caja con una foto, se apunta con un toque y puedes guardar la foto de tu propia caja.',
  },
  {
    icon: 'alarm',
    color: '#D97706',
    bg: '#FEF3C7',
    title: '2 · El móvil te avisa a su hora',
    text: 'A la hora de cada toma suena la alarma de MediClaro y después una voz te dice qué pastilla toca. Funciona aunque no tengas internet y aunque la app esté cerrada.',
  },
  {
    icon: 'checkmark-circle',
    color: '#059669',
    bg: '#D1FAE5',
    title: '3 · Confirma cuando la tomes',
    text: 'Toca «Ya me la he tomado» o «Más tarde». Nada se marca solo: así sabes de verdad qué has tomado y qué no. Si se te pasa, la toma queda en rojo para que la veas.',
  },
  {
    icon: 'calendar',
    color: '#2563EB',
    bg: '#DBEAFE',
    title: '4 · Mira el calendario',
    text: 'Cada día tiene sus puntos de colores: verde confirmada, naranja pendiente, gris más tarde y rojo requiere atención. Toca un día para ver sus tomas.',
  },
  {
    icon: 'time',
    color: '#0F766E',
    bg: '#CCFBF1',
    title: '5 · Consulta el historial',
    text: 'Hoy, ayer, esta semana o este mes: cuántas tomas has confirmado y cuáles faltaron. Te sirve para la consulta con tu médico.',
  },
  {
    icon: 'people',
    color: '#7C3AED',
    bg: '#EDE9FE',
    title: '6 · Comparte con tu cuidador/a si quieres',
    text: 'Tú decides si tu cuidador/a puede ver tus tomas, confirmarlas por ti o recibir un aviso cuando no confirmas una. Se cambia en Ajustes y se puede quitar cuando quieras.',
  },
  {
    icon: 'chatbubbles',
    color: '#7C3AED',
    bg: '#EDE9FE',
    title: '7 · Pregunta a MediClaro',
    text: '«¿Qué pastillas me quedan hoy?», «¿Me he tomado la de la tensión?». El asistente responde con tus tomas confirmadas de verdad, nunca inventa.',
  },
];

function PillsHelpScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <Screen header={<AppHeader title="Cómo funciona" fallbackHref="/pills" />} testID="pills-help">
      <View style={{ gap: theme.spacing.md }}>
        <Card tone="muted" style={{ gap: 8 }}>
          <View style={styles.heroRow}>
            <View style={[styles.heroIcon, { backgroundColor: c.primary }]}>
              <Icon name="medkit" size={30} color="#FFFFFF" />
            </View>
            <View style={styles.flex}>
              <AppText variant="heading" color="heading">Mis pastillas</AppText>
              <AppText variant="body" color="textSecondary">Para no olvidar ninguna toma y saber siempre qué has tomado.</AppText>
            </View>
          </View>
        </Card>

        {STEPS.map((s) => (
          <Card key={s.title}>
            <View style={styles.step} accessible accessibilityLabel={`${s.title}. ${s.text}`}>
              <View style={[styles.stepIcon, { backgroundColor: s.bg }]}>
                <Icon name={s.icon} size={30} color={s.color} />
              </View>
              <View style={styles.flex}>
                <AppText variant="subheading" color="heading">{s.title}</AppText>
                <AppText variant="body" color="textSecondary">{s.text}</AppText>
              </View>
            </View>
          </Card>
        ))}

        <Card tone="muted" style={{ gap: 6 }}>
          <AppText variant="bodyStrong" color="heading">Bueno saberlo</AppText>
          <AppText variant="caption" color="textSecondary">
            Tu pauta y tus tomas se guardan en tu cuenta y en este móvil (por eso los avisos funcionan sin internet). MediClaro te ayuda a recordar y registrar: no cambia ninguna pauta ni sustituye a tu médico o farmacéutico.
          </AppText>
        </Card>

        <PrimaryButton label="Añadir un medicamento" icon="add-circle" onPress={() => router.push('/pills/edit')} testID="pills-help-add" />
        <SecondaryButton label="Probar cómo es el aviso" icon="notifications-outline" variant="outline" onPress={() => router.push('/pills/settings')} testID="pills-help-test" />
      </View>
    </Screen>
  );
}

export default withPremium(PillsHelpScreen, 'pills');

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 4 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
