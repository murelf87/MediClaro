/**
 * Controles de formulario grandes y legibles.
 *  - TextField: campo con etiqueta, ayuda y error.
 *  - SegmentedControl: selector de 2–4 opciones (velocidad de voz, filtros...).
 *  - OtpInput: código SMS de 6 cifras (autocompletado del sistema).
 *  - PhoneInput: prefijo de país + número (España +34 por defecto).
 */
import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  Platform,
  type TextInputProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { useAppTheme } from '../providers/PreferencesProvider';
import { MAX_FONT_SIZE_MULTIPLIER } from '../theme';
import { PHONE_COUNTRIES, type PhoneCountry } from '../config/countries';
import { groupDigits, onlyDigits } from '../utils/format';

// ─── TextField ────────────────────────────────────────────────────────────────

export interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  hint?: string;
  error?: string | null;
  leftIcon?: IconName;
  right?: ReactNode;
  optional?: boolean;
}

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, leftIcon, right, optional, multiline, ...rest },
  ref,
) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="label" color="heading">
        {label}
        {optional ? <AppText variant="caption" color="textMuted">{'  (opcional)'}</AppText> : null}
      </AppText>
      <View
        style={[
          styles.field,
          {
            minHeight: multiline ? 96 : theme.touchTargets.comfortable,
            borderRadius: theme.radius.md,
            borderColor: error ? c.danger : focused ? c.primary : c.borderStrong,
            borderWidth: focused || error ? 2 : 1.5,
            backgroundColor: c.surface,
            alignItems: multiline ? 'flex-start' : 'center',
          },
        ]}
      >
        {leftIcon ? <Icon name={leftIcon} size={22} color="textMuted" /> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={c.textMuted}
          maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
          accessibilityLabel={label}
          accessibilityHint={hint}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[
            styles.input,
            theme.typography.body,
            { color: c.text, paddingVertical: multiline ? 12 : 8 },
            Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
          ]}
        />
        {right}
      </View>
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Icon name="alert-circle" size={18} color="danger" />
          <AppText variant="caption" color="dangerText" style={{ flex: 1 }}>
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <AppText variant="caption" color="textSecondary">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
});

