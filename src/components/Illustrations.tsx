/**
 * Ilustraciones vectoriales de MediClaro (onboarding, estados, envases).
 * Sin imágenes externas: nítidas en cualquier pantalla.
 */
import { useId } from 'react';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';

function useSvgId(prefix: string): string {
  return `${prefix}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

/** Caja de medicamento genérica (sustituto elegante cuando no hay foto oficial). */
export function MedicineBoxArt({ width = 120, height = 90 }: { width?: number; height?: number }) {
  const faceId = useSvgId('boxFace');
  return (
    <Svg width={width} height={height} viewBox="0 0 120 90" accessibilityLabel="Envase de medicamento">
      <Defs>
        <LinearGradient id={faceId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#EEF3FA" />
        </LinearGradient>
      </Defs>
      {/* sombra */}
      <Path d="M18 78 L100 78 L108 84 L26 84 Z" fill="#DDE5F0" />
      {/* lateral */}
      <Path d="M92 22 L104 14 L104 70 L92 78 Z" fill="#D6E2F2" />
      {/* tapa */}
      <Path d="M14 22 L26 14 L104 14 L92 22 Z" fill="#F4F7FC" />
      {/* frontal */}
      <Rect x="14" y="22" width="78" height="56" rx="3" fill={`url(#${faceId})`} stroke="#D9E3F0" strokeWidth="1" />
      <Rect x="14" y="22" width="12" height="56" fill="#2563EB" />
      <Rect x="34" y="32" width="44" height="7" rx="3" fill="#16307E" />
      <Rect x="34" y="44" width="30" height="5" rx="2.5" fill="#8FB5EE" />
      <Rect x="34" y="54" width="36" height="4" rx="2" fill="#C9D6E8" />
      <Path d="M58 78 L92 78 L92 60 Q75 72 58 78 Z" fill="#2563EB" opacity="0.9" />
    </Svg>
  );
}

