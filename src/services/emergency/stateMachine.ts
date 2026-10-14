/**
 * MediClaro — Emergency State Machine
 * Gestión explícita de estados del módulo de emergencia.
 * No se usan booleanos dispersos — cada estado es único y verificable.
 */

import { EmergencyState } from './types';

// Transiciones permitidas
type Transition = {
  from: EmergencyState | EmergencyState[] | '*';
  to: EmergencyState;
};

const TRANSITIONS: Transition[] = [
  // Activación
  { from: 'IDLE',                    to: 'ACTIVATED' },

  // Desde activación
  { from: 'ACTIVATED',               to: 'LISTENING' },
  { from: 'ACTIVATED',               to: 'COLLECTING_CONTEXT' }, // Sin hablar — botones rápidos
  { from: 'ACTIVATED',               to: 'DIALING' },            // Llamada directa

  // Escucha
  { from: 'LISTENING',               to: 'COLLECTING_CONTEXT' },
  { from: 'LISTENING',               to: 'NO_RESPONSE' },
  { from: 'LISTENING',               to: 'DIALING' },

  // Recopilación de contexto
  { from: 'COLLECTING_CONTEXT',      to: 'LOCATION_PENDING' },
  { from: 'COLLECTING_CONTEXT',      to: 'REPORT_READY' },       // Sin GPS
  { from: 'COLLECTING_CONTEXT',      to: 'NO_RESPONSE' },

  // GPS
  { from: 'LOCATION_PENDING',        to: 'LOCATION_READY' },
  { from: 'LOCATION_PENDING',        to: 'REPORT_READY' },       // GPS fallido

  // Informe listo
  { from: 'LOCATION_READY',          to: 'REPORT_READY' },
  { from: 'REPORT_READY',            to: 'DIALING' },
  { from: 'REPORT_READY',            to: 'NO_RESPONSE' },

  // Llamada al número principal
  { from: 'DIALING',                 to: 'CALL_TRANSFERRED' },
  { from: 'DIALING',                 to: 'ASSISTANCE_FAILED' },  // Número no disponible o vacío
  { from: 'DIALING',                 to: 'NO_RESPONSE' },

  // Asistencia fallida: reintentar o volver al informe
  { from: 'ASSISTANCE_FAILED',       to: 'DIALING' },
  { from: 'ASSISTANCE_FAILED',       to: 'REPORT_READY' },
  { from: 'ASSISTANCE_FAILED',       to: 'CALL_TRANSFERRED' },   // Si el usuario llama al 112

  // Sin respuesta
  { from: 'NO_RESPONSE',             to: 'DIALING' },
  // El usuario vuelve a interactuar ("Estoy aquí")
  { from: 'NO_RESPONSE',             to: 'LISTENING' },
  { from: 'NO_RESPONSE',             to: 'REPORT_READY' },

  // Volver al asistente para añadir información
  { from: 'REPORT_READY',            to: 'LISTENING' },


  // Offline desde cualquier estado
  { from: '*',                       to: 'OFFLINE' },
  { from: '*',                       to: 'ERROR' },
  { from: '*',                       to: 'IDLE' },               // Cancelar siempre posible
];

export function canTransition(from: EmergencyState, to: EmergencyState): boolean {
  return TRANSITIONS.some(t => {
    const fromMatch =
      t.from === '*' ||
      (Array.isArray(t.from) ? t.from.includes(from) : t.from === from);
    return fromMatch && t.to === to;
  });
}

// Descripción legible de cada estado para debugging / logs
export const STATE_LABELS: Record<EmergencyState, string> = {
  IDLE:               'En reposo',
  ACTIVATED:          'Emergencia activada',
  LISTENING:          'Escuchando',
  COLLECTING_CONTEXT: 'Recopilando información',
  LOCATION_PENDING:   'Obteniendo ubicación',
  LOCATION_READY:     'Ubicación obtenida',
  REPORT_READY:       'Informe preparado',
  DIALING:            'Llamada en curso…',
  CALL_TRANSFERRED:   'Llamada realizada',
  ASSISTANCE_FAILED:  'No se pudo contactar con asistencia',
  NO_RESPONSE:        'Sin respuesta detectada',
  OFFLINE:            'Sin conexión — modo local',
  ERROR:              'Error recuperable',
};

// ¿Debe la UI mostrar el botón de asistencia principal prominentemente?
export function showCallButton(state: EmergencyState): boolean {
  return state !== 'IDLE' && state !== 'CALL_TRANSFERRED';
}

// ¿Debe la UI mostrar el botón de emergencia oficial (112)?
// Siempre visible durante una emergencia activa.
export function showOfficialEmergencyButton(state: EmergencyState): boolean {
  return state !== 'IDLE';
}

// ¿Puede el usuario cancelar en este estado?
export function canCancel(state: EmergencyState): boolean {
  return state !== 'CALL_TRANSFERRED';
}
