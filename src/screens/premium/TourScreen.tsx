/**
 * /tour — Explicación de MediClaro con voz y ejemplos, SIN registrarse (tablero: pantallas 2 y 3).
 * También /onboarding (Ayuda → «Ver cómo funciona»).
 *
 *  - 4 pasos: identificar · asistente IA · lectura por voz · emergencias. Se desliza con el dedo o con
 *    «Siguiente»; barra de progreso arriba y puntos abajo.
 *  - Voz pregrabada en cada paso (o voz del sistema si falta el archivo), con botón para silenciarla.
 *  - Ejemplos visuales: maquetas de la propia app marcadas como «Ejemplo» (sin IA real ni datos reales).
 *  - Al terminar: sin Premium → planes; con Premium → vuelve; sin compras en la app → acceso con teléfono.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type ViewToken } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { AppText, Icon, MediClaroLogo, PrimaryButton, Screen, TextButton, type IconName } from '../../components';
import { AnimatedProgressBar, FadeIn } from '../../components/Motion';
import type { TourStepId } from '../../config/tourAudio';
import { useAppTheme, useEntitlement, usePreferences, useSession } from '../../hooks';
import { useTourNarration } from '../../hooks/useTourNarration';
import { AssistantExample, EmergencyExample, IdentifyExample, VoiceExample } from './TourExamples';

interface TourStep {
  id: TourStepId;
  icon: IconName;
  color: string;
  title: string;
  text: string;
  caption: string;
  /** Lo que dice la voz (mismo contenido que la pantalla, dicho con naturalidad). */
  narration: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'identify',
    icon: 'camera',
    color: '#059669',
    title: 'Identifica tus medicamentos',
    text: 'Haz una foto de la caja y obtén su información de forma clara y sencilla.',
    caption: 'Información oficial y explicada con un lenguaje fácil de entender.',
    narration:
      'Identifica tus medicamentos. Haz una foto de la caja y MediClaro te dice qué medicamento es y para qué sirve, con información oficial explicada con palabras sencillas.',
  },
  {
    id: 'assistant',
    icon: 'chatbubbles',
    color: '#2563EB',
    title: 'Pregunta al asistente IA',
    text: 'Haz tus preguntas y recibe explicaciones sencillas y claras sobre tus medicamentos.',
    caption: 'No sustituye a tu médico ni a tu farmacéutico.',
    narration:
      'Pregunta al asistente. Escribe tus dudas y te responde con explicaciones claras y sencillas sobre tus medicamentos. No sustituye a tu médico ni a tu farmacéutico.',
  },
  {
    id: 'voice',
    icon: 'volume-high',
    color: '#7C3AED',
    title: 'Escucha el prospecto',
    text: 'MediClaro te lee en voz alta la información de tu medicamento, despacio y a tu ritmo.',
    caption: 'Ideal si la letra pequeña te cuesta.',
    narration: 'Escucha el prospecto. Si la letra es pequeña, MediClaro te lo lee en voz alta, despacio y a tu ritmo.',
  },
  {
    id: 'emergency',
    icon: 'location',
    color: '#D97706',
    title: 'Emergencias y ubicación',
    text: 'En una urgencia tienes el 112 a un toque y tu ubicación lista para decírsela a quien te atienda.',
    caption: 'El 112 es gratuito y está siempre disponible, también sin Premium.',
    narration:
      'Y si hay una urgencia, tienes el uno, uno, dos siempre a mano, y tu ubicación lista para decírsela a quien te atienda.',
  },
];

const VIEWABILITY = { itemVisiblePercentThreshold: 60 };

