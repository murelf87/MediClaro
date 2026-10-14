/**
 * Una llamada de voz por internet con el cuidador/a (o con el familiar al que se cuida), como en WhatsApp:
 *  - saliente: «Llamando…» con el tono de llamada → «Conectando…» → en llamada con contador → colgar;
 *  - entrante: suena y vibra → Aceptar o Rechazar;
 *  - al terminar: «Llamada finalizada · 02:15», «No contesta», «Llamada perdida»… (y queda registrada en el chat).
 *
 * El audio va de móvil a móvil con WebRTC (react-native-webrtc, cifrado); la señalización, por CareCallService.
 * En el Modo demostración y en la vista previa web no hay audio por internet: la llamada es «de prueba» (mismas
 * pantallas y estados, sin voz). Con la app en segundo plano, iOS y Android cortan el audio: la llamada se termina.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, Vibration } from 'react-native';
import * as Crypto from 'expo-crypto';
import { createAudioPlayer, type AudioPlayer, type AudioSource } from 'expo-audio';
import { CareCallService, type CareCall } from '../services/CareCallService';
import { DemoMode } from '../services/DemoMode';
import { AppError, toAppError } from '../api/errors';
import { IS_EXPO_GO } from '../utils/runtime';
import { configureAudioForSpeech } from '../utils/audio';
import { endReasonFrom, type CallEndReason, type CallPhase } from '../utils/callState';

/* eslint-disable @typescript-eslint/no-require-imports */
const RING = require('../../assets/sounds/mediclaro_llamada.wav');
const RINGBACK = require('../../assets/sounds/mediclaro_tono_llamada.wav');
/* eslint-enable @typescript-eslint/no-require-imports */

export { callClock, endReasonFrom, endTitle, type CallEndReason, type CallPhase } from '../utils/callState';

type Peer = {
  close(): void;
  connectionState?: string;
  iceGatheringState?: string;
  localDescription?: { sdp?: string } | null;
  remoteDescription?: unknown;
  onconnectionstatechange: (() => void) | null;
  onicegatheringstatechange: (() => void) | null;
  addTrack(track: unknown, stream: unknown): void;
  createOffer(opts: object): Promise<unknown>;
  createAnswer(): Promise<unknown>;
  setLocalDescription(d: unknown): Promise<void>;
  setRemoteDescription(d: unknown): Promise<void>;
};
type Media = { getTracks(): Array<{ stop(): void; enabled: boolean; kind?: string }> };

