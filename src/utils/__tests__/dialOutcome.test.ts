import { Platform, __emitAppState } from 'react-native';
import { waitForDialOutcome } from '../dialOutcome';

const RN = { Platform: Platform as { OS: string } };

describe('waitForDialOutcome (aviso «Cancelar / Llamar 112» del iPhone)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    RN.Platform.OS = 'ios';
    __emitAppState('active');
  });
  afterEach(() => {
    jest.useRealTimers();
    RN.Platform.OS = 'android';
  });

  it('Cancelar: vuelve a active sin pasar por segundo plano → no se llamó', async () => {
    const p = waitForDialOutcome();
    __emitAppState('inactive');
    jest.advanceTimersByTime(2000);
    __emitAppState('active');
    await expect(p).resolves.toBe(false);
  });

  it('Llamar: la app pasa a segundo plano → llamada hecha', async () => {
    const p = waitForDialOutcome();
    __emitAppState('inactive');
    __emitAppState('background');
    await expect(p).resolves.toBe(true);
  });

  it('sin aviso del sistema (ningún cambio de estado) → se da por hecha', async () => {
    const p = waitForDialOutcome();
    jest.advanceTimersByTime(1600);
    await expect(p).resolves.toBe(true);
  });

  it('aviso abierto mucho tiempo → se da por hecha (nunca se oculta una llamada real)', async () => {
    const p = waitForDialOutcome();
    const now = Date.now();
    __emitAppState('inactive');
    jest.setSystemTime(now + 25000);
    __emitAppState('active');
    await expect(p).resolves.toBe(true);
  });

  it('Android: siempre hecha (abre el marcador)', async () => {
    RN.Platform.OS = 'android';
    await expect(waitForDialOutcome()).resolves.toBe(true);
  });
});
