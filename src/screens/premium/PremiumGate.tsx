/**
 * Funciones reales solo con MediClaro Premium (cuando se puede contratar en la app).
 *
 *  - withPremium(Pantalla, 'identify') envuelve la ruta: con Premium se ve la pantalla; sin Premium, una
 *    pantalla amable que explica la función y lleva a los planes (nunca se usa la IA real sin pagar).
 *  - Mientras se comprueba no se muestra ningún candado (sin parpadeos para quien ya paga).
 *  - Si no se puede comprobar Premium, no se concede acceso; el servidor aplica también el bloqueo.
 *  - Las emergencias y el 112 NUNCA pasan por aquí.
 */
import type { ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AppHeader, AppText, CheckItem, LoadingState, PrimaryButton, Screen, SecondaryButton, TextButton } from '../../components';
import { FadeIn } from '../../components/Motion';
import { GuideIllustration } from '../../components/Guide';
import { useAppTheme, useEntitlement, useSession } from '../../hooks';
import { BenefitIcon, PremiumPill } from './parts';

export type PremiumFeature = 'identify' | 'assistant' | 'medicines' | 'voice' | 'history' | 'pills';

const COPY: Record<PremiumFeature, { benefit: string; title: string; text: string; points: string[] }> = {
  identify: {
    benefit: 'identify',
    title: 'Identifica tus medicamentos con Premium',
    text: 'Haz una foto de la caja y te explicamos qué medicamento es y para qué sirve, con información oficial.',
    points: ['Foto de la caja o código nacional (C.N.)', 'Información oficial de la AEMPS', 'Explicado con palabras sencillas'],
  },
  assistant: {
    benefit: 'assistant',
    title: 'Pregunta al asistente IA con Premium',
    text: 'Resuelve tus dudas sobre medicamentos con explicaciones claras, cuando lo necesites.',
    points: ['Respuestas claras y sencillas', 'Basadas en información oficial', 'No sustituye a tu médico o farmacéutico'],
  },
  medicines: {
    benefit: 'medicines',
    title: 'Tus medicamentos con Premium',
    text: 'Guarda tus medicamentos y tenlos siempre a mano, con su información y su prospecto.',
    points: ['Tu lista de medicamentos', 'Su información siempre a mano', 'Lectura del prospecto en voz alta'],
  },
  voice: {
    benefit: 'voice',
    title: 'Lectura por voz con Premium',
    text: 'MediClaro te lee en voz alta la información de tus medicamentos, despacio y a tu ritmo.',
    points: ['Voz clara en español', 'Pausa y repite cuando quieras', 'Ideal si la letra pequeña cuesta'],
  },
  pills: {
    benefit: 'medicines',
    title: 'Mis pastillas con Premium',
    text: 'MediClaro te avisa a la hora de cada toma, guarda lo que has tomado y te lo recuerda cuando no estés seguro.',
    points: ['Avisos a su hora, también sin internet', 'Confirma cada toma con un toque', 'Pregunta: «¿me he tomado la pastilla?»'],
  },
  history: {
    benefit: 'identify',
    title: 'Tu historial con Premium',
    text: 'Consulta los medicamentos que has identificado y vuelve a verlos cuando quieras.',
    points: ['Tus búsquedas guardadas', 'Vuelve a ver cualquier medicamento', 'Todo en un solo sitio'],
  },
};

export function LockedFeatureScreen({ feature }: { feature: PremiumFeature }) {
  const router = useRouter();
  const theme = useAppTheme();
  const { status } = useSession();
  const copy = COPY[feature];
  return (
    <Screen
      gradient="premium"
      header={<AppHeader fallbackHref={status === 'signedIn' ? '/(tabs)' : '/welcome'} />}
      footer={
        <>
          <PrimaryButton label="Ver planes" icon="star" onPress={() => router.push('/premium')} testID="locked-see-plans" />
          <SecondaryButton
            label="Volver al inicio"
            variant="neutral"
            onPress={() => router.replace(status === 'signedIn' ? '/(tabs)' : '/welcome')}
            testID="locked-home"
          />
        </>
      }
      testID={`locked-${feature}`}
    >
      <View style={[styles.center, { gap: theme.spacing.xs }]}>
        <FadeIn from="scale">
          <View>
            <GuideIllustration size={170} />
            <View style={styles.featureBadge}>
              <BenefitIcon id={copy.benefit} size={52} />
            </View>
          </View>
        </FadeIn>
        <PremiumPill style={{ marginTop: theme.spacing.xs }} />
        <AppText variant="title" align="center" accessibilityRole="header">
          {copy.title}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {copy.text}
        </AppText>
      </View>
      <View style={[styles.points, { gap: theme.spacing.xs, marginTop: theme.spacing.lg }]}>
        {copy.points.map((p, i) => (
          <FadeIn key={p} delay={200 + i * 80} from="left">
            <CheckItem label={p} />
          </FadeIn>
        ))}
      </View>
      <TextButton
        label="¿Es una urgencia? El 112 siempre está disponible"
        tone="danger"
        icon="call"
        onPress={() => router.push('/emergency')}
        style={{ marginTop: theme.spacing.lg }}
        testID="locked-emergency"
      />
    </Screen>
  );
}

/** Envuelve una pantalla que usa funciones reales (IA, identificación, voz, Mis medicamentos). */
export function withPremium<P extends object>(Wrapped: ComponentType<P>, feature: PremiumFeature) {
  function PremiumOnly(props: P) {
    const entitlement = useEntitlement();
    if (entitlement.unlocked) return <Wrapped {...props} />;
    if (entitlement.status === 'loading' || entitlement.status === 'idle') {
      return (
        <Screen scroll={false}>
          <LoadingState message="Un momento…" />
        </Screen>
      );
    }
    return <LockedFeatureScreen feature={feature} />;
  }
  PremiumOnly.displayName = `withPremium(${Wrapped.displayName ?? Wrapped.name ?? 'Screen'})`;
  return PremiumOnly;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center' },
  points: { alignSelf: 'center', width: '100%', maxWidth: 380 },
  featureBadge: { position: 'absolute', right: -4, bottom: 8 },
});
