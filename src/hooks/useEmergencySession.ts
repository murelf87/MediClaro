import { useSyncExternalStore } from 'react';
import { EmergencySession, type EmergencySessionState } from '../services/EmergencySession';

/** Estado compartido de la emergencia en curso. */
export function useEmergencySession(): EmergencySessionState {
  return useSyncExternalStore(EmergencySession.subscribe, EmergencySession.getSnapshot, EmergencySession.getSnapshot);
}
