/**
 * MediClaro — EmergencyConfigService
 *
 * Obtiene la configuración de asistencia de emergencia desde Supabase (app_config).
 * El propietario de MediClaro puede cambiar el número de asistencia principal
 * desde el dashboard sin necesidad de publicar una nueva versión de la app.
 *
 * ARQUITECTURA DE CONFIGURACIÓN:
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  Supabase: app_config (key='emergency')                        │
 * │  {                                                              │
 * │    "primaryAssistanceName": "Central MediClaro",               │
 * │    "primaryAssistanceNumber": "+34XXXXXXXXX",                  │
 * │    "countryEmergencyNumber": "112",                            │
 * │    "regionOverrides": {                                         │
 * │      "PT": { "primaryAssistanceName": "...", ... },            │
 * │      "FR": { ... }                                             │
 * │    }                                                            │
 * │  }                                                              │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * FLUJO DE RESOLUCIÓN:
 * 1. Caché en memoria (instantáneo)
 * 2. Caché AsyncStorage (< 1 hora, válido sin red)
 * 3. Fetch remoto Supabase
 * 4. DEFAULT_EMERGENCY_CONFIG (nunca falla — siempre hay 112)
 *
 * INVARIANTE DE SEGURIDAD:
 * countryEmergencyNumber NUNCA puede estar vacío ni ser falsy.
 * Si la config remota lo omite, se usa '112'.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import {
  EmergencyConfig,
  DEFAULT_EMERGENCY_CONFIG,
} from './types';

const CACHE_KEY     = 'mediclaro_emergency_config_v1';
const CACHE_TTL_MS  = 60 * 60 * 1000; // 1 hora — suficiente para cambios operacionales

interface CachedConfig {
  data: EmergencyConfig;
  cachedAt: number;
}

/**
 * Valida y normaliza una config potencialmente incompleta.
 * Garantiza que countryEmergencyNumber nunca esté vacío.
 */
function normalizeConfig(raw: Partial<EmergencyConfig>): EmergencyConfig {
  return {
    ...DEFAULT_EMERGENCY_CONFIG,
    ...raw,
    // Invariante: el número oficial de emergencias nunca puede ser falsy
    countryEmergencyNumber:
      raw.countryEmergencyNumber?.trim() || DEFAULT_EMERGENCY_CONFIG.countryEmergencyNumber,
    // El nombre de asistencia tampoco puede estar vacío
    primaryAssistanceName:
      raw.primaryAssistanceName?.trim() || DEFAULT_EMERGENCY_CONFIG.primaryAssistanceName,
  };
}

class EmergencyConfigService {
  private memCache: EmergencyConfig | null = null;

  /**
   * Devuelve la configuración activa.
   * Prioridad: caché en memoria → AsyncStorage → Supabase → default.
   */
  async getConfig(): Promise<EmergencyConfig> {
    // 1. Memoria (sin await, instantáneo)
    if (this.memCache) return this.memCache;

    // 2. AsyncStorage
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const cached: CachedConfig = JSON.parse(raw);
        const ageMs = Date.now() - cached.cachedAt;
        if (ageMs < CACHE_TTL_MS) {
          const config = normalizeConfig(cached.data);
          this.memCache = config;
          return config;
        }
        // Caché expirado — seguir al fetch remoto pero guardarlo por si falla
        const stale = normalizeConfig(cached.data);
        this.memCache = stale; // Prellenamos por si el fetch falla
      }
    } catch {
      // AsyncStorage no disponible — seguir al fetch
    }

    // 3. Fetch remoto (y actualizar caché)
    return this._fetchRemote();
  }

  /**
   * Fuerza una actualización desde Supabase.
   * Útil al arrancar la app o cuando el usuario activa la emergencia.
   */
  async refresh(): Promise<EmergencyConfig> {
    this.memCache = null; // Borrar caché en memoria
    return this._fetchRemote();
  }

  /** Borra la caché en memoria (sin tocar AsyncStorage). */
  clearMemoryCache(): void {
    this.memCache = null;
  }

  // ──────────────────────────────────────────────────────────────────────────

  private async _fetchRemote(): Promise<EmergencyConfig> {
    try {
      const { data, error } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'emergency')
        .single();

      if (error || !data?.value) {
        console.warn('[EmergencyConfig] Sin datos remotos, usando caché o default.');
        return this.memCache ?? DEFAULT_EMERGENCY_CONFIG;
      }

      const config = normalizeConfig(data.value as Partial<EmergencyConfig>);

      // Guardar en memoria y AsyncStorage
      this.memCache = config;
      AsyncStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ data: config, cachedAt: Date.now() } satisfies CachedConfig),
      ).catch(() => {}); // No crítico

      return config;
    } catch (err) {
      console.warn('[EmergencyConfig] Error en fetch remoto:', err);
      return this.memCache ?? DEFAULT_EMERGENCY_CONFIG;
    }
  }
}

export const emergencyConfigService = new EmergencyConfigService();
