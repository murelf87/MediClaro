/**
 * Premium: identificaciones ilimitadas mientras dure la suscripción. Lo decide el servidor (plan_config);
 * la app solo deja de mostrar contadores cuando el servidor de verdad no limita ni cobra por uso.
 */
import * as fs from 'fs';
import * as path from 'path';
import { UNLIMITED_SCANS_FROM, isUnlimitedScans } from '../plans';
import { demoAccountStatus, demoPlanConfig } from '../../mocks/demoData';

const migration = fs.readFileSync(
  path.resolve(__dirname, '../../../supabase/migrations/20261008200000_premium_unlimited_scans.sql'),
  'utf8',
);

test('el cambio del servidor deja Premium sin límite práctico y sin pago por uso', () => {
  const monthly = Number(/monthly_scans\s*=\s*(\d+)/.exec(migration)?.[1]);
  expect(isUnlimitedScans(monthly)).toBe(true);
  expect(migration).toMatch(/overage_enabled\s*=\s*false/);
  expect(migration).toMatch(/where plan = 'premium'/);
  expect(migration).not.toMatch(/\b(create|alter|drop|grant|revoke)\b/i);
});

test('con los límites de antes (100 incluidas) la app sigue mostrando el uso real', () => {
  expect(isUnlimitedScans(100)).toBe(false);
  expect(isUnlimitedScans(500)).toBe(false);
  expect(isUnlimitedScans(null)).toBe(false);
  expect(isUnlimitedScans(UNLIMITED_SCANS_FROM)).toBe(true);
});

test('la demostración refleja la configuración nueva y el plan gratuito sigue limitado', () => {
  expect(isUnlimitedScans(demoAccountStatus(true).included_scans)).toBe(true);
  expect(isUnlimitedScans(demoAccountStatus(false).included_scans)).toBe(false);
  const premium = demoPlanConfig.find((p) => p.plan === 'premium');
  expect(premium?.overage_enabled).toBe(false);
  expect(isUnlimitedScans(premium?.monthly_scans)).toBe(true);
});
