/**
 * Tests — catálogo de planes: el ahorro y los lemas salen de los precios (nunca se inventan).
 */
import {
  DEFAULT_HIGHLIGHT_BADGE,
  alwaysFreeNote,
  decoratePlans,
  isBillingPeriod,
  monthlyEquivalent,
  perPeriodPhrase,
  perPeriodShort,
  periodName,
  savingsPercent,
} from '../planCatalog';
import type { Plan } from '../../types';

function plan(overrides: Partial<Plan>): Plan {
  const period = overrides.period ?? 'monthly';
  const priceCents = overrides.priceCents ?? 499;
  return {
    id: `premium_${period}`,
    name: 'MediClaro Premium',
    period,
    priceCents,
    currency: 'EUR',
    monthlyEquivalentCents: monthlyEquivalent(priceCents, period),
    savingsLabel: null,
    tagline: null,
    badge: null,
    terms: [],
    highlighted: false,
    purchasable: true,
    ...overrides,
  };
}

const monthly = plan({ period: 'monthly', priceCents: 499 });
const quarterly = plan({ period: 'quarterly', priceCents: 1299 });
const annual = plan({ period: 'annual', priceCents: 3999, highlighted: true });

describe('planCatalog', () => {
  it('reconoce los tres periodos y nada más', () => {
    expect(['monthly', 'quarterly', 'annual'].every(isBillingPeriod)).toBe(true);
    expect(isBillingPeriod('weekly')).toBe(false);
    expect(isBillingPeriod(undefined)).toBe(false);
  });

  it('textos de cada periodo', () => {
    expect([periodName('monthly'), periodName('quarterly'), periodName('annual')]).toEqual(['Mensual', 'Trimestral', 'Anual']);
    expect([perPeriodShort('monthly'), perPeriodShort('quarterly'), perPeriodShort('annual')]).toEqual(['/mes', '/3 meses', '/año']);
    expect([perPeriodPhrase('monthly'), perPeriodPhrase('quarterly'), perPeriodPhrase('annual')]).toEqual([
      'al mes',
      'cada 3 meses',
      'al año',
    ]);
  });

  it('equivalente mensual', () => {
    expect(monthlyEquivalent(1299, 'quarterly')).toBe(433);
    expect(monthlyEquivalent(3999, 'annual')).toBe(333);
    expect(monthlyEquivalent(499, 'monthly')).toBe(499);
  });

  it('ahorro calculado frente al mensual: 12,99 €/3 meses → 13 %, 39,99 €/año → 33 %', () => {
    expect(savingsPercent(quarterly, monthly)).toBe(13);
    expect(savingsPercent(annual, monthly)).toBe(33);
    expect(savingsPercent(monthly, monthly)).toBeNull();
  });

  it('sin ahorro real (o más caro) no hay etiqueta de ahorro', () => {
    expect(savingsPercent(plan({ period: 'quarterly', priceCents: 1497 }), monthly)).toBeNull();
    expect(savingsPercent(plan({ period: 'annual', priceCents: 7000 }), monthly)).toBeNull();
    expect(savingsPercent(annual, undefined)).toBeNull();
  });

  it('decoratePlans con los tres planes de la imagen de referencia', () => {
    const [m, q, a] = decoratePlans([monthly, quarterly, annual]);
    expect(m.tagline).toBe('Flexibilidad total');
    expect(m.savingsLabel).toBeNull();
    expect(q.tagline).toBe('Ahorra frente al mensual');
    expect(q.savingsLabel).toBe('Ahorra un 13 % aprox.');
    expect(a.tagline).toBe('El mejor precio');
    expect(a.savingsLabel).toBe('Ahorra un 33 % aprox.');
    expect(a.badge).toBe(DEFAULT_HIGHLIGHT_BADGE);
    expect(m.badge).toBeNull();
    expect(q.badge).toBeNull();
  });

  it('el ahorro configurado a mano se ignora si hay plan mensual (se calcula siempre)', () => {
    const [, a] = decoratePlans([monthly, { ...annual, savingsLabel: 'Ahorra 50 %' }]);
    expect(a.savingsLabel).toBe('Ahorra un 33 % aprox.');
  });

  it('sin plan mensual se respeta el ahorro configurado', () => {
    const [a] = decoratePlans([{ ...annual, savingsLabel: 'Ahorra 2 meses' }]);
    expect(a.savingsLabel).toBe('Ahorra 2 meses');
  });

  it('la etiqueta y el lema configurados por el propietario se respetan', () => {
    const [, a] = decoratePlans([monthly, { ...annual, badge: 'Más popular', tagline: 'Para todo el año' }]);
    expect(a.badge).toBe('Más popular');
    expect(a.tagline).toBe('Para todo el año');
  });

  it('con un solo plan no hay etiqueta de destacado', () => {
    const [m] = decoratePlans([{ ...monthly, highlighted: true }]);
    expect(m.badge).toBeNull();
    expect(m.tagline).toBe('Flexibilidad total');
  });

  it('«El mejor precio» solo si es el más barato por mes y sin empate', () => {
    const tie = decoratePlans([monthly, plan({ period: 'annual', priceCents: 3996 }), plan({ period: 'quarterly', priceCents: 999 })]);
    expect(tie.map((p) => p.tagline)).toEqual(['Flexibilidad total', 'Ahorra frente al mensual', 'Ahorra frente al mensual']);
  });
});

describe('alwaysFreeNote (ventajas que también son gratis)', () => {
  it('sin ventajas gratuitas no hay nota', () => {
    expect(alwaysFreeNote([{ id: 'assistant', label: 'Asistente IA' }])).toBeNull();
  });

  it('una ventaja gratuita → singular', () => {
    expect(alwaysFreeNote([{ id: 'emergency', label: 'Emergencias y ubicación', alwaysFree: true }])).toBe(
      '«Emergencias y ubicación» es gratis para todos, con o sin Premium.',
    );
  });

  it('las del tablero: emergencias y accesibilidad nunca se venden como exclusivas de Premium', () => {
    const { PREMIUM_BENEFITS } = jest.requireActual('../../config/plans') as typeof import('../../config/plans');
    expect(alwaysFreeNote(PREMIUM_BENEFITS)).toBe(
      '«Emergencias y ubicación» y «Funciones de accesibilidad» son gratis para todos, con o sin Premium.',
    );
  });

  it('tres o más → lista con comas y «y»', () => {
    expect(
      alwaysFreeNote([
        { id: 'a', label: 'A', alwaysFree: true },
        { id: 'b', label: 'B', alwaysFree: true },
        { id: 'c', label: 'C', alwaysFree: true },
      ]),
    ).toBe('«A», «B» y «C» son gratis para todos, con o sin Premium.');
  });
});
