/**
 * /candidates — "Elige tu medicamento": varios parecidos tras la identificación.
 * Fuente: último resultado de MedicationService (ambiguo → parecidos; identificado → mejor + otros).
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  AppHeader,
  AppText,
  Badge,
  Icon,
  LoadingState,
  MedicationImage,
  Screen,
  SecondaryButton,
  TextButton,
} from '../../components';
import { useAppTheme } from '../../hooks';
import { MedicationService } from '../../services';
import type { MedicationCandidate } from '../../types';
import { candidatesFromLastResult, matchLabel } from './helpers';

export default function CandidatesScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const [candidates] = useState<MedicationCandidate[] | null>(() => candidatesFromLastResult(MedicationService.getLastResult()));

  useEffect(() => {
    if (!candidates) router.replace('/scan');
  }, [candidates, router]);

  const pick = (id: string) => router.replace({ pathname: '/result', params: { id } });

  // El título va en el contenido (en la cabecera se cortaría con letra grande).
  const header = <AppHeader />;

  if (!candidates) {
    return (
      <Screen header={header}>
        <LoadingState message="Abriendo la cámara…" />
      </Screen>
    );
  }

  return (
    <Screen
      header={header}
      footer={
        <>
          <SecondaryButton label="Ninguno coincide · Hacer otra foto" icon="camera-outline" size="lg" onPress={() => router.replace('/scan')} />
          <TextButton label="Escribir el código nacional" icon="keypad-outline" onPress={() => router.replace('/add-medication')} />
        </>
      }
    >
      <View style={{ marginTop: theme.spacing.xxs, gap: theme.spacing.xs }}>
        <AppText variant="captionStrong" color="primary" style={styles.overline}>
          Elige tu medicamento
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          ¿Cuál es tu medicamento?
        </AppText>
        <AppText variant="body" color="textSecondary">
          Hemos encontrado varios parecidos. Toca el que coincide con el nombre de tu caja.
        </AppText>
      </View>

      <View style={{ gap: theme.layout.stackGap, marginTop: theme.spacing.lg }}>
        {candidates.map((c, i) => (
          <CandidateCard key={c.id} candidate={c} onPress={() => pick(c.id)} testID={`candidate-${i}`} />
        ))}
      </View>
    </Screen>
  );
}

function CandidateCard({ candidate, onPress, testID }: { candidate: MedicationCandidate; onPress: () => void; testID?: string }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const match = matchLabel(candidate.score);
  const loadImage = useCallback(() => MedicationService.getMedicationImage(candidate.id), [candidate.id]);
  const details = [candidate.pharmaceuticalForm, candidate.laboratory].filter(Boolean).join('. ');
  // Aquí la persona compara con SU caja: se muestra el nombre tal y como viene impreso
  // (nombre oficial), no el nombre corto, para distinguir marcas y laboratorios.
  const boxName = candidate.officialName || candidate.name;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${boxName}. ${details ? `${details}. ` : ''}${match.label}`}
      accessibilityHint="Muestra este medicamento"
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        {
          minHeight: theme.touchTargets.large + 24,
          borderRadius: theme.radius.lg,
          borderColor: c.border,
          backgroundColor: pressed ? c.surfaceAlt : c.surface,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
        theme.shadow.card,
      ]}
    >
      <MedicationImage uri={candidate.imageUrl} loadUri={loadImage} width={76} height={68} radius={theme.radius.sm} />
      <View style={styles.text}>
        <AppText variant="bodyStrong" color="heading">
          {boxName}
        </AppText>
        {candidate.pharmaceuticalForm ? (
          <AppText variant="caption" color="textSecondary">
            {candidate.pharmaceuticalForm}
          </AppText>
        ) : null}
        {candidate.laboratory ? (
          <AppText variant="caption" color="textSecondary">
            {candidate.laboratory}
          </AppText>
        ) : null}
        <View style={styles.badge}>
          <Badge label={match.label} tone={match.tone} size="sm" />
        </View>
      </View>
      <Icon name="chevron-forward" size={24} color={c.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderWidth: 1 },
  text: { flex: 1, gap: 2 },
  badge: { alignSelf: 'flex-start', marginTop: 6 },
  overline: { textTransform: 'uppercase', letterSpacing: 0.6 },
});