/** Onboarding 1 — fotografiar la caja. */
export function PhotoIllustration({ size = 240 }: { size?: number }) {
  const bgId = useSvgId('ob1bg');
  const leafId = useSvgId('ob1leaf');
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" accessibilityLabel="Un teléfono fotografía la caja de un medicamento">
      <Defs>
        <LinearGradient id={bgId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#E9F2FE" />
          <Stop offset="1" stopColor="#EAF8F0" />
        </LinearGradient>
        <LinearGradient id={leafId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#3DBD74" />
          <Stop offset="1" stopColor="#1C9B57" />
        </LinearGradient>
      </Defs>
      <Circle cx="120" cy="120" r="112" fill={`url(#${bgId})`} />
      {/* hojas */}
      <Path d="M34 150 C 30 110, 52 86, 78 80 C 76 110, 64 136, 34 150 Z" fill={`url(#${leafId})`} opacity="0.9" />
      <Path d="M40 176 C 44 150, 64 138, 86 138 C 80 160, 66 174, 40 176 Z" fill="#45C47C" opacity="0.8" />
      <Path d="M206 96 C 212 70, 196 52, 176 46 C 172 70, 180 88, 206 96 Z" fill="#45C47C" opacity="0.75" />
      {/* teléfono */}
      <G transform="rotate(-8 128 124)">
        <Rect x="78" y="40" width="100" height="176" rx="18" fill="#16307E" />
        <Rect x="84" y="50" width="88" height="156" rx="12" fill="#FFFFFF" />
        <Rect x="112" y="44" width="32" height="6" rx="3" fill="#0F2463" />
        {/* caja en pantalla */}
        <Rect x="92" y="92" width="72" height="54" rx="4" fill="#F4F8FE" stroke="#D5E1F2" />
        <Rect x="92" y="92" width="10" height="54" fill="#2563EB" />
        <Rect x="108" y="102" width="44" height="7" rx="3" fill="#16307E" />
        <Rect x="108" y="116" width="20" height="8" rx="3" fill="#2563EB" />
        <Rect x="108" y="130" width="34" height="4" rx="2" fill="#9DBBEA" />
        {/* recuadro de enfoque */}
        <Path d="M90 82 L90 74 L100 74 M156 74 L166 74 L166 82 M166 156 L166 164 L156 164 M100 164 L90 164 L90 156" stroke="#2563EB" strokeWidth="3" fill="none" strokeLinecap="round" />
        {/* botón */}
        <Circle cx="128" cy="186" r="10" fill="#2563EB" />
        <Circle cx="128" cy="186" r="6" fill="#FFFFFF" />
      </G>
      {/* insignia de verificación */}
      <Circle cx="186" cy="64" r="22" fill="#1FA45C" />
      <Path d="M176 64 L183 71 L197 57" stroke="#FFFFFF" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Onboarding 2 — información clara y oficial. */
export function InfoIllustration({ size = 240 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" accessibilityLabel="Ficha clara de un medicamento con información oficial">
      <Circle cx="120" cy="120" r="112" fill="#EAF8F0" />
      <Rect x="58" y="44" width="124" height="156" rx="16" fill="#FFFFFF" stroke="#D8E6DE" strokeWidth="2" />
      <Rect x="76" y="66" width="70" height="10" rx="5" fill="#16307E" />
      <Circle cx="84" cy="100" r="8" fill="#1FA45C" />
      <Rect x="98" y="95" width="64" height="8" rx="4" fill="#9DB8A9" />
      <Circle cx="84" cy="128" r="8" fill="#2563EB" />
      <Rect x="98" y="123" width="56" height="8" rx="4" fill="#A7BFE6" />
      <Circle cx="84" cy="156" r="8" fill="#EF4444" />
      <Rect x="98" y="151" width="60" height="8" rx="4" fill="#E9B5B3" />
      <Circle cx="176" cy="178" r="26" fill="#1FA45C" />
      <Path d="M164 178 L173 187 L190 169" stroke="#FFFFFF" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/** Onboarding 3 — asistente IA. */
export function AssistantIllustration({ size = 240 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" accessibilityLabel="Conversación con el asistente de MediClaro">
      <Circle cx="120" cy="120" r="112" fill="#F2EEFD" />
      <Path d="M46 70 Q46 56 60 56 L150 56 Q164 56 164 70 L164 112 Q164 126 150 126 L86 126 L66 144 L68 126 L60 126 Q46 126 46 112 Z" fill="#6A45E0" />
      <Circle cx="80" cy="91" r="7" fill="#FFFFFF" />
      <Circle cx="105" cy="91" r="7" fill="#FFFFFF" />
      <Circle cx="130" cy="91" r="7" fill="#FFFFFF" />
      <Path d="M194 132 Q194 120 182 120 L98 120 Q86 120 86 132 L86 170 Q86 182 98 182 L160 182 L178 198 L176 182 L182 182 Q194 182 194 170 Z" fill="#FFFFFF" stroke="#D9CFF8" strokeWidth="2" />
      <Rect x="102" y="138" width="74" height="8" rx="4" fill="#B9A8F2" />
      <Rect x="102" y="154" width="52" height="8" rx="4" fill="#D6CCF9" />
    </Svg>
  );
}

/** Onboarding 4 — ayuda en una urgencia (112 siempre disponible). */
export function EmergencyIllustration({ size = 240 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" accessibilityLabel="Botón de urgencia con el 112 siempre disponible">
      <Circle cx="120" cy="120" r="112" fill="#FFEDEC" />
      <Circle cx="120" cy="112" r="62" fill="#EF4444" />
      <Path
        d="M100 88 C 104 84, 110 86, 112 92 L 116 102 C 118 108, 114 112, 110 114 C 114 124, 120 130, 130 134 C 132 130, 136 126, 142 128 L 152 132 C 158 134, 160 140, 156 144 L 150 150 C 146 154, 138 156, 130 152 C 112 144, 100 132, 94 114 C 90 106, 92 96, 100 88 Z"
        fill="#FFFFFF"
      />
      <Rect x="84" y="186" width="72" height="30" rx="15" fill="#FFFFFF" stroke="#F3B9B6" strokeWidth="2" />
      <SvgText x="120" y="207" fontSize="18" fontWeight="bold" fontFamily="sans-serif" fill="#C9241F" textAnchor="middle">112</SvgText>
    </Svg>
  );
}
