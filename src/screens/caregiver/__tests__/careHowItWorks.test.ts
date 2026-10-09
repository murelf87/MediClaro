/** «Cómo funciona» de Cuidador y avisos: los pasos siguen a la voz grabada (Sulafat) en el segundo que toca. */
import fs from 'node:fs';
import path from 'node:path';
import { CARE_EXPLAIN_DURATION, CARE_STEPS, careStepAt } from '../careSteps';

const root = path.resolve(__dirname, '../../../..');

test('siete pasos en orden, dentro de la grabación, y el texto es exactamente lo que dice la voz', () => {
  expect(CARE_STEPS).toHaveLength(7);
  for (let i = 1; i < CARE_STEPS.length; i += 1) expect(CARE_STEPS[i].at).toBeGreaterThan(CARE_STEPS[i - 1].at);
  expect(CARE_STEPS[0].at).toBe(0);
  expect(CARE_STEPS[CARE_STEPS.length - 1].at).toBeLessThan(CARE_EXPLAIN_DURATION);
  const spoken = CARE_STEPS.map((s) => s.text).join(' ');
  expect(spoken).toContain('Si MediClaro detecta una situación de malestar');
  expect(spoken).toContain('MediClaro no sustituye a los servicios de emergencia.');
  expect(fs.existsSync(path.join(root, 'assets/audio/tour-emergency-sulafat.wav'))).toBe(true);
});

test('en cada segundo toca el paso que la voz está contando', () => {
  expect(careStepAt(0)).toBe(0);
  expect(careStepAt(5)).toBe(0);
  expect(careStepAt(8.5)).toBe(1);
  expect(careStepAt(14)).toBe(2);
  expect(careStepAt(17.5)).toBe(3);
  expect(careStepAt(22)).toBe(4);
  expect(careStepAt(30)).toBe(5);
  expect(careStepAt(36)).toBe(6);
  expect(careStepAt(99)).toBe(6);
});