export function useCareCall(opts: { linkId: string | null; callId?: string | null; incoming?: boolean; otherName?: string }) {
  const simulated = DemoMode.isActive() || Platform.OS === 'web';
  const [phase, setPhaseState] = useState<CallPhase>(opts.incoming ? 'incoming' : 'starting');
  const [call, setCall] = useState<CareCall | null>(null);
  const [reason, setReason] = useState<CallEndReason | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [connectedAt, setConnectedAt] = useState<number | null>(null);
  const [endedSeconds, setEndedSeconds] = useState<number | null>(null);
  const [, setTick] = useState(0);

  const phaseRef = useRef<CallPhase>(phase);
  const callIdRef = useRef<string | null>(opts.callId ?? null);
  const offered = useRef(false);
  const mine = useRef<'hangup' | 'decline' | null>(null);
  const alive = useRef(true);
  const peer = useRef<Peer | null>(null);
  const stream = useRef<Media | null>(null);
  const tone = useRef<AudioPlayer | null>(null);
  const connectedAtRef = useRef<number | null>(null);
  const disconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPhase = useCallback((p: CallPhase) => {
    phaseRef.current = p;
    if (alive.current) setPhaseState(p);
  }, []);

  // ── Tonos ──
  const stopTone = useCallback(() => {
    try {
      tone.current?.remove();
    } catch {
      // ya liberado
    }
    tone.current = null;
    Vibration.cancel();
  }, []);
  const playTone = useCallback((source: AudioSource, vibrate = false) => {
    stopTone();
    try {
      const p = createAudioPlayer(source);
      p.loop = true;
      p.play();
      tone.current = p;
    } catch {
      // sin sonido: la pantalla sigue diciendo qué pasa
    }
    if (vibrate) Vibration.vibrate([0, 900, 700], true);
  }, [stopTone]);

  // ── Audio por internet ──
  const release = useCallback(() => {
    if (disconnectTimer.current) clearTimeout(disconnectTimer.current);
    disconnectTimer.current = null;
    try {
      peer.current?.close();
    } catch {
      // ya cerrada
    }
    peer.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }, []);

  const markConnected = useCallback(() => {
    stopTone();
    if (!connectedAtRef.current) connectedAtRef.current = Date.now();
    if (alive.current) setConnectedAt(connectedAtRef.current);
    setPhase('connected');
  }, [setPhase, stopTone]);

  const finish = useCallback((why: CallEndReason, text?: string) => {
    if (phaseRef.current === 'ended') return;
    stopTone();
    release();
    if (alive.current) {
      setReason(why);
      setMessage(text ?? null);
      setEndedSeconds(connectedAtRef.current ? Math.round((Date.now() - connectedAtRef.current) / 1000) : null);
    }
    setPhase('ended');
    void configureAudioForSpeech();
  }, [release, setPhase, stopTone]);

  /** Algo falló a mitad: se avisa al servidor (queda «no se pudo conectar») y se termina. */
  const fail = useCallback((text?: string) => {
    const id = callIdRef.current;
    if (id && offered.current) void CareCallService.fail(id).catch(() => undefined);
    finish('failed', text);
  }, [finish]);

  const prepare = useCallback(async (linkId: string) => {
    if (IS_EXPO_GO) {
      throw new AppError('not_available', 'Las llamadas de voz funcionan en la app MediClaro instalada. En Expo Go no están disponibles; el chat sí.');
    }
    const config = await CareCallService.rtcConfig(linkId);
    // El audio de la llamada lo gestiona WebRTC (como en la llamada de los avisos de emergencia).
    const rtc = await import('react-native-webrtc');
    let media: Media;
    try {
      media = (await rtc.mediaDevices.getUserMedia({ audio: true, video: false })) as unknown as Media;
    } catch {
      throw new AppError('permission_denied', 'Permite el micrófono de MediClaro en los ajustes del teléfono para poder hablar.');
    }
    if (!alive.current) {
      media.getTracks().forEach((t) => t.stop());
      throw new AppError('cancelled');
    }
    stream.current = media;
    const pc = new rtc.RTCPeerConnection(config) as unknown as Peer;
    peer.current = pc;
    media.getTracks().forEach((t) => pc.addTrack(t, media));
    pc.onconnectionstatechange = () => {
      if (peer.current !== pc) return;
      const st = pc.connectionState;
      if (st === 'connected') {
        if (disconnectTimer.current) clearTimeout(disconnectTimer.current);
        disconnectTimer.current = null;
        markConnected();
      } else if (st === 'failed') {
        fail('Se ha perdido la conexión de la llamada.');
      } else if (st === 'disconnected') {
        // Un corte breve (cambio de WiFi a datos) se recupera solo; si dura, se cuelga.
        if (disconnectTimer.current) clearTimeout(disconnectTimer.current);
        disconnectTimer.current = setTimeout(() => {
          if (peer.current === pc && pc.connectionState !== 'connected') fail('Se ha perdido la conexión de la llamada.');
        }, 8000);
      }
    };
    return { rtc, pc };
  }, [fail, markConnected]);

  const gather = (pc: Peer) =>
    new Promise<void>((resolve, reject) => {
      if (pc.iceGatheringState === 'complete') return resolve();
      const timeout = setTimeout(() => {
        pc.onicegatheringstatechange = null;
        reject(new AppError('timeout', 'No se ha podido preparar la conexión de la llamada.'));
      }, 15_000);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          pc.onicegatheringstatechange = null;
          resolve();
        }
      };
    });

  const reasonFromError = (e: AppError): CallEndReason =>
    e.code === 'CALL_BUSY' ? 'busy' : e.kind === 'not_configured' || e.kind === 'limit_reached' || e.kind === 'not_available' ? 'unavailable' : 'failed';

  /** Llamar (o volver a llamar). */
  const start = useCallback(async () => {
    const linkId = opts.linkId;
    if (!linkId) return;
    release();
    stopTone();
    offered.current = false;
    mine.current = null;
    connectedAtRef.current = null;
    if (alive.current) {
      setReason(null);
      setMessage(null);
      setMuted(false);
      setConnectedAt(null);
      setEndedSeconds(null);
      setCall(null);
    }
    setPhase('starting');
    const id = Crypto.randomUUID();
    callIdRef.current = id;
    try {
      let sdp = 'v=0\r\n';
      if (!simulated) {
        const { pc } = await prepare(linkId);
        await pc.setLocalDescription(await pc.createOffer({}));
        await gather(pc);
        sdp = pc.localDescription?.sdp ?? '';
      }
      if (!alive.current || phaseRef.current !== 'starting') return;
      const c = await CareCallService.offer(linkId, id, sdp);
      offered.current = true;
      if (!alive.current) return;
      setCall(c);
      if (phaseRef.current !== 'starting') return;
      setPhase('calling');
      playTone(RINGBACK);
    } catch (e) {
      const err = toAppError(e);
      if (err.kind === 'cancelled') return;
      if (offered.current) void CareCallService.fail(id).catch(() => undefined);
      finish(reasonFromError(err), err.message);
    }
  }, [opts.linkId, simulated, prepare, playTone, release, setPhase, stopTone, finish]);

  /** La otra persona ha contestado: se conecta el audio. */
  const onAnswered = useCallback(async (c: CareCall) => {
    stopTone();
    if (simulated) {
      markConnected();
      return;
    }
    setPhase('connecting');
    try {
      const pc = peer.current;
      if (!pc || !c.answer) throw new AppError('unknown');
      if (!pc.remoteDescription) {
        const rtc = await import('react-native-webrtc');
        await pc.setRemoteDescription(new rtc.RTCSessionDescription({ type: 'answer', sdp: c.answer }));
      }
      setTimeout(() => {
        if (phaseRef.current === 'connecting') fail('No se ha podido conectar el audio.');
      }, 20_000);
    } catch {
      fail('No se ha podido conectar el audio.');
    }
  }, [simulated, stopTone, setPhase, markConnected, fail]);

  /** Contestar una llamada entrante. */
  const accept = useCallback(async () => {
    const id = callIdRef.current;
    if (!id || phaseRef.current !== 'incoming') return;
    stopTone();
    setPhase('connecting');
    offered.current = true;
    try {
      const c = call && call.id === id ? call : await CareCallService.snapshot(id);
      if (c.state !== 'ringing') {
        finish(endReasonFrom(c, null));
        return;
      }
      let sdp = 'v=0\r\n';
      if (!simulated) {
        if (!c.offer) throw new AppError('unknown', 'No se ha podido contestar la llamada.');
        const { rtc, pc } = await prepare(c.linkId);
        await pc.setRemoteDescription(new rtc.RTCSessionDescription({ type: 'offer', sdp: c.offer }));
        await pc.setLocalDescription(await pc.createAnswer());
        await gather(pc);
        sdp = pc.localDescription?.sdp ?? '';
      }
      const answered = await CareCallService.answer(id, sdp);
      if (!alive.current) return;
      setCall(answered);
      if (simulated) markConnected();
      else
        setTimeout(() => {
          if (phaseRef.current === 'connecting') fail('No se ha podido conectar el audio.');
        }, 20_000);
    } catch (e) {
      const err = toAppError(e);
      if (err.kind === 'cancelled') return;
      if (err.code === 'CALL_ENDED') finish('missed');
      else fail(err.message);
    }
  }, [call, simulated, prepare, stopTone, setPhase, finish, fail, markConnected]);

  /** Rechazar una llamada entrante. */
  const decline = useCallback(() => {
    const id = callIdRef.current;
    mine.current = 'decline';
    if (id) void CareCallService.decline(id).catch(() => undefined);
    finish('declined_by_me');
  }, [finish]);

  /** Colgar (o cancelar antes de que conteste). */
  const hangup = useCallback(() => {
    const id = callIdRef.current;
    const before = phaseRef.current;
    mine.current = 'hangup';
    if (id && offered.current) void CareCallService.end(id).catch(() => undefined);
    finish(before === 'calling' || before === 'starting' ? 'cancelled' : 'hangup');
  }, [finish]);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const next = !m;
      stream.current?.getTracks().forEach((t) => {
        t.enabled = !next;
      });
      return next;
    });
  }, []);

  // Al abrir: llamar, o preparar la llamada entrante (suena y vibra).
  useEffect(() => {
    alive.current = true;
    if (opts.incoming && opts.callId) {
      callIdRef.current = opts.callId;
      offered.current = true;
      void CareCallService.snapshot(opts.callId)
        .then((c) => {
          if (!alive.current) return;
          setCall(c);
          if (c.state === 'ringing') {
            setPhase('incoming');
            playTone(RING, true);
          } else finish(endReasonFrom(c, null));
        })
        .catch((e) => finish('failed', toAppError(e).message));
    } else {
      void start();
    }
    return () => {
      alive.current = false;
      // Al salir de la pantalla: una llamada entrante sin contestar se rechaza; una en curso se cuelga.
      const id = callIdRef.current;
      const p = phaseRef.current;
      if (id && offered.current && p !== 'ended') {
        if (p === 'incoming') void CareCallService.decline(id).catch(() => undefined);
        else void CareCallService.end(id).catch(() => undefined);
      }
      phaseRef.current = 'ended';
      stopTone();
      release();
      void configureAudioForSpeech();
    };
    // Solo al abrir la pantalla.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Estado de la llamada en el servidor: contestada, colgada, perdida…
  useEffect(() => {
    if (phase === 'ended' || phase === 'starting') return undefined;
    let busy = false;
    const timer = setInterval(async () => {
      const id = callIdRef.current;
      if (busy || !id || !offered.current) return;
      busy = true;
      try {
        const c = await CareCallService.snapshot(id);
        if (!alive.current) return;
        setCall(c);
        if (c.state === 'ended') finish(endReasonFrom(c, mine.current));
        else if (phaseRef.current === 'calling' && c.state === 'answered' && (c.answer || simulated)) void onAnswered(c);
      } catch {
        // un fallo de red puntual: se vuelve a intentar
      } finally {
        busy = false;
      }
    }, phase === 'connected' ? 3000 : 1500);
    return () => clearInterval(timer);
  }, [phase, simulated, finish, onAnswered]);

  // Contador de la llamada.
  useEffect(() => {
    if (phase !== 'connected') return undefined;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // iOS y Android cortan el audio de una app en segundo plano: si se sale de MediClaro, la llamada se termina.
  useEffect(() => {
    if (simulated) return undefined;
    const sub = AppState.addEventListener('change', (s) => {
      const p = phaseRef.current;
      if (s !== 'active' && (p === 'calling' || p === 'connecting' || p === 'connected')) {
        const id = callIdRef.current;
        mine.current = 'hangup';
        if (id && offered.current) void CareCallService.end(id).catch(() => undefined);
        finish(p === 'calling' ? 'cancelled' : 'hangup', 'La llamada se ha cortado al salir de MediClaro.');
      }
    });
    return () => sub.remove();
  }, [simulated, finish]);

  const seconds = phase === 'connected' && connectedAt ? Math.round((Date.now() - connectedAt) / 1000) : endedSeconds ?? 0;
  return { phase, call, reason, message, muted, seconds, simulated, start, accept, decline, hangup, toggleMute };
}
