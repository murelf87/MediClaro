/**
 * La guía de MediClaro: la mujer mayor amable del tablero del propietario (ilustración 3D).
 * Se usa en toda la app con el mismo aspecto: bienvenida, explicación, Premium, bloqueo de funciones y
 * como avatar del asistente (con la etiqueta «IA», para que siempre se sepa que responde una IA).
 * Es decorativa: los lectores de pantalla la ignoran (la información siempre está en el texto).
 */
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useId } from 'react';
import { AppText } from './AppText';
import { Float } from './Motion';
import { useAppTheme } from '../providers/PreferencesProvider';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const GUIDE_IMAGE = require('../../assets/character/guide.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GUIDE_AVATAR = require('../../assets/character/guide-avatar.png');

/** Ilustración grande (busto saludando) sobre un círculo suave de la paleta. */
export function GuideIllustration({
  size = 220,
  float = true,
  halo = true,
  style,
}: {
  size?: number;
  float?: boolean;
  halo?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const gid = `guideHalo${useId().replace(/[^A-Za-z0-9_-]/g, '')}`;
  const image = <Image source={GUIDE_IMAGE} style={{ width: size, height: size }} resizeMode="contain" />;
  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {halo ? (
        <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id={gid} cx="50%" cy="45%" r="50%">
              <Stop offset="0" stopColor="#DBEAFE" stopOpacity="1" />
              <Stop offset="0.75" stopColor="#E6F0FF" stopOpacity="0.9" />
              <Stop offset="1" stopColor="#EFF6FF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={size * 0.52} cy={size * 0.46} r={size * 0.46} fill={`url(#${gid})`} />
          <Circle cx={size * 0.12} cy={size * 0.2} r={size * 0.018} fill="#60A5FA" opacity={0.55} />
          <Circle cx={size * 0.9} cy={size * 0.3} r={size * 0.024} fill="#F59E0B" opacity={0.5} />
          <Circle cx={size * 0.86} cy={size * 0.12} r={size * 0.012} fill="#2563EB" opacity={0.4} />
        </Svg>
      ) : null}
      {float ? <Float amplitude={Math.max(3, size * 0.02)}>{image}</Float> : image}
    </View>
  );
}

/** Avatar redondo (cabeza y hombros). `ai` añade la etiqueta «IA». */
export function GuideAvatar({ size = 44, ai = false, ring = true }: { size?: number; ai?: boolean; ring?: boolean }) {
  const theme = useAppTheme();
  const c = theme.colors;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: c.primarySoft,
            borderWidth: ring ? Math.max(1.5, size * 0.04) : 0,
            borderColor: c.surface,
          },
        ]}
      >
        <Image source={GUIDE_AVATAR} style={{ width: size, height: size }} resizeMode="cover" />
      </View>
      {ai ? (
        <View style={[styles.aiBadge, { backgroundColor: c.ai, borderColor: c.surface, right: -size * 0.08, bottom: -size * 0.04 }]}>
          <AppText variant="small" style={styles.aiText} maxFontSizeMultiplier={1}>
            IA
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  aiBadge: { position: 'absolute', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 8, borderWidth: 1.5 },
  aiText: { color: '#FFFFFF', fontSize: 10, lineHeight: 13, fontWeight: '800' },
});
