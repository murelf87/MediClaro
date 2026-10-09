/**
 * Capa de servicios — ÚNICO punto de contacto entre la UI y el backend.
 * Las pantallas y componentes importan desde aquí (o desde los hooks),
 * nunca desde src/lib/supabase ni desde src/api.
 */
export { AuthService } from './AuthService';
export { ProfileService, DEFAULT_SETTINGS, type AccountExport, type ProfileUpdate } from './ProfileService';
export { MedicationService } from './MedicationService';
export { MedicinePhotoService } from './MedicinePhotoService';
export { CareChatService, type CareChatMessage, type CareConversation } from './CareChatService';
export { OwnerAdminService } from './OwnerAdminService';
export { AppNoticeService, type AppNotice } from './AppNoticeService';
export { AssistantService } from './AssistantService';
export { AssistantMemoryService } from './AssistantMemoryService';
export { VoiceConversationService } from './VoiceConversationService';
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
export { MedicationPlanService, PillReminders } from './MedicationPlanService';
export {
  DEFAULT_REMINDER_SETTINGS,
  type CarePermission,
  type CorrectDoseInput,
  type DoseCorrection,
  type PlanAccess,
  type PlanSnapshot,
  type PlanState,
  type RecordDoseInput,
  type ReminderSettings,
  type TreatmentInput,
} from './pills/planStore';
export {
  reminderPermission,
  requestReminderPermission,
  scheduleTestReminder,
  remindersSupported,
  type ReminderPermission,
} from './pills/notifications';
export { PreferencesService, type GeminiVoice, type LocalPreferences } from './PreferencesService';
export { SpeechService } from './SpeechService';
export { DemoMode } from './DemoMode';
export { TestAccess } from './TestAccess';
export { PostAuthRoute } from './PostAuthRoute';
export { AiConsentService, AI_CONSENT_REQUIRED, useAiConsentStatus, type AiConsentStatus } from './AiConsentService';
export { AppError, isAppError, PREMIUM_REQUIRED_CODE } from '../api/errors';
export { QUICK_SYMPTOMS, type QuickSymptomId, type ActivationMode } from './emergency/types';
