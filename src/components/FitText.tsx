/**
 * Texto que se adapta al ancho de la pantalla, en iPhone, Android y web, sin cortar nunca el texto:
 *  - fit="line" (por defecto): si cabe en una línea se ve a su tamaño; si no, se reduce lo justo para que quepa en
 *    una línea (sin palabras sueltas abajo), nunca por debajo de `minScale`.
 *  - fit="words": puede ocupar varias líneas, pero ninguna palabra se parte por la mitad: se reduce lo justo para que
 *    quepa la palabra más larga.
 * Dentro de un <FitGroup>, todos los textos del grupo usan el mismo tamaño (el del que más necesita reducirse): así
 * una lista de botones se ve ordenada, con la misma letra en todos.
 * Respeta el tamaño de letra elegido por la persona (parte de él).
 */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';
import { AppText, type AppTextProps } from './AppText';
import { useAppTheme } from '../providers/PreferencesProvider';

interface FitGroupValue {
  scale: number;
  report: (id: string, scale: number | null) => void;
}
const FitGroupContext = createContext<FitGroupValue | null>(null);

/** Agrupa varios FitText para que todos se vean al mismo tamaño. */
export function FitGroup({ children, minScale = 0.6 }: { children: ReactNode; minScale?: number }) {
  const [scales, setScales] = useState<Record<string, number>>({});
  const report = useCallback((id: string, scale: number | null) => {
    setScales((prev) => {
      if (scale === null) {
        if (!(id in prev)) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return Math.abs((prev[id] ?? -1) - scale) < 0.005 ? prev : { ...prev, [id]: scale };
    });
  }, []);
  const values = Object.values(scales);
  const scale = values.length ? Math.max(minScale, Math.min(...values)) : 1;
  const value = useMemo(() => ({ scale, report }), [scale, report]);
  return <FitGroupContext.Provider value={value}>{children}</FitGroupContext.Provider>;
}

export function FitText({
  children,
  variant = 'display',
  minScale = 0.6,
  fit = 'line',
  containerStyle,
  style,
  ...rest
}: AppTextProps & { minScale?: number; fit?: 'line' | 'words'; containerStyle?: StyleProp<ViewStyle> }) {
  const theme = useAppTheme();
  const group = useContext(FitGroupContext);
  const id = useId();
  const [available, setAvailable] = useState(0);
  const [natural, setNatural] = useState(0);
  const wordWidths = useRef<Record<number, number>>({});
  const base = theme.typography[variant];
  const size = base.fontSize ?? 17;
  const line = base.lineHeight ?? Math.round(size * 1.2);
  const words = fit === 'words' && typeof children === 'string' ? children.split(/\s+/).filter(Boolean) : null;
  const wordsKey = words ? words.join(' ') : '';
  useEffect(() => {
    wordWidths.current = {};
  }, [wordsKey]);
  // Margen de 2 px por el redondeo de las medidas.
  const own = available > 0 && natural > 0 ? Math.max(minScale, Math.min(1, (available - 2) / natural)) : 1;
  const report = group?.report;
  useEffect(() => {
    if (!report) return undefined;
    report(id, available > 0 && natural > 0 ? own : null);
    return () => report(id, null);
  }, [report, id, own, available, natural]);
  const scale = group ? Math.min(own, Math.max(minScale, group.scale)) : own;

  const onBox = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setAvailable((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
  };
  const onMeasure = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setNatural((prev) => (Math.abs(prev - w) < 0.5 ? prev : w));
  };
  const onWord = (index: number, count: number) => (e: LayoutChangeEvent) => {
    wordWidths.current[index] = e.nativeEvent.layout.width;
    const measured = Object.keys(wordWidths.current).length;
    if (measured >= count) {
      const widest = Math.max(...Object.values(wordWidths.current));
      setNatural((prev) => (Math.abs(prev - widest) < 0.5 ? prev : widest));
    }
  };

  return (
    <View style={containerStyle} onLayout={onBox}>
      {/* Medidor invisible: el texto (o cada palabra) en una sola línea, a tamaño completo y sin límite de ancho. */}
      <View style={styles.clip} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.wide}>
          {words ? (
            words.map((word, i) => (
              <AppText key={`${i}-${word}`} variant={variant} style={[style, styles.measure]} numberOfLines={1} onLayout={onWord(i, words.length)}>
                {word}
              </AppText>
            ))
          ) : (
            <AppText variant={variant} style={[style, styles.measure]} numberOfLines={1} onLayout={onMeasure}>
              {children}
            </AppText>
          )}
        </View>
      </View>
      <AppText
        variant={variant}
        {...rest}
        style={[style, scale < 1 ? { fontSize: Math.floor(size * scale), lineHeight: Math.ceil(line * scale) } : null]}
      >
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { height: 0, overflow: 'hidden' },
  wide: { width: 4000, alignItems: 'flex-start' },
  measure: { alignSelf: 'flex-start' },
});