// ─── SegmentedControl ─────────────────────────────────────────────────────────

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: {
  options: { value: T; label: string; sublabel?: string }[];
  value: T;
  onChange: (v: T) => void;
  accessibilityLabel?: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <View
      style={[styles.segment, { backgroundColor: c.surfaceMuted, borderRadius: theme.radius.md }]}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active, checked: active }}
            accessibilityLabel={o.sublabel ? `${o.label}, ${o.sublabel}` : o.label}
            style={({ pressed }) => [
              styles.segmentItem,
              {
                minHeight: theme.touchTargets.min,
                borderRadius: theme.radius.sm,
                backgroundColor: active ? c.surface : pressed ? c.border : 'transparent',
              },
              active ? theme.shadow.card : null,
            ]}
          >
            <AppText variant="captionStrong" align="center" style={{ color: active ? c.primary : c.textSecondary }}>
              {o.label}
            </AppText>
            {o.sublabel ? (
              <AppText variant="small" align="center" style={{ color: active ? c.primary : c.textMuted }}>
                {o.sublabel}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── OtpInput ─────────────────────────────────────────────────────────────────

export interface OtpInputHandle {
  focus: () => void;
  blur: () => void;
}

export const OtpInput = forwardRef<OtpInputHandle, {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** 'pin': código privado (se ve ●, sin autocompletar el SMS). Por defecto, código recibido por SMS. */
  kind?: 'sms' | 'pin';
  accessibilityLabel?: string;
  testID?: string;
}>(function OtpInput({ value, onChange, length = 6, error, disabled, autoFocus = true, kind = 'sms', accessibilityLabel, testID }, ref) {
  const theme = useAppTheme();
  const c = theme.colors;
  const inputRef = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  const digits = value.split('');
  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    blur: () => inputRef.current?.blur(),
  }));
  const boxSize = theme.fontSize === 'muy_grande' ? 52 : 48;

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="none"
      style={[styles.otpRow, disabled ? { opacity: 0.5 } : null]}
      disabled={disabled}
    >
      {Array.from({ length }).map((_, i) => {
        const isActive = focused && (i === value.length || (i === length - 1 && value.length === length));
        return (
          <View
            key={i}
            style={[
              styles.otpBox,
              {
                width: boxSize,
                height: boxSize + 12,
                borderRadius: theme.radius.sm,
                borderColor: error ? c.danger : isActive ? c.primary : c.borderStrong,
                borderWidth: isActive || error ? 2 : 1.5,
                backgroundColor: digits[i] ? c.primaryTint : c.surface,
              },
            ]}
          >
            <AppText variant="title" style={{ color: c.heading }} allowFontScaling={false}>
              {digits[i] ? (kind === 'pin' ? '●' : digits[i]) : ''}
            </AppText>
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(onlyDigits(t).slice(0, length))}
        keyboardType="number-pad"
        textContentType={kind === 'pin' ? 'none' : 'oneTimeCode'}
        autoComplete={kind === 'pin' ? 'off' : Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
        secureTextEntry={kind === 'pin'}
        maxLength={length}
        autoFocus={autoFocus}
        editable={!disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={accessibilityLabel ?? `Código de ${length} cifras`}
        accessibilityHint={kind === 'pin' ? `Escribe las ${length} cifras de tu código` : 'Escribe el código que te hemos enviado por SMS'}
        testID={testID}
        caretHidden
        style={styles.otpHidden}
      />
    </Pressable>
  );
});

// ─── PhoneInput ───────────────────────────────────────────────────────────────

export function PhoneInput({
  country,
  onCountryChange,
  value,
  onChange,
  error,
  onSubmit,
  disabled,
}: {
  country: PhoneCountry;
  onCountryChange: (c: PhoneCountry) => void;
  value: string;
  onChange: (digits: string) => void;
  error?: string | null;
  onSubmit?: () => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <View style={styles.phoneRow}>
        <Pressable
          onPress={() => setPickerOpen(true)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`Prefijo ${country.name} ${country.dialCode}. Cambiar país`}
          style={({ pressed }) => [
            styles.countryBtn,
            {
              minHeight: theme.touchTargets.large,
              borderRadius: theme.radius.md,
              borderColor: c.borderStrong,
              backgroundColor: pressed ? c.surfaceAlt : c.surface,
            },
          ]}
        >
          <AppText style={{ fontSize: 22 }} allowFontScaling={false}>
            {country.flag}
          </AppText>
          <AppText variant="bodyStrong" color="heading">
            {country.dialCode}
          </AppText>
          <Icon name="chevron-down" size={18} color="textMuted" />
        </Pressable>
        <View
          style={[
            styles.phoneField,
            {
              minHeight: theme.touchTargets.large,
              borderRadius: theme.radius.md,
              borderColor: error ? c.danger : focused ? c.primary : c.borderStrong,
              borderWidth: focused || error ? 2 : 1.5,
            },
          ]}
        >
          <TextInput
            value={groupDigits(value, country.groups)}
            onChangeText={(t) => onChange(onlyDigits(t).slice(0, country.maxDigits + 4))}
            placeholder={country.iso === 'ES' ? '600 123 456' : groupDigits('0'.repeat(country.minDigits), country.groups)}
            placeholderTextColor={c.textMuted}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            autoComplete="tel"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            editable={!disabled}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
            accessibilityLabel="Número de móvil"
            style={[
              styles.input,
              theme.typography.heading,
              { color: c.text, letterSpacing: 1 },
              Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null,
            ]}
          />
        </View>
      </View>
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Icon name="alert-circle" size={18} color="danger" />
          <AppText variant="caption" color="dangerText" style={{ flex: 1 }}>
            {error}
          </AppText>
        </View>
      ) : null}

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: c.overlay }]}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: c.surface, paddingBottom: insets.bottom + 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
            ]}
          >
            <View style={styles.modalHeader}>
              <AppText variant="heading">Elige tu país</AppText>
              <Pressable
                onPress={() => setPickerOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
                style={{ minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
              >
                <Icon name="close" size={28} color="heading" />
              </Pressable>
            </View>
            <FlatList
              data={PHONE_COUNTRIES}
              keyExtractor={(i) => i.iso}
              renderItem={({ item }) => {
                const selected = item.iso === country.iso;
                return (
                  <Pressable
                    onPress={() => {
                      onCountryChange(item);
                      setPickerOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name} ${item.dialCode}`}
                    accessibilityState={{ selected }}
                    style={({ pressed }) => [
                      styles.countryRow,
                      { minHeight: theme.touchTargets.comfortable, backgroundColor: selected ? c.primaryTint : pressed ? c.surfaceAlt : 'transparent' },
                    ]}
                  >
                    <AppText style={{ fontSize: 24 }} allowFontScaling={false}>
                      {item.flag}
                    </AppText>
                    <AppText variant="body" style={{ flex: 1 }}>
                      {item.name}
                    </AppText>
                    <AppText variant="bodyStrong" color="textSecondary">
                      {item.dialCode}
                    </AppText>
                    {selected ? <Icon name="checkmark" size={22} color="primary" /> : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, minHeight: 44 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segment: { flexDirection: 'row', padding: 4, gap: 4 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 6 },
  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  otpBox: { alignItems: 'center', justifyContent: 'center' },
  otpHidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  phoneRow: { flexDirection: 'row', gap: 10 },
  countryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, paddingHorizontal: 12 },
  phoneField: { flex: 1, justifyContent: 'center', paddingHorizontal: 14 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end' },
  modalSheet: { maxHeight: '80%', paddingTop: 8 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 8 },
  countryRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20 },
});
