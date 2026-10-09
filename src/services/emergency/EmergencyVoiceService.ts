/**
 * MediClaro — EmergencyVoiceService
 * Usa la voz natural Gemini elegida para el Asistente IA (Sulafat/Achird).
 * En una emergencia, si el TTS remoto no está disponible, conserva expo-speech
 * como último respaldo local para no perder la lectura del informe.
 *
 * La voz se reproduce lentamente y el resumen verbal pronuncia dirección,
 * código postal y coordenadas de forma explícita.
 */

import * as Speech from 'expo-speech';
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { EmergencyVoiceProvider, EmergencyReport } from './types';
import { generateVerbalSummary } from './EmergencyReportService';
import { SpeechService } from '../SpeechService';
import { PreferencesService } from '../PreferencesService';
import { configureAudioForSpeech } from '../../utils/audio';

export class ExpoSpeechEmergencyVoiceService implements EmergencyVoiceProvider {
  private currentLanguage = 'es-ES';
  private currentRate = 0.75; // Lento para personas mayores
  private isSpeaking = false;
  private token = 0;
  private player: AudioPlayer | null = null;
  private subscription: { remove: () => void } | null = null;
  private cleanupFile: (() => void) | null = null;

  private releaseNaturalAudio(): void {
    try { this.subscription?.remove(); } catch { /* noop */ }
    try { this.player?.remove(); } catch { /* noop */ }
    try { this.cleanupFile?.(); } catch { /* noop */ }
    this.subscription = null;
    this.player = null;
    this.cleanupFile = null;
  }

  private playbackRate(): number {
    if (this.currentRate <= 0.77) return 0.9;
    if (this.currentRate >= 0.93) return 1.1;
    return 1;
  }

  setLanguage(lang: string): void {
    this.currentLanguage = lang;
  }

  setSpeed(rate: number): void {
    // rate: 0.1 – 2.0 (expo-speech)
    this.currentRate = Math.max(0.1, Math.min(2.0, rate));
  }

  async speakEmergencyReport(report: EmergencyReport): Promise<void> {
    const summary = generateVerbalSummary(report);
    await this.speakText(summary);
  }

  async speakText(text: string): Promise<void> {
    this.stop();
    const my = ++this.token;
    this.isSpeaking = true;

    try {
      const prefs = await PreferencesService.load();
      await configureAudioForSpeech();
      const audio = await SpeechService.synthesize(text, prefs.assistantVoice, 'assistant');
      if (my !== this.token) {
        audio.cleanup();
        return;
      }

      const player = createAudioPlayer(audio.uri, { downloadFirst: true, updateInterval: 200 });
      player.playbackRate = this.playbackRate();
      player.shouldCorrectPitch = true;
      this.player = player;
      this.cleanupFile = audio.cleanup;

      await new Promise<void>((resolve, reject) => {
        this.subscription = player.addListener('playbackStatusUpdate', (status: AudioStatus) => {
          if (my !== this.token) {
            resolve();
            return;
          }
          if (status.error) {
            this.releaseNaturalAudio();
            this.isSpeaking = false;
            reject(new Error(String(status.error)));
            return;
          }
          if (status.didJustFinish) {
            this.releaseNaturalAudio();
            this.isSpeaking = false;
            resolve();
          }
        });
        player.play();
      });
      return;
    } catch {
      // En una emergencia la voz nunca debe desaparecer: si la voz natural no está disponible,
      // se usa la voz local del teléfono como último respaldo.
      if (my !== this.token) return;
      this.releaseNaturalAudio();
      await new Promise<void>((resolve) => {
        Speech.speak(text, {
          language: this.currentLanguage,
          rate: this.currentRate,
          pitch: 1.0,
          onDone: () => { this.isSpeaking = false; resolve(); },
          onStopped: () => { this.isSpeaking = false; resolve(); },
          onError: () => { this.isSpeaking = false; resolve(); },
        });
      });
    }
  }

  stop(): void {
    this.token += 1;
    this.releaseNaturalAudio();
    Speech.stop();
    this.isSpeaking = false;
  }

  pause(): void {
    if (this.player) this.player.pause();
    else Speech.pause?.();
  }

  resume(): void {
    if (this.player) this.player.play();
    else Speech.resume?.();
  }

  /** Hablar texto corto de confirmación */
  async speakShort(text: string): Promise<void> {
    await this.speakText(text);
  }
}

// Singleton exportado para uso en UI
export const emergencyVoiceService = new ExpoSpeechEmergencyVoiceService();

/** Verificar si TTS está disponible */
export async function isTTSAvailable(): Promise<boolean> {
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.length > 0;
  } catch {
    return false; // Fallback: mostrar texto en pantalla
  }
}
