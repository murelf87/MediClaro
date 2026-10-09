/**
 * Biblioteca de componentes de MediClaro.
 * Ningún componente conoce Supabase, Stripe, Twilio ni CIMA.
 */
export { AppText, type AppTextProps } from './AppText';
export { FitText, FitGroup } from './FitText';
export { Icon, type IconName } from './Icon';
export { MediClaroLogo, MediClaroMark, MediClaroWordmark } from './MediClaroLogo';
export { Screen, type ScreenProps } from './Screen';
export { AppHeader, type AppHeaderProps } from './AppHeader';
export { PrimaryButton, SecondaryButton, TextButton, IconButton } from './Buttons';
export { Card, ListGroup, Divider, SectionHeader, type CardTone } from './Card';
export { ActionRow, SettingRow, type SettingRowProps } from './Rows';
export { LoadingState, ErrorState, EmptyState, Skeleton, SkeletonList } from './States';
export { InfoBanner, Badge, CheckItem, Avatar, Chip } from './Feedback';
export { TextField, SegmentedControl, OtpInput, PhoneInput } from './Inputs';
export { MedicationImage, MedicationCard } from './Medication';
export { ProgressRing, Waveform, PulseHalo } from './Graphics';
export {
  MedicineBoxArt,
  PhotoIllustration,
  InfoIllustration,
  AssistantIllustration,
  EmergencyIllustration,
} from './Illustrations';
export { BottomNavigation, TAB_ITEMS } from './BottomNavigation';
export { EmergencyCallButton, AssistanceCallButton, OfficialEmergencyNote } from './EmergencyButtons';
export { BrandHero } from './BrandHero';
export { AiConsentHost } from './AiConsentHost';
