/**
 * Icono de «ubicación en directo» del chat de cuidado.
 *  - Persona Premium: toca para elegir cuánto tiempo compartir (15 min, 1 h, 8 h).
 *  - Persona cuidadora: ve el icono cuando se comparte y toca para abrir el mapa.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { AppText, Icon, PrimaryButton, SecondaryButton, TextButton } from './index';
import { useAppTheme } from '../hooks';
import {
  LIVE_DURATIONS, getLiveLocation, liveErrorMessage, resumeSending, startSharing, stopSharing, type LiveLocation,
} from '../services/CareLiveLocationService';
import { placeUrl } from '../utils/maps';
import { showAlert } from '../utils/dialogs';

const POLL_MS = 10_000;
const hhmm = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : '';

export function CareLiveLocation({ linkId, patientSide, premium, name }: {
  linkId: string; patientSide: boolean; premium: boolean; name: string;
}) {
  const theme = useAppTheme();
  const c = theme.colors;
  const [live, setLive] = useState<LiveLocation | null>(null);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const r = await getLiveLocation(linkId);
      if (!alive.current) return;
      setLive(r);
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
    setBusy(true);
    try {
      setLive(await startSharing(linkId, minutes));
      setModal(false);
    } catch (e) {
      const msg = String((e as Error)?.message) === 'LOCATION_DENIED'
        ? 'Permite la ubicación en los ajustes del teléfono.'
        : liveErrorMessage(e);
      void showAlert('Ubicación', msg);
    } finally { if (alive.current) setBusy(false); }
  };
  const stop = async () => {
    setBusy(true);
    try { await stopSharing(linkId); setLive(null); } catch (e) { void showAlert('Ubicación', liveErrorMessage(e)); }
    finally { if (alive.current) setBusy(false); }
  };

  // Icono para persona Premium: compartiendo o listo para compartir
  if (patientSide && premium) {
    return (
      <>
        <Pressable onPress={() => setModal(true)} style={({ pressed }) => [styles.icon, { opacity: pressed ? 0.6 : 1 }]} testID="care-live-icon">
          <Icon name={live?.active ? 'location' : 'location-outline'} size={24} color={live?.active ? c.danger : c.primary} />
          {live?.active ? <View style={[styles.dot, { backgroundColor: c.danger }]} /> : null}
        </Pressable>
        <Modal visible={modal} transparent animationType="fade">
          <Pressable style={styles.backdrop} onPress={() => setModal(false)} />
          <View style={[styles.popover, { backgroundColor: c.surface, borderColor: c.divider }]}>
            <AppText variant="bodyStrong" style={{ marginBottom: theme.spacing.md }}>
              {live?.active ? `Compartiendo hasta las ${hhmm(live.expiresAt)}` : '¿Cuánto tiempo compartir?'}
            </AppText>
            {live?.active ? (
              <PrimaryButton label="Dejar de compartir" icon="close-circle" onPress={() => void stop().then(() => setModal(false))} loading={busy} />
            ) : (
              <>
                {LIVE_DURATIONS.map(d => (
                  <SecondaryButton key={d.minutes} label={d.label} onPress={() => void start(d.minutes)} disabled={busy} />
                ))}
              </>
            )}
            <TextButton label="Cerrar" onPress={() => setModal(false)} />
          </View>
        </Modal>
      </>
    );
  }

  // Icono para cuidadora: ver ubicación si está activa
  if (!patientSide && live?.active) {
    const has = live.latitude != null && live.longitude != null;
    return (
      <Pressable
        onPress={() => has && void Linking.openURL(placeUrl(live.latitude!, live.longitude!)).catch(() => undefined)}
        style={({ pressed }) => [styles.icon, { opacity: pressed && has ? 0.6 : 1 }]}
        disabled={!has}
        testID="care-live-icon"
      >
        <Icon name="map" size={24} color={has ? c.primary : c.textSecondary} />
      </Pressable>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  dot: { width: 10, height: 10, borderRadius: 5, position: 'absolute', bottom: 0, right: 0 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  popover: { position: 'absolute', left: 24, right: 24, top: '30%', padding: 20, borderRadius: 16, borderWidth: 1, gap: 10 },
});
