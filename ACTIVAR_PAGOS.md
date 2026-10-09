# Activar los pagos de MediClaro (≈10 minutos)

Nada de esto lo puede hacer Claude: son claves secretas y cuentas tuyas. Las claves **nunca** van en la app ni en Git:
solo en *Supabase → Edge Functions → Secrets*.

## A. Stripe (tarjeta, Bizum, SEPA, PayPal)
1. En Stripe (modo **real**) crea el producto «MediClaro Premium» con tres precios recurrentes en EUR, IVA incluido:
   mensual 4,99 €, trimestral 12,99 € (cada 3 meses) y anual 39,99 €. Copia los tres `price_…`.
   El precio por uso **no hace falta**: Premium es ilimitado.
2. Ajustes → Métodos de pago: activa tarjeta y, si quieres, Bizum, SEPA y PayPal.
3. Desarrolladores → Webhooks → añadir endpoint
   `https://ldonnvkysjalpmystoeq.supabase.co/functions/v1/stripe-webhook` con los eventos:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.created/updated/deleted/paused/resumed`,
   `invoice.paid`, `invoice.payment_failed`. Copia el secreto de firma `whsec_…`.
4. En Supabase → Secrets añade: `STRIPE_SECRET_KEY` (clave restringida o secreta `sk_live_…`), `STRIPE_WEBHOOK_SECRET`,
   `STRIPE_PRICE_BASE` (mensual), `STRIPE_PRICE_QUARTERLY`, `STRIPE_PRICE_ANNUAL`, `FAMILY_PAY_PUBLIC_URL`, `FAMILY_PAY_DONE_URL`
   y, si cobras IVA automático, `STRIPE_AUTOMATIC_TAX=true`.
5. Despliega: `npx supabase functions deploy chat create-checkout stripe-webhook tts-preview caregiver-dispatch caregiver-rtc-config`
   y `npx supabase functions deploy family-pay --no-verify-jwt`.
6. En `app_config.plans` pon a `true` solo los métodos que hayas activado en Stripe.

## B. Apple (compra dentro de la app)
Crea en App Store Connect las tres suscripciones del grupo Premium con los identificadores de `src/config/plans.ts`,
rellena `APPLE_BUNDLE_ID`, `APPLE_APP_ID` y `APPLE_IAP_*` en Secrets. Prueba con cuenta Sandbox antes de poner
`storeVerification = true`. **No se sube nada a Apple sin que lo apruebes.**

## C. Google Play
Suscripción `mediclaro_premium`, `ANDROID_PACKAGE_NAME`, `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_RTDN_TOKEN`.

## D. Comprobar
Con la build de producción (`PAYMENTS_MODE=store`; añade `stripe` solo si cobras fuera de las tiendas): pagar el mensual con una tarjeta
real de 4,99 € y reembolsarlo, comprobar que el perfil pasa a Premium y que «Ilimitadas» aparece en identificaciones.
