import {AuthService} from './AuthService';
import {CaregiverService} from './CaregiverService';
export type CareProfileRole='patient'|'caregiver';
/** A care role never grants subscription rights. No phone is required for this choice. */
export const ProfileEntryService={
 async choose(role:CareProfileRole):Promise<'/(tabs)'|'/caregiver'>{
  if(role!=='patient'&&role!=='caregiver')throw new Error('Perfil no válido.');
  await AuthService.ensureAccount();
  await CaregiverService.role(role);
  return role==='caregiver'?'/caregiver':'/(tabs)';
 },
};