export default function TourScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { prefs, markOnboardingSeen } = usePreferences();
  const { status } = useSession();
  const entitlement = useEntitlement();
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, theme.layout.maxContentWidth);
  const contentWidth = pageWidth - theme.layout.screenPaddingH * 2;

  const listRef = useRef<FlatList<TourStep>>(null);
  const [index, setIndex] = useState(0);
  const [listHeight, setListHeight] = useState(0);
  const [soundOn, setSoundOn] = useState(true);
  const [focused, setFocused] = useState(true);
  const indexRef = useRef(0);
  indexRef.current = index;

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  const step = TOUR_STEPS[index];
  const narration = useTourNarration(step, soundOn && focused, prefs.speechRate);
  const isLast = index === TOUR_STEPS.length - 1;

  // Se puede contratar Premium dentro de la app (compras activas y el servidor puede cobrar).
  const sell = entitlement.canSell;
  const hasPremium = status === 'signedIn' && (entitlement.isPremium || !entitlement.required);
  const finishLabel = !sell ? 'Empezar' : hasPremium ? 'Terminar' : 'Ver planes';

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<TourStep>[] }) => {
    const visible = viewableItems.find((v) => v.isViewable && typeof v.index === 'number');
    if (visible && typeof visible.index === 'number') setIndex(visible.index);
  }).current;

  useEffect(() => {
    listRef.current?.scrollToOffset({ offset: indexRef.current * pageWidth, animated: false });
  }, [pageWidth]);

  const goTo = useCallback(
    (next: number) => {
      const target = Math.max(0, Math.min(TOUR_STEPS.length - 1, next));
      setIndex(target);
      listRef.current?.scrollToOffset({ offset: target * pageWidth, animated: true });
    },
    [pageWidth],
  );

  const finish = async () => {
    narration.stop();
    void markOnboardingSeen().catch(() => undefined);
    if (!sell) {
      if (status === 'signedIn') {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
      return;
    }
    if (hasPremium) {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
      return;
    }
    router.push('/premium');
  };

  /** «Saltar la explicación»: con sesión vuelve de donde venía (p. ej. Ayuda); sin sesión, a los planes. */
  const skip = () => {
    narration.stop();
    void markOnboardingSeen().catch(() => undefined);
    if (status === 'signedIn') {
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)');
    } else if (!sell) {
      router.replace('/login');
    } else {
      router.push('/premium');
    }
  };

  const back = () => {
    if (index > 0) goTo(index - 1);
    else if (router.canGoBack()) router.back();
    else router.replace(status === 'signedIn' ? '/(tabs)' : '/welcome');
  };

  const header = (
    <View style={[styles.header, { minHeight: theme.layout.headerHeight, paddingHorizontal: theme.spacing.xs }]}>
      <Pressable
        onPress={back}
        accessibilityRole="button"
        accessibilityLabel={index > 0 ? 'Paso anterior' : 'Volver'}
        hitSlop={8}
        style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.6 : 1 }]}
        testID="tour-back"
      >
        <Icon name="chevron-back" size={30} color={theme.colors.heading} />
      </Pressable>
      <View style={styles.progress}>
        <AnimatedProgressBar
          progress={(index + 1) / TOUR_STEPS.length}
          accessibilityLabel={`Paso ${index + 1} de ${TOUR_STEPS.length}`}
        />
      </View>
      <Pressable
        onPress={() => {
          if (soundOn) narration.stop();
          setSoundOn((v) => !v);
        }}
        accessibilityRole="switch"
        accessibilityState={{ checked: soundOn }}
        accessibilityLabel="Voz de la explicación"
        hitSlop={8}
        style={({ pressed }) => [
          styles.headerBtn,
          styles.sound,
          { backgroundColor: soundOn ? theme.colors.primaryTint : theme.colors.surfaceAlt, opacity: pressed ? 0.7 : 1 },
        ]}
        testID="tour-sound"
      >
        <Icon name={soundOn ? 'volume-high' : 'volume-mute'} size={24} color={soundOn ? theme.colors.primary : theme.colors.textMuted} />
      </Pressable>
    </View>
  );

  const footer = (
    <View style={{ paddingHorizontal: theme.layout.screenPaddingH, gap: theme.spacing.xs }}>
      <View style={styles.dots} accessible accessibilityRole="text" accessibilityLabel={`Página ${index + 1} de ${TOUR_STEPS.length}`}>
        {TOUR_STEPS.map((s, i) => (
          <View
            key={s.id}
            style={[
              styles.dot,
              {
                width: i === index ? 26 : 9,
                backgroundColor: theme.colors.primary,
                opacity: i === index ? 1 : 0.25,
              },
            ]}
          />
        ))}
      </View>
      <PrimaryButton
        label={isLast ? finishLabel : 'Siguiente'}
        icon={isLast && !hasPremium && sell ? 'star' : 'arrow-forward'}
        iconPosition={isLast && !hasPremium && sell ? 'left' : 'right'}
        onPress={isLast ? () => void finish() : () => goTo(index + 1)}
        testID="tour-next"
      />
      {!isLast ? (
        <TextButton label="Saltar la explicación" tone="muted" onPress={skip} testID="tour-skip" />
      ) : null}
    </View>
  );

  return (
    <Screen scroll={false} padded={false} header={header} footer={footer} gradient="soft" testID="tour-screen">
      <View style={styles.logo}>
        <MediClaroLogo variant="horizontal" size="sm" />
      </View>
      <FlatList
        ref={listRef}
        data={TOUR_STEPS}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
        getItemLayout={(_, i) => ({ length: pageWidth, offset: pageWidth * i, index: i })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY}
        extraData={`${pageWidth}-${listHeight}-${index}`}
        initialNumToRender={TOUR_STEPS.length}
        windowSize={TOUR_STEPS.length + 1}
        style={styles.list}
        renderItem={({ item, index: i }) => (
          <ScrollView
            style={{ width: pageWidth, height: listHeight || undefined }}
            contentContainerStyle={{ paddingHorizontal: theme.layout.screenPaddingH, paddingVertical: theme.spacing.sm, gap: theme.spacing.md }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
            accessibilityLabel={`Paso ${i + 1} de ${TOUR_STEPS.length}: ${item.title}`}
          >
            <FadeIn from="bottom">
              <View style={styles.titleRow}>
                <View style={[styles.stepIcon, { backgroundColor: item.color }]}>
                  <Icon name={item.icon} size={30} color="#FFFFFF" />
                </View>
                <AppText variant="title" accessibilityRole="header" style={styles.flex}>
                  {item.title}
                </AppText>
              </View>
              <AppText variant="body" color="textSecondary" style={{ marginTop: theme.spacing.sm }}>
                {item.text}
              </AppText>
            </FadeIn>
            <FadeIn delay={160} from="scale">
              {item.id === 'identify' ? <IdentifyExample active={i === index && focused} width={contentWidth} /> : null}
              {item.id === 'assistant' ? <AssistantExample active={i === index && focused} /> : null}
              {item.id === 'voice' ? <VoiceExample active={i === index && focused} /> : null}
              {item.id === 'emergency' ? <EmergencyExample active={i === index && focused} /> : null}
            </FadeIn>
            <AppText variant="caption" color="textSecondary" align="center">
              {item.caption}
            </AppText>
          </ScrollView>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBtn: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  sound: { borderRadius: 24 },
  progress: { flex: 1, paddingHorizontal: 4 },
  logo: { alignItems: 'center', paddingBottom: 4 },
  list: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginBottom: 2 },
  dot: { height: 9, borderRadius: 999 },
});
