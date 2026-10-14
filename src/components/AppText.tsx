/**
 * Texto de la app: tipografía escalada según la preferencia del usuario.
 */
import { Text, type TextProps, type TextStyle, type StyleProp } from 'react-native';
import { useAppTheme } from '../providers/PreferencesProvider';
import { MAX_FONT_SIZE_MULTIPLIER, type ColorScheme, type TypographyVariant } from '../theme';

export type TextColor = keyof ColorScheme;

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: TextColor;
  align?: TextStyle['textAlign'];
  weight?: TextStyle['fontWeight'];
  style?: StyleProp<TextStyle>;
}

export function AppText({ variant = 'body', color, align, weight, style, children, ...rest }: AppTextProps) {
  const theme = useAppTheme();
  const defaultColor: TextColor =
    variant === 'display' || variant === 'title' || variant === 'heading' || variant === 'price' ? 'heading' : 'text';
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}
      {...rest}
      style={[
        theme.typography[variant],
        { color: theme.colors[color ?? defaultColor] },
        align ? { textAlign: align } : null,
        weight ? { fontWeight: weight } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}
