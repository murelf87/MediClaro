/**
 * Mapa en directo dentro de la app, sin módulos nativos (funciona con una actualización OTA).
 * Pinta los cuadros públicos de OpenStreetMap alrededor del punto y deja el punto siempre en el centro;
 * cuando llega una posición nueva, el mapa se mueve solo. Con + y − se acerca o aleja.
 * Uso de los cuadros: User-Agent propio y atribución visible, como pide la política de OpenStreetMap.
 */
import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Icon } from './index';
import { useAppTheme } from '../hooks';

const TILE = 256;
const MIN_Z = 12;
const MAX_Z = 18;
const HEADERS = { 'User-Agent': 'MediClaro/1.0 (app de medicacion para personas mayores)' };

/** Coordenadas del punto en «cuadros» del nivel de zoom z (formato estándar de mapas web). */
export function tileXY(lat: number, lon: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const rad = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180;
  return {
    x: ((lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n,
  };
}

export function LiveMap({ latitude, longitude, height = 320, name }: {
  latitude: number; longitude: number; height?: number; name: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [z, setZ] = useState(16);
  const [w, setW] = useState(0);
  const { x, y } = tileXY(latitude, longitude, z);
  const px = x * TILE, py = y * TILE;
  const n = 2 ** z;

  const tiles: { key: string; uri: string; left: number; top: number }[] = [];
  if (w > 0) {
    const spanX = Math.ceil(w / TILE / 2) + 1, spanY = Math.ceil(height / TILE / 2) + 1;
    for (let tx = Math.floor(x) - spanX; tx <= Math.floor(x) + spanX; tx++) {
      for (let ty = Math.floor(y) - spanY; ty <= Math.floor(y) + spanY; ty++) {
        if (ty < 0 || ty >= n) continue;
        const wx = ((tx % n) + n) % n;
        tiles.push({
          key: `${z}/${tx}/${ty}`,
          uri: `https://tile.openstreetmap.org/${z}/${wx}/${ty}.png`,
          left: Math.round(tx * TILE - px + w / 2),
          top: Math.round(ty * TILE - py + height / 2),
        });
      }
    }
  }

  const zoomBtn = (icon: 'add' | 'remove', next: number, label: string) => (
    <Pressable
      onPress={() => setZ(Math.max(MIN_Z, Math.min(MAX_Z, next)))}
      accessibilityRole="button" accessibilityLabel={label} hitSlop={4}
      style={({ pressed }) => [styles.zoom, { backgroundColor: pressed ? c.primarySoft : c.surface, borderColor: c.divider }]}
    >
      <Icon name={icon} size={26} color={c.text} />
    </Pressable>
  );

  return (
    <View
      style={[styles.wrap, { height, borderColor: c.divider, backgroundColor: c.surfaceAlt ?? c.surface }]}
      onLayout={e => setW(Math.round(e.nativeEvent.layout.width))}
      accessible accessibilityLabel={`Mapa con la posición de ${name}`}
      testID="live-map"
    >
      {tiles.map(t => (
        <Image key={t.key} source={{ uri: t.uri, headers: HEADERS }} style={[styles.tile, { left: t.left, top: t.top }]} />
      ))}
      {/* El punto: siempre en el centro */}
      <View pointerEvents="none" style={[styles.pin, { left: w / 2 - 22, top: height / 2 - 44 }]}>
        <Icon name="location" size={44} color={c.danger} />
      </View>
      <View pointerEvents="none" style={[styles.pulse, { left: w / 2 - 8, top: height / 2 - 8, backgroundColor: c.danger }]} />
      <View style={styles.zooms}>
        {zoomBtn('add', z + 1, 'Acercar')}
        {zoomBtn('remove', z - 1, 'Alejar')}
      </View>
      <View style={[styles.credit, { backgroundColor: c.surface }]}>
        <AppText variant="small" color="textSecondary">© OpenStreetMap</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', overflow: 'hidden', borderRadius: 16, borderWidth: 1 },
  tile: { position: 'absolute', width: TILE, height: TILE },
  pin: { position: 'absolute', width: 44, height: 44, alignItems: 'center' },
  pulse: { position: 'absolute', width: 16, height: 16, borderRadius: 8, opacity: 0.35 },
  zooms: { position: 'absolute', right: 10, top: 10, gap: 8 },
  zoom: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  credit: { position: 'absolute', left: 0, bottom: 0, paddingHorizontal: 6, paddingVertical: 2, borderTopRightRadius: 8, opacity: 0.85 },
});
