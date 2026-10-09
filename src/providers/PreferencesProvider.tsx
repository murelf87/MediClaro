/**
 * Preferencias de accesibilidad + tema visual.
 *
 * Aplica al instante la copia local (sin parpadeos) y sincroniza con el perfil
 * del backend (font_size, easy_mode, speech_rate) cuando hay sesión.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { buildTheme, defaultTheme, type AppTheme } from '../theme';
import { PreferencesService, DEFAULT_LOCAL_PREFERENCES, type GeminiVoice, type LocalPreferences } from '../services/PreferencesService';
import { ProfileService } from '../services/ProfileService';
import { useSession } from './SessionProvider';
import type { FontSizePreference } from '../types';

interface PreferencesContextValue {
  ready: boolean;
  prefs: LocalPreferences;
  theme: AppTheme;
  setFontSize: (size: FontSizePreference) => Promise<void>;
  setEasyMode: (enabled: boolean) => Promise<void>;
  setHighContrast: (enabled: boolean) => Promise<void>;
  setSpeechRate: (rate: number) => Promise<void>;
  setReadingVoice: (voice: GeminiVoice) => Promise<void>;
  setAssistantVoice: (voice: GeminiVoice) => Promise<void>;
  markOnboardingSeen: () => Promise<void>;
  /** Último error al sincronizar con el servidor (se muestra de forma discreta). */
  syncError: string | null;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  ready: false,
  prefs: DEFAULT_LOCAL_PREFERENCES,
  theme: defaultTheme,
  setFontSize: async () => undefined,
  setEasyMode: async () => undefined,
  setHighContrast: async () => undefined,
  setSpeechRate: async () => undefined,
  setReadingVoice: async () => undefined,
  setAssistantVoice: async () => undefined,
  markOnboardingSeen: async () => undefined,
  syncError: null,
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const [prefs, setPrefs] = useState<LocalPreferences>(DEFAULT_LOCAL_PREFERENCES);
  const [ready, setReady] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  // 1. Copia local
  useEffect(() => {
    PreferencesService.load().then((p) => {
      setPrefs(p);
      setReady(true);
    });
  }, []);

  // 2. Ajustes del servidor al iniciar sesión
  useEffect(() => {
    if (status !== 'signedIn' || !ready) return;
    let cancelled = false;
    ProfileService.getSettings()
      .then(async (s) => {
        if (cancelled) return;
        const next = await PreferencesService.save({
          fontSize: s.fontSize,
          easyMode: s.easyMode,
          speechRate: s.speechRate,
        });
        setPrefs(next);
        if (next.onboardingSeen && !s.onboarded) {
          ProfileService.updateProfile({ onboarded: true }).catch(() => undefined);
        }
      })
      .catch(() => {
        // Sin conexión: seguimos con la copia local
      });
    return () => {
      cancelled = true;
    };
  }, [status, ready]);

  const persist = useCallback(
    async (patch: Partial<LocalPreferences>, server?: Parameters<typeof ProfileService.updateProfile>[0]) => {
      const optimistic = { ...prefsRef.current, ...patch };
      setPrefs(optimistic);
      await PreferencesService.save(patch);
      if (server && status === 'signedIn') {
        // Sincronización en segundo plano: la interfaz nunca espera a la red.
        ProfileService.updateProfile(server)
          .then(() => setSyncError(null))
          .catch(() => setSyncError('Guardado en este teléfono. Se sincronizará cuando haya conexión.'));
      }
    },
    [status],
  );

  const setFontSize = useCallback((size: FontSizePreference) => persist({ fontSize: size }, { fontSize: size }), [persist]);
  const setEasyMode = useCallback((enabled: boolean) => persist({ easyMode: enabled }, { easyMode: enabled }), [persist]);
  const setHighContrast = useCallback((enabled: boolean) => persist({ highContrast: enabled }), [persist]);
  const setSpeechRate = useCallback((rate: number) => persist({ speechRate: rate }, { speechRate: rate }), [persist]);
  // Las voces no se envían al perfil hasta que exista una columna de backend: se guardan de forma segura en este dispositivo.
  const setReadingVoice = useCallback((voice: GeminiVoice) => persist({ readingVoice: voice }), [persist]);
  const setAssistantVoice = useCallback((voice: GeminiVoice) => persist({ assistantVoice: voice }), [persist]);
  const markOnboardingSeen = useCallback(
    () => persist({ onboardingSeen: true }, status === 'signedIn' ? { onboarded: true } : undefined),
    [persist, status],
  );

  const theme = useMemo(
    () => buildTheme({ fontSize: prefs.fontSize, easyMode: prefs.easyMode, highContrast: prefs.highContrast }),
    [prefs.fontSize, prefs.easyMode, prefs.highContrast],
  );

  const value = useMemo(
    () => ({ ready, prefs, theme, setFontSize, setEasyMode, setHighContrast, setSpeechRate, setReadingVoice, setAssistantVoice, markOnboardingSeen, syncError }),
    [ready, prefs, theme, setFontSize, setEasyMode, setHighContrast, setSpeechRate, setReadingVoice, setAssistantVoice, markOnboardingSeen, syncError],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesContextValue {
  return useContext(PreferencesContext);
}

/** Tema activo (colores, tipografía escalada, espaciado...). */
export function useAppTheme(): AppTheme {
  return useContext(PreferencesContext).theme;
}
