/** Textos del panel del propietario: duraciones, fechas, planes, ejes del gráfico y registro. */
import { auditFacts, autoBonoName, bonoDays, bonoKind, bonoSubtitle, bucketLabel, describeAudit, fmtDate, fmtDays, isPlan, planText } from '../ownerFormat';

test('duraciones en palabras', () => {
  expect(fmtDays(null)).toBe('Vitalicio');
  expect(fmtDays(1)).toBe('1 día');
  expect(fmtDays(7)).toBe('7 días');
  expect(fmtDays(90)).toBe('3 meses');
  expect(fmtDays(365)).toBe('1 año');
  expect(fmtDays(730)).toBe('2 años');
});

test('fechas y planes', () => {
  expect(fmtDate(null)).toBe('—');
  expect(fmtDate('no es fecha')).toBe('—');
  expect(fmtDate('2026-10-09T10:00:00Z')).toMatch(/09\/10\/2026/);
  expect(planText({ plan: 'paid', provider: 'apple' })).toBe('Premium · App Store');
  expect(planText({ plan: 'paid', provider: 'bizum' })).toBe('Premium · Bizum');
  expect(planText({ plan: 'courtesy', provider: 'stripe' })).toBe('Premium de cortesía');
  expect(planText({ plan: 'owner', provider: 'stripe' })).toBe('Propietario');
  expect(planText({ plan: 'free', provider: 'stripe' })).toBe('Básico');
  expect(isPlan('free')).toBe(true);
  expect(isPlan('gold')).toBe(false);
});

test('ejes del gráfico', () => {
  expect(bucketLabel('2026-10-05', 'day')).toBe('lu 5');
  expect(bucketLabel('2026-10-05', 'week')).toBe('5 oct');
  expect(bucketLabel('2026-03-01', 'month')).toBe('mar');
});

test('cada anotación del registro se explica en español, sin datos de más', () => {
  const base = { id: 'a1', createdAt: '2026-10-09T10:00:00Z', actor: 'Antonio', target: null, detail: {} };
  expect(describeAudit({ ...base, action: 'owner_bono_created', detail: { bono_name: 'Bono 30 días', days: 30, max_uses: 5, lifetime: false } })).toMatchObject({
    title: 'Bono generado',
    detail: '30 días · Premium completo · 5 personas',
  });
  expect(describeAudit({ ...base, action: 'owner_bono_created', detail: { bono_name: 'Bono familiar 90 días', days: 90, max_uses: 1, lifetime: false } }).detail).toBe(
    '90 días · Premium familiar',
  );
  expect(describeAudit({ ...base, action: 'owner_bono_created', detail: { bono_name: 'Bono vitalicio', days: null, max_uses: 1, lifetime: true } }).detail).toBe(
    'Vitalicio · Premium completo',
  );
  expect(describeAudit({ ...base, action: 'courtesy_premium_granted', target: 'Carmen García', detail: { bono_name: 'Familia', lifetime: true } }).detail).toBe('Carmen García');
  expect(describeAudit({ ...base, action: 'courtesy_premium_revoked' }).detail).toBe('Teléfono sin cuenta');
  expect(describeAudit({ ...base, action: 'owner_unlocked', detail: { via: 'device' } })).toMatchObject({ title: 'Acceso al dashboard', detail: 'Propietario · con Face ID' });
  expect(describeAudit({ ...base, action: 'owner_export', detail: { kind: 'users', rows: 12 } }).detail).toBe('usuarios · 12 filas');
  expect(describeAudit({ ...base, action: 'user_registered', actor: null }).detail).toBe('Sin nombre');
  expect(describeAudit({ ...base, action: 'algo_nuevo' }).title).toBe('algo nuevo');
});

test('tipo y nombre de los bonos, como en el diseño', () => {
  expect(autoBonoName('full', 30)).toBe('Bono 30 días');
  expect(autoBonoName('full', 365)).toBe('Bono 1 año');
  expect(autoBonoName('full', null)).toBe('Bono vitalicio');
  expect(autoBonoName('family', 90)).toBe('Bono familiar 90 días');
  expect(autoBonoName('family', null)).toBe('Bono familiar vitalicio');
  expect(bonoKind('Bono familiar 90 días')).toBe('family');
  expect(bonoKind('Bono familiar')).toBe('family');
  expect(bonoKind('Bono familiares raros')).toBe('full');
  expect(bonoKind('Bono 30 días')).toBe('full');
  expect(bonoKind(null)).toBe('full');
  expect(bonoSubtitle({ name: 'Bono 30 días', days: 30 })).toBe('Premium completo · 30 días');
  expect(bonoSubtitle({ name: 'Bono familiar', days: 90 })).toBe('Premium familiar · 90 días');
  expect(bonoSubtitle({ name: 'Bono vitalicio', days: null })).toBe('Premium completo');
  expect(bonoSubtitle({ name: 'Asociación', days: null })).toBe('Premium completo · Vitalicio');
  expect(bonoDays(730)).toBe('2 años');
  expect(bonoDays(1)).toBe('1 día');
});

test('datos completos de una anotación del registro', () => {
  const facts = auditFacts({
    id: 'a2',
    action: 'courtesy_premium_granted',
    createdAt: '2026-10-09T10:00:00Z',
    actor: null,
    target: 'Carmen García',
    detail: { bono_name: 'Bono 30 días', days: 30, lifetime: false, expires_at: '2026-11-08T10:00:00Z', via: 'panel' },
  });
  const map = Object.fromEntries(facts.map((f) => [f.label, f.value]));
  expect(map['Quién']).toBe('Propietario');
  expect(map['Sobre']).toBe('Carmen García');
  expect(map['Bono']).toBe('Bono 30 días');
  expect(map['Duración']).toBe('30 días');
  expect(map['Premium hasta']).toMatch(/08\/11\/2026/);
  expect(map['Cómo']).toBe('Desde el panel');
  const life = auditFacts({ id: 'a3', action: 'owner_bono_created', createdAt: '2026-10-09T10:00:00Z', actor: 'Antonio', target: null, detail: { days: null, lifetime: true, max_uses: 3 } });
  expect(Object.fromEntries(life.map((f) => [f.label, f.value]))).toMatchObject({ Quién: 'Antonio', Duración: 'Vitalicio', Personas: '3' });
  const reg = auditFacts({ id: 'a4', action: 'user_registered', createdAt: '2026-10-09T10:00:00Z', actor: null, target: null, detail: {} });
  expect(reg.find((f) => f.label === 'Quién')?.value).toBe('Sin nombre');
});
