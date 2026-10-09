/**
 * Situación de cuidado de la cuenta (rol, vinculaciones y avisos) para las pantallas que solo necesitan saber
 * si la persona usa MediClaro como cuidador/a. Sin sesión no se consulta nada. Se actualiza al volver a la pantalla.
 */
import { useAsync } from './useAsync';
import { useRefreshOnFocus } from './useRefreshOnFocus';
import { useSession } from '../providers/SessionProvider';
import { CaregiverService, type CareSnapshot } from '../services/CaregiverService';

export function useCareSnapshot() {
  const { session } = useSession();
  const uid = session?.userId ?? null;
  const care = useAsync<CareSnapshot | null>(() => (uid ? CaregiverService.snapshot() : Promise.resolve(null)), [uid]);
  useRefreshOnFocus(care.refresh);
  const caregiver = care.data?.role === 'caregiver';
  /** Nombres de las personas de las que es cuidador/a (vinculaciones aceptadas). */
  const patients = (care.data?.links ?? [])
    .filter((l) => l.accepted && !!uid && l.caregiverId === uid && l.patientId !== uid)
    .map((l) => l.patientName)
    .filter(Boolean);
  return { care, caregiver, patients };
}
