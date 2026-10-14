const { withInfoPlist } = require('expo/config-plugins');

const MICROPHONE =
  'MediClaro usa el micrófono cuando mantienes pulsado para hablar con el asistente MediClaro y durante las llamadas de voz con tu cuidador/a.';
const FACE_ID = 'MediClaro usa Face ID solo para abrir el panel privado del propietario de la app.';
const MOTION =
  'MediClaro puede acceder a los sensores de movimiento del dispositivo cuando una función de seguridad o asistencia lo requiera, siempre con tu permiso.';

module.exports = function withRequiredIosPrivacy(config) {
  return withInfoPlist(config, (cfg) => {
    cfg.modResults.NSMicrophoneUsageDescription = MICROPHONE;
    cfg.modResults.NSMotionUsageDescription = MOTION;
    cfg.modResults.NSFaceIDUsageDescription = FACE_ID;
    return cfg;
  });
};
