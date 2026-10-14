# MediClaro 1.0.1-rc.3-20261004

- Google Sulafat/Achird remain primary. On synthesis/playback failure or timeout, speech falls back to an installed Spanish voice, preferring enhanced es-ES.
- Added cancellation, late audio cleanup, startup timeout and section fallback tests.
- Owner Dashboard supports phone-based courtesy Premium grants, expiry, revocation and audit events. Server requires verified phone identity; grants never confer owner access or overwrite paid billing.
- Migration 20261004130000_owner_premium_grants.sql applied using Supabase db query (migration history not marked).
- Updated dependent Edge Functions deployed: chat, emergency-contact, emergency-contact-status, identify-medicine, medicine-detail, tts.
- Verification: 26 suites, 318 tests passed; typecheck passed; protected photo identification code unchanged (15 files).
- Real SQL authorization audit passed before and after deployment, with rolled-back fixtures. Free-session TTS returns 402 PREMIUM_REQUIRED.
- Expo Go iOS bundle compiled and returned HTTP 200. Physical iPhone playback and Dashboard interaction remain unverified.
- No new signed iOS build generated in this block. Not ready for Apple App Review; previously documented IAP, critical alert and RTC limitations remain.
