/**
 * MediClaro no usa la «búsqueda en segundo plano» (background fetch) de iOS.
 * expo-task-manager la añade siempre a UIBackgroundModes; aquí se quita para que Apple no pregunte por un modo
 * de fondo que la app no usa. El único modo de fondo es «location» (ubicación al cuidador/a durante un aviso).
 */
const { withInfoPlist } = require('expo/config-plugins');

module.exports = function withoutBackgroundFetch(config) {
  return withInfoPlist(config, (c) => {
    const modes = c.modResults.UIBackgroundModes;
    if (Array.isArray(modes)) c.modResults.UIBackgroundModes = modes.filter((m) => m !== 'fetch');
    return c;
  });
};
