# Apple Critical Alerts entitlement: draft request
Status: prepared, not submitted or approved.
App: MediClaro; bundle identifier com.mediclaro.app.
Owner must confirm legal organization/contact details in the Apple form.
Request: https://developer.apple.com/contact/request/notifications-critical-alerts-entitlement/
Reference: https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.usernotifications.critical-alerts

## Proposed explanation
MediClaro lets a consenting patient link a trusted caregiver using a private invitation and explicit acceptance.
When the patient reports feeling unwell or an assistant identifies a possible urgent concern, the app can create an incident.
Only linked participants can access that incident's private chat. Location is shared only with explicit consent.
A caregiver may request a reply. If no reply arrives before the server deadline, the app sends a follow-up alert to both participants.
We request Critical Alerts to make these consent-based caregiver alerts audible when ordinary notification settings could suppress them.
We do not diagnose illness, provide validated medical monitoring, guarantee notification delivery, or replace emergency services.
MediClaro never autonomously calls 112. A person decides whether to call emergency services.
Notification payloads contain generic alert text and an incident identifier; health details are accessed only after authentication.
Critical Alerts would be opt-in, limited to incident alerts and unanswered checks, and available for revocation.
Routine messages, marketing and subscriptions would continue to use ordinary notification priority.

## Before sending
Verify the described behavior on physical devices and review all patient-facing claims.
Confirm organization, privacy policy, app URL, screenshot/video and contact information.
After Apple approval: add entitlement to signed profile, request criticalAlert consent, configure APNs critical sound,
and verify silent mode/Focus/locked-device behavior. Do not enable a restricted entitlement before approval.
