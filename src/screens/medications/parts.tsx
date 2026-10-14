/**
 * Piezas locales de "Mis medicamentos" e "Historial" (equipo C).
 *  - SearchField: buscador gris redondeado de la referencia (sin etiqueta visible).
 *  - UsageMeter: barra de progreso del uso mensual (plan gratuito).
 *  - matchesQuery / firstParam / isValidMedicationId: utilidades puras.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText, Icon } from '../../components';
import { useAppTheme } from '../../hooks';
import { MAX_FONT_SIZE_MULTIPLIER } from '../../theme';
import type { Medication } from '../../types';

// ─── Utilidades ───────────────────────────────────────────────────────────────

const ACCENTS: Record<string, string> = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', à: 'a', è: 'e', ò: 'o', ñ: 'n' };

/** Minúsculas y sin tildes (no depende de String.normalize, que Hermes no garantiza). */
export function normalizeForSearch(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[áéíóúüàèòñ]/g, (ch) => ACCENTS[ch] ?? ch)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Búsqueda local por nombre (corto u oficial, incluido el laboratorio) o principio activo. */
export function matchesQuery(
  med: Pick<Medication, 'name' | 'activeIngredient'> & Partial<Pick<Medication, 'officialName'>>,
  query: string,
): boolean {
  const q = normalizeForSearch(query);
  if (!q) return true;
  return (
    normalizeForSearch(med.name).includes(q) ||
    normalizeForSearch(med.officialName).includes(q) ||
    normalizeForSearch(med.activeIngredient).includes(q)
  );
}

/** useLocalSearchParams puede devolver string o string[]. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

/** Mismo formato que valida el servicio (nº de registro AEMPS). */
export function isValidMedicationId(id: string | undefined): id is string {
  return !!id && /^[\w-]{1,20}$/.test(id);
}

// ─── Buscador ─────────────────────────────────────────────────────────────────

export function SearchField({
  value,
  onChangeText,
  placeholder = 'Buscar medicamento…',
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [focused, setFocused] = useState(false);
  return (
    <View
      style={[
        styles.search,
        {
          minHeight: theme.touchTargets.comfortable,
          borderRadius: theme.radius.md,
          backgroundColor: focused ? c.surface : c.surfaceMuted,
          borderColor: focused ? c.primary : c.surfaceMuted,
          paddingLeft: theme.spacing.md,
        },
      ]}
    >
      <Icon name="search" size={24} color={c.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
        accessibilityLabel="Buscar medicamento"
        accessibilityHint="Busca por nombre o por principio activo"
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="never"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.searchInput, theme.typography.body, { color: c.text }]}
      />
      {value ? (
        <Pressable
          onPress={() => onChangeText('')}
          accessibilityRole="button"
          accessibilityLabel="Borrar búsqueda"
          hitSlop={4}
          style={({ pressed }) => [
            styles.clear,
            { width: theme.touchTargets.min, height: theme.touchTargets.min, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Icon name="close-circle" size={24} color={c.textMuted} />
        </Pressable>
      ) : (
        <View style={{ width: theme.spacing.sm }} />
      )}
    </View>
  );
}

// ─── Uso mensual ──────────────────────────────────────────────────────────────

export function UsageMeter({ used, included }: { used: number; included: number }) {
  const theme = useAppTheme();
  const c = theme.colors;
  const ratio = included > 0 ? Math.max(0, Math.min(1, used / included)) : 0;
  const exhausted = included > 0 && used >= included;
  return (
    <View
      style={[styles.track, { backgroundColor: c.surfaceMuted, borderRadius: theme.radius.pill }]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${used} de ${included} identificaciones usadas este mes`}
      accessibilityValue={{ min: 0, max: included, now: Math.min(used, included) }}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round(ratio * 100)}%`,
            backgroundColor: exhausted ? c.warning : c.primary,
            borderRadius: theme.radius.pill,
          },
        ]}
      />
    </View>
  );
}

/** Texto de apoyo bajo la barra de uso. */
/**
 * Lo que queda del mes. Con Premium se habla de identificaciones «incluidas» y, al agotarlas,
 * del precio de cada una adicional (pago por uso), para que nunca haya sorpresas en la factura.
 */
export function UsageHint({ left, premium = false, overagePrice }: { left: number; premium?: boolean; overagePrice?: string }) {
  let text: string;
  if (premium) {
    text =
      left <= 0
        ? `Ya has usado las identificaciones incluidas este mes.${overagePrice ? ` Cada identificación adicional cuesta ${overagePrice}.` : ''}`
        : left === 1
          ? 'Te queda 1 identificación incluida este mes.'
          : `Te quedan ${left} identificaciones incluidas este mes.`;
  } else {
    text =
      left <= 0
        ? 'Ya no te quedan identificaciones este mes.'
        : left === 1
          ? 'Te queda 1 identificación este mes.'
          : `Te quedan ${left} identificaciones este mes.`;
  }
  return (
    <AppText variant="caption" color="textSecondary">
      {text}
    </AppText>
  );
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5 },
  searchInput: { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 8 },
  clear: { alignItems: 'center', justifyContent: 'center' },
  track: { height: 10, width: '100%', overflow: 'hidden' },
  fill: { height: '100%' },
});
