/**
 * MediClaro — EmergencyVoiceService
 * Implementación concreta de EmergencyVoiceProvider usando expo-speech.
 *
 * La voz:
 * - habla lentamente (rate: 0.75)
 * - articula claramente
 * - usa pausas entre secciones
 * - repite números importantes
 * - pronuncia dirección y código postal cuidadosamente
 *
 * Fallback si expo-speech falla: mostrar texto en pantalla (manejo en UI).
 */

import * as Speech from 'expo-speech';
import { EmergencyVoiceProvider, EmergencyReport } from './types';
import { generateVerbalSummary } from './EmergencyReportService';

export class ExpoSpeechEmergencyVoiceService implements EmergencyVoiceProvider {
  private currentLanguage = 'es-ES';
  private currentRate = 0.75; // Lento para personas mayores
  private isSpeaking = false;

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
    // Detener cualquier lectura previa
    this.stop();

    this.isSpeaking = true;

    return new Promise((resolve, reject) => {
      Speech.speak(text, {
        language: this.currentLanguage,
        rate: this.currentRate,
        pitch: 1.0,
        onDone: () => {
          this.isSpeaking = false;
          resolve();
        },
        onError: (error) => {
          this.isSpeaking = false;
          reject(error);
        },
        onStopped: () => {
          this.isSpeaking = false;
          resolve();
        },
      });
    });
  }

  stop(): void {
    if (this.isSpeaking) {
      Speech.stop();
      this.isSpeaking = false;
    }
  }

  pause(): void {
    Speech.pause?.();
  }

  resume(): void {
    Speech.resume?.();
  }

  /** Hablar texto corto de confirmación */
  async speakShort(text: string): Promise<void> {
    this.stop();
    return new Promise((resolve) => {
      Speech.speak(text, {
        language: this.currentLanguage,
        rate: this.currentRate,
        onDone: () => resolve(),
        onStopped: () => resolve(),
        onError: () => resolve(), // No bloquear en errores de voz cortos
      });
    });
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
