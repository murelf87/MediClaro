/**
 * Capa de servicios — ÚNICO punto de contacto entre la UI y el backend.
 * Las pantallas y componentes importan desde aquí (o desde los hooks),
 * nunca desde src/lib/supabase ni desde src/api.
 */
export { CaregiverService, careAction } from './CaregiverService';
export { CaregiverChatService } from './CaregiverChatService';
export { AuthService } from './AuthService';
export { ProfileService, DEFAULT_SETTINGS, type AccountExport, type ProfileUpdate } from './ProfileService';
export { MedicationService } from './MedicationService';
export { AssistantService } from './AssistantService';
export { SubscriptionService } from './SubscriptionService';
export { PurchaseService } from './PurchaseService';
export {
  DEFAULT_HIGHLIGHT_BADGE,
  PERIOD_MONTHS,
  monthlyEquivalent,
  periodName,
  perPeriodPhrase,
  perPeriodShort,
} from './planCatalog';
export { EmergencyService, type PreparedEmergency } from './EmergencyService';
export { EmergencySession, type EmergencySessionState, type CallTarget } from './EmergencySession';
export { NotificationService } from './NotificationService';
export { PreferencesService, type LocalPreferences } from './PreferencesService';
export { DemoMode } from './DemoMode';
export { TestAccess } from './TestAccess';
export { PostAuthRoute } from './PostAuthRoute';
export { AiConsentService, AI_CONSENT_REQUIRED, useAiConsentStatus, type AiConsentStatus } from './AiConsentService';
export { AppError, isAppError, PREMIUM_REQUIRED_CODE } from '../api/errors';
export { QUICK_SYMPTOMS, type QuickSymptomId, type ActivationMode } from './emergency/types';
