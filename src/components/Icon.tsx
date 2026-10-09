/**
 * Icono de la app (Ionicons). Centraliza el set para poder sustituirlo.
 */
import type { ComponentProps } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppTheme } from '../providers/PreferencesProvider';
import type { ColorScheme } from '../theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export interface IconProps {
  name: IconName;
  size?: number;
  /** Token de color del tema o color literal. */
  color?: keyof ColorScheme | string;
  accessibilityLabel?: string;
}

export function Icon({ name, size, color = 'text', accessibilityLabel }: IconProps) {
  const theme = useAppTheme();
  const resolved = (theme.colors as unknown as Record<string, string>)[color] ?? color;
  return (
    <Ionicons
      name={name}
      style={{ flexShrink: 0 }}
      size={size ?? theme.iconSize}
      color={resolved}
      accessibilityLabel={accessibilityLabel}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    />
  );
}
