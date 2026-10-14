/**
 * Franja de «ubicación en directo» del chat de cuidado.
 *  - Persona Premium: elige cuánto tiempo compartir (15 min, 1 h, 8 h) y tiene siempre un botón grande para parar.
 *  - Persona cuidadora: ve cuándo se comparte y abre el mapa con la última posición.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { AppText, Icon, PrimaryButton, SecondaryButton, TextButton } from './index';
import { useAppTheme } from '../hooks';
import {
  LIVE_DURATIONS, getLiveLocation, liveErrorMessage, resumeSending, startSharing, stopSharing, type LiveLocation,
} from '../services/CareLiveLocationService';
import { placeUrl } from '../utils/maps';

const POLL_MS = 10_000;
const hhmm = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';

export function CareLiveLocation({ linkId, patientSide, premium, name }: {
  linkId: string; patientSide: boolean; premium: boolean; name: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [live, setLive] = useState<LiveLocation | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const r = await getLiveLocation(linkId);
      if (!alive.current) return;
      setLive(r);
      // Si ya estaba compartiendo (p. ej. reabrió la app), se reanuda el envío.
      if (patientSide && r.active && r.mine) void resumeSending(linkId).catch(() => undefined);
    } catch {
      /* sin conexión: se conserva lo último que se vio */
    }
  }, [linkId, patientSide]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const t = setInterval(() => void refresh(), POLL_MS);
    return () => { alive.current = false; clearInterval(t); };
  }, [refresh]);

  const start = async (minutes: number) => {
    setBusy(true); setError(null);
    try {
      setLive(await startSharing(linkId, minutes));
      setChoosing(false);
    } catch (e) {
      setError(String((e as Error)?.message) === 'LOCATION_DENIED'
        ? 'Permite la ubicación de MediClaro en los ajustes del teléfono para poder compartirla.'
        : liveErrorMessage(e));
    } finally { if (alive.current) setBusy(false); }
  };
  const stop = async () => {
    setBusy(true); setError(null);
    try { await stopSharing(linkId); setLive(null); } catch (e) { setError(liveErrorMessage(e)); }
    finally { if (alive.current) setBusy(false); }
  };

  const box = { borderColor: c.divider, backgroundColor: c.surface, padding: theme.spacing.md, gap: theme.spacing.sm };

  if (live?.active && patientSide) {
    return (
      <View style={[styles.box, box]} testID="care-live-mine">
        <View style={styles.row}>
          <Icon name="location" size={22} color={c.primary} />
          <AppText variant="bodyStrong" style={styles.flex}>Compartiendo tu ubicación hasta las {hhmm(live.expiresAt)}</AppText>
        </View>
        <PrimaryButton label="Dejar de compartir" icon="close-circle" onPress={() => void stop()} loading={busy} testID="care-live-stop" />
        {error ? <AppText variant="small" color="textSecondary">{error}</AppText> : null}
      </View>
    );
  }
  if (live?.active) {
    const has = live.latitude != null && live.longitude != null;
    return (
      <View style={[styles.box, box]} testID="care-live-theirs">
        <View style={styles.row}>
          <Icon name="location" size={22} color={c.primary} />
          <AppText variant="bodyStrong" style={styles.flex}>{name} comparte su ubicación hasta las {hhmm(live.expiresAt)}</AppText>
        </View>
        {has ? (
          <SecondaryButton label="Ver dónde está ahora" icon="map-outline"
            onPress={() => void Linking.openURL(placeUrl(live.latitude!, live.longitude!)).catch(() => setError('No se ha podido abrir el mapa.'))}
            testID="care-live-open" />
        ) : <AppText variant="small" color="textSecondary">Esperando la primera posición…</AppText>}
        {has && live.updatedAt ? <AppText variant="small" color="textSecondary">Última actualización a las {hhmm(live.updatedAt)}</AppText> : null}
        {error ? <AppText variant="small" color="textSecondary">{error}</AppText> : null}
      </View>
    );
  }
  if (!patientSide || !premium) return null;
  return (
    <View style={[styles.box, box]} testID="care-live-start">
      {choosing ? (
        <>
          <AppText variant="bodyStrong">¿Cuánto tiempo quieres compartirla?</AppText>
          {LIVE_DURATIONS.map(d => (
            <SecondaryButton key={d.minutes} label={d.label} onPress={() => void start(d.minutes)} disabled={busy} testID={`care-live-${d.minutes}`} />
          ))}
          <TextButton label="Cancelar" onPress={() => setChoosing(false)} />
        </>
      ) : (
        <SecondaryButton label="Compartir mi ubicación en directo" icon="location-outline" onPress={() => setChoosing(true)} testID="care-live-choose" />
      )}
      {error ? <AppText variant="small" color="textSecondary">{error}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: 16, marginHorizontal: 12, marginTop: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
});
