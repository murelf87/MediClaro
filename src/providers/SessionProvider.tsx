/**
 * Sesión del usuario (login por SMS). Expone el estado a toda la app.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AuthService } from '../services/AuthService';
import { DemoMode } from '../services/DemoMode';
import { TestAccess } from '../services/TestAccess';
import { AssistantService } from '../services/AssistantService';
import { EmergencySession } from '../services/EmergencySession';
import { EmergencyService } from '../services/EmergencyService';
import { MedicationPlanService, PillReminders } from '../services/MedicationPlanService';
import { MedicinePhotoService } from '../services/MedicinePhotoService';
import { CareChatService } from '../services/CareChatService';
import { OwnerAdminService } from '../services/OwnerAdminService';
import type { AuthSession } from '../types';

export type SessionStatus = 'loading' | 'signedIn' | 'signedOut';

interface SessionContextValue {
  status: SessionStatus;
  session: AuthSession | null;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  status: 'loading',
  session: null,
  signOut: async () => undefined,
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [status, setStatus] = useState<SessionStatus>('loading');

  useEffect(() => {
    let mounted = true;
    Promise.all([TestAccess.restore().catch(() => undefined), DemoMode.restore().catch(() => false)])
      .then(([, restored]) => (restored ? true : DemoMode.startWithoutServer().catch(() => false)))
      .then(() => AuthService.getSession())
      .then((s) => {
        if (!mounted) return;
        setSession(s);
        setStatus(s ? 'signedIn' : 'signedOut');
      });
    const unsubscribe = AuthService.onAuthStateChange((s) => {
      if (!mounted) return;
      setSession(s);
      setStatus(s ? 'signedIn' : 'signedOut');
      if (!s) {
        AssistantService.clearAll();
        void EmergencySession.finish();
        void EmergencyService.clearLocalData();
      }
    });
    const unbindRefresh = AuthService.bindAutoRefreshToAppState();
    return () => {
      mounted = false;
      unsubscribe();
      unbindRefresh();
    };
  }, []);

  const signOut = useCallback(async () => {
    await EmergencyService.beforeSignOut().catch(() => undefined);
    // «Mis pastillas»: fuera los avisos programados, la copia de la pauta y las fotos propias de este teléfono
    // (se vuelven a descargar y programar al entrar de nuevo).
    const uid = session?.userId;
    await PillReminders.reschedule(false).catch(() => undefined);
    if (uid) {
      await MedicationPlanService.forgetLocal(uid).catch(() => undefined);
      await MedicinePhotoService.forgetAll(uid).catch(() => undefined);
    }
    await AuthService.logout();
    AssistantService.clearAll();
    // Chat con el cuidador/a: nada de la conversación queda en memoria.
    CareChatService.clear();
    OwnerAdminService.clear();
    await EmergencySession.finish();
    setSession(null);
    setStatus('signedOut');
  }, [session?.userId]);

  const value = useMemo(() => ({ status, session, signOut }), [status, session, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  return useContext(SessionContext);
}
