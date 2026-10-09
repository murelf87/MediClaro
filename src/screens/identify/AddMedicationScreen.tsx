/**
 * /add-medication — Dos formas de añadir un medicamento: foto de la caja o escribir el código nacional (C.N.).
 * Sin código de barras: las farmacias suelen recortarlo de la caja al dispensar (decisión del propietario).
 * /add-medication?form=cn abre directamente el campo del código.
 */
import { useRef, useState } from 'react';
import { Keyboard, StyleSheet, View, type ScrollView, type TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AppHeader, AppText, Card, PrimaryButton, Screen, TextField } from '../../components';
import { useAppTheme } from '../../hooks';
import { MedicationService } from '../../services';
import { parseNationalCode } from './helpers';
import { OptionCard, useNavLock } from './parts';

export default function AddMedicationScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const navigate = useNavLock();
  const params = useLocalSearchParams<{ form?: string | string[] }>();
  const [expanded, setExpanded] = useState(() => (Array.isArray(params.form) ? params.form[0] : params.form) === 'cn');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const toggleForm = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      setTimeout(() => {
        inputRef.current?.focus();
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 250);
    } else {
      Keyboard.dismiss();
    }
  };

  const onChangeCode = (text: string) => {
    setCode(text.replace(/[^\d.\s-]/g, '').slice(0, 20));
    if (error) setError(null);
  };

  const submit = () => {
    const check = parseNationalCode(code);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    setError(null);
    Keyboard.dismiss();
    navigate(() => {
      MedicationService.setPendingIdentification(check.input);
      router.push('/processing');
    });
  };

  // El título va en el contenido: en la cabecera se cortaría con la letra grande.
  return (
    <Screen header={<AppHeader />} keyboard scrollRef={scrollRef}>
      <View style={{ marginTop: theme.spacing.xxs, marginBottom: theme.spacing.lg, gap: theme.spacing.xs }}>
        <AppText variant="title" accessibilityRole="header">
          Añadir medicamento
        </AppText>
        <AppText variant="body" color="textSecondary">
          ¿Cómo quieres añadirlo? Elige la forma más cómoda para ti y te mostraremos la información oficial.
        </AppText>
      </View>

      <View style={{ gap: theme.layout.stackGap }}>
        <OptionCard
          icon="camera"
          tone="primary"
          title="Hacer una foto a la caja"
          subtitle="Enfoca la cara de la caja donde se lee el nombre"
          onPress={() => navigate(() => router.push('/scan?mode=photo'))}
          testID="add-photo"
        />
        <OptionCard
          icon="keypad"
          tone="neutral"
          title="Escribir el código nacional"
          subtitle="El número de 6 cifras que aparece junto a «C.N.»"
          onPress={toggleForm}
          expanded={expanded}
          testID="add-code"
        />

        {expanded ? (
          <Card padding={theme.spacing.md} style={{ gap: theme.spacing.md }}>
            <TextField
              ref={inputRef}
              label="Código nacional (C.N.)"
              hint="Son 6 cifras que aparecen en la caja junto a «C.N.»"
              error={error}
              value={code}
              onChangeText={onChangeCode}
              placeholder="Ej.: 658257"
              keyboardType="number-pad"
              inputMode="numeric"
              returnKeyType="search"
              onSubmitEditing={submit}
              autoComplete="off"
              autoCorrect={false}
              textContentType="none"
              maxLength={20}
              leftIcon="keypad-outline"
              testID="add-code-input"
            />
            <PrimaryButton label="Buscar medicamento" icon="search" onPress={submit} testID="add-code-submit" />
          </Card>
        ) : null}
      </View>

      <AppText variant="caption" color="textMuted" align="center" style={[styles.note, { marginTop: theme.spacing.xl }]}>
        Información oficial de la AEMPS (CIMA). No sustituye la opinión de tu médico o farmacéutico.
      </AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { paddingHorizontal: 8 },
});
