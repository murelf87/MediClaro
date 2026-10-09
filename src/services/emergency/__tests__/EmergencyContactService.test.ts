/**
 * Tests — EmergencyContactService (Section 21)
 *
 * Escenarios cubiertos:
 * - botón 112 (con y sin soporte del dispositivo)
 * - contacto no disponible
 * - SMS con y sin permiso
 * - sin consentimiento
 * - dispositivo no puede abrir SMS
 *
 * NOTA: importamos react-native (mapeado al mock via moduleNameMapper) para
 * que los spy.fn sean los mismos que usa el servicio — NO usamos resetModules().
 */

// Helpers del mock de react-native — accesibles como named exports del módulo mock
import { Linking, __reset, __setCanOpenURL, __setOpenURLFails } from 'react-native';
import { dialEmergencyNumber, notifyEmergencyContact, canNotifyContact } from '../EmergencyContactService';
import type { EmergencyReport } from '../types';

beforeEach(() => {
  __reset();
  jest.clearAllMocks();
});

// ─── Informe mínimo válido ────────────────────────────────────────────────────

function makeReport(overrides: Partial<EmergencyReport> = {}): EmergencyReport {
  return {
    incidentId: 'test-uuid',
    createdAt: new Date().toISOString(),
    user: { fullName: 'Antonio López', provenance: 'USER_DECLARED' },
    currentLocation: {
      latitude: 40.4, longitude: -3.7, accuracy: 10,
      timestamp: new Date().toISOString(),
      resolvedAddress: 'Calle Sol 1',
      resolvedCity: 'Madrid',
      resolvedPostalCode: '28001',
      isApproximate: false,
      ageSeconds: 5,
      provenance: 'DEVICE_LOCATION',
    },
    registeredAddress: undefined,
    declaredAllergies: [],
    medications: [],
    declaredConditions: [],
    recentStatements: [],
    symptomsSelected: [],
    noResponseDetected: false,
    emergencyContact: {
      name: 'Carmen López',
      relationship: 'Hija',
      phone: '+34612345678',
    },
    consent: {
      shareLocation: true,
      shareAddress: true,
      shareMedications: true,
      shareAllergies: true,
      shareMedicalInfo: true,
      shareRecentConversation: true,
      notifyEmergencyContact: true,
    },
    dataProvenance: {},
    ...overrides,
  };
}

// ─── dialEmergencyNumber ──────────────────────────────────────────────────────

describe('dialEmergencyNumber — botón 112', () => {

  it('abre tel:112 cuando el dispositivo lo soporta', async () => {
    const result = await dialEmergencyNumber('112');

    expect(result).toBe(true);
    expect(Linking.openURL).toHaveBeenCalledWith('tel:112');
  });

  it('intenta abrir la URL incluso si canOpenURL devuelve false (fallback de emergencia)', async () => {
    __setCanOpenURL(false);
    // No debe lanzar — siempre intenta en emergencia
    const result = await dialEmergencyNumber('112');
    expect(typeof result).toBe('boolean');
  });

  it('usa 112 como número predeterminado si no se pasa argumento', async () => {
    await dialEmergencyNumber();
    expect(Linking.openURL).toHaveBeenCalledWith('tel:112');
  });
});

// ─── notifyEmergencyContact ───────────────────────────────────────────────────

describe('notifyEmergencyContact — contacto disponible', () => {

  it('abre compositor SMS con número y mensaje cuando consentimiento activo', async () => {
    const report = makeReport();
    const result = await notifyEmergencyContact(report);

    expect(result.ok).toBe(true);
    expect(result.method).toBe('sms');
    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('sms:+34612345678'),
    );
  });

  it('incluye ubicación en el SMS cuando shareLocation:true', async () => {
    const report = makeReport();
    const result = await notifyEmergencyContact(report);

    const calledUrl = (Linking.openURL as jest.Mock).mock.calls[0][0] as string;
    expect(decodeURIComponent(calledUrl)).toContain('Calle Sol 1');
    expect(result.ok).toBe(true);
  });

  it('NO incluye ubicación GPS en SMS cuando shareLocation:false', async () => {
    const report = makeReport({
      consent: {
        shareLocation: false,
        shareAddress: false,
        shareMedications: true,
        shareAllergies: true,
        shareMedicalInfo: true,
        shareRecentConversation: true,
        notifyEmergencyContact: true,
      },
    });
    await notifyEmergencyContact(report);
    const calledUrl = (Linking.openURL as jest.Mock).mock.calls[0][0] as string;
    expect(decodeURIComponent(calledUrl)).not.toContain('Calle Sol 1');
  });
});

describe('notifyEmergencyContact — contacto no disponible', () => {

  it('retorna ok:false cuando no hay teléfono de contacto', async () => {
    const report = makeReport({ emergencyContact: undefined });
    const result = await notifyEmergencyContact(report);
    expect(result.ok).toBe(false);
    expect(result.method).toBe('unavailable');
  });

  it('retorna ok:false cuando notifyEmergencyContact:false (sin consentimiento)', async () => {
    const report = makeReport({
      consent: {
        shareLocation: true,
        shareAddress: true,
        shareMedications: true,
        shareAllergies: true,
        shareMedicalInfo: true,
        shareRecentConversation: true,
        notifyEmergencyContact: false,
      },
    });
    const result = await notifyEmergencyContact(report);
    expect(result.ok).toBe(false);
  });

  it('retorna ok:false cuando el dispositivo no puede abrir SMS', async () => {
    __setCanOpenURL(false);
    const report = makeReport();
    const result = await notifyEmergencyContact(report);
    expect(result.ok).toBe(false);
    expect(result.method).toBe('unavailable');
  });
});

// ─── canNotifyContact ─────────────────────────────────────────────────────────

describe('canNotifyContact', () => {

  it('retorna true cuando hay teléfono y consentimiento', () => {
    const report = makeReport();
    expect(canNotifyContact(report)).toBe(true);
  });

  it('retorna false cuando no hay teléfono de contacto', () => {
    const report = makeReport({ emergencyContact: undefined });
    expect(canNotifyContact(report)).toBe(false);
  });

  it('retorna false cuando notifyEmergencyContact:false', () => {
    const report = makeReport({
      consent: { ...makeReport().consent, notifyEmergencyContact: false },
    });
    expect(canNotifyContact(report)).toBe(false);
  });
});
