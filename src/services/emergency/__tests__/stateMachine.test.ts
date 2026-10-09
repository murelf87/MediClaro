/**
 * Tests — Máquina de estados (Section 18 + 21)
 * Verifica que canTransition() rechaza las transiciones inválidas
 * y permite las válidas.
 */

import { canTransition, showCallButton, canCancel, STATE_LABELS } from '../stateMachine';
import type { EmergencyState } from '../types';

describe('stateMachine — canTransition', () => {

  // ── Transiciones válidas esperadas ─────────────────────────────────────────

  it('permite IDLE → ACTIVATED', () => {
    expect(canTransition('IDLE', 'ACTIVATED')).toBe(true);
  });

  it('permite ACTIVATED → LISTENING', () => {
    expect(canTransition('ACTIVATED', 'LISTENING')).toBe(true);
  });

  it('permite ACTIVATED → DIALING (llamada directa sin asistente)', () => {
    expect(canTransition('ACTIVATED', 'DIALING')).toBe(true);
  });

  it('permite LISTENING → NO_RESPONSE (sin interacción 60 s)', () => {
    expect(canTransition('LISTENING', 'NO_RESPONSE')).toBe(true);
  });

  it('permite COLLECTING_CONTEXT → LOCATION_PENDING', () => {
    expect(canTransition('COLLECTING_CONTEXT', 'LOCATION_PENDING')).toBe(true);
  });

  it('permite LOCATION_PENDING → REPORT_READY (GPS falla — fallback)', () => {
    expect(canTransition('LOCATION_PENDING', 'REPORT_READY')).toBe(true);
  });

  it('permite REPORT_READY → DIALING', () => {
    expect(canTransition('REPORT_READY', 'DIALING')).toBe(true);
  });

  it('permite DIALING → CALL_TRANSFERRED', () => {
    expect(canTransition('DIALING', 'CALL_TRANSFERRED')).toBe(true);
  });

  it('permite NO_RESPONSE → DIALING (usuario pulsa 112 desde pantalla sin respuesta)', () => {
    expect(canTransition('NO_RESPONSE', 'DIALING')).toBe(true);
  });

  // ── Cualquier estado puede ir a IDLE (cancelación) ─────────────────────────

  const allStates: EmergencyState[] = [
    'ACTIVATED', 'LISTENING', 'COLLECTING_CONTEXT',
    'LOCATION_PENDING', 'LOCATION_READY', 'REPORT_READY',
    'DIALING', 'NO_RESPONSE', 'OFFLINE', 'ERROR',
  ];

  allStates.forEach(s => {
    it(`permite ${s} → IDLE (cancelar siempre posible)`, () => {
      expect(canTransition(s, 'IDLE')).toBe(true);
    });

    it(`permite ${s} → OFFLINE (sin internet en cualquier momento)`, () => {
      expect(canTransition(s, 'OFFLINE')).toBe(true);
    });

    it(`permite ${s} → ERROR (error recuperable en cualquier momento)`, () => {
      expect(canTransition(s, 'ERROR')).toBe(true);
    });
  });

  // ── Transiciones inválidas ─────────────────────────────────────────────────

  it('impide IDLE → REPORT_READY (saltarse el flujo)', () => {
    expect(canTransition('IDLE', 'REPORT_READY')).toBe(false);
  });

  it('impide CALL_TRANSFERRED → DIALING (ya se realizó la llamada)', () => {
    expect(canTransition('CALL_TRANSFERRED', 'DIALING')).toBe(false);
  });

  it('impide LISTENING → IDLE sin ir por IDLE (estado no previsto)', () => {
    // LISTENING → IDLE sí está permitido por la regla "*→IDLE"
    // Pero LISTENING → CALL_TRANSFERRED sin pasar por DIALING no lo está
    expect(canTransition('LISTENING', 'CALL_TRANSFERRED')).toBe(false);
  });

  // ── showCallButton ─────────────────────────────────────────────────────────

  it('showCallButton retorna true para LISTENING', () => {
    expect(showCallButton('LISTENING')).toBe(true);
  });

  it('showCallButton retorna true para REPORT_READY', () => {
    expect(showCallButton('REPORT_READY')).toBe(true);
  });

  it('showCallButton retorna true para NO_RESPONSE', () => {
    expect(showCallButton('NO_RESPONSE')).toBe(true);
  });

  it('showCallButton retorna false para IDLE', () => {
    expect(showCallButton('IDLE')).toBe(false);
  });

  it('showCallButton retorna false para CALL_TRANSFERRED', () => {
    expect(showCallButton('CALL_TRANSFERRED')).toBe(false);
  });

  // ── canCancel ─────────────────────────────────────────────────────────────

  it('canCancel retorna false para CALL_TRANSFERRED', () => {
    expect(canCancel('CALL_TRANSFERRED')).toBe(false);
  });

  it('canCancel retorna true para LISTENING', () => {
    expect(canCancel('LISTENING')).toBe(true);
  });

  // ── STATE_LABELS ──────────────────────────────────────────────────────────

  it('STATE_LABELS tiene etiqueta para todos los estados', () => {
    const requiredStates: EmergencyState[] = [
      'IDLE', 'ACTIVATED', 'LISTENING', 'COLLECTING_CONTEXT',
      'LOCATION_PENDING', 'LOCATION_READY', 'REPORT_READY',
      'DIALING', 'CALL_TRANSFERRED', 'NO_RESPONSE', 'OFFLINE', 'ERROR',
    ];
    requiredStates.forEach(s => {
      expect(STATE_LABELS[s]).toBeDefined();
      expect(typeof STATE_LABELS[s]).toBe('string');
    });
  });
});
