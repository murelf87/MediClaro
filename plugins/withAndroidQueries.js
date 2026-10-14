/**
 * Config plugin: declara en AndroidManifest los <queries> necesarios en Android 11+
 * (visibilidad de paquetes) para que la app pueda abrir el MARCADOR (112 incluido),
 * los MENSAJES, el correo, los mapas y el navegador, y para que Linking.canOpenURL
 * responda correctamente.
 */
const { withAndroidManifest } = require('expo/config-plugins');

const INTENTS = [
  ['android.intent.action.DIAL', 'tel'],
  ['android.intent.action.VIEW', 'tel'],
  ['android.intent.action.SENDTO', 'sms'],
  ['android.intent.action.SENDTO', 'smsto'],
  ['android.intent.action.VIEW', 'sms'],
  ['android.intent.action.SENDTO', 'mailto'],
  ['android.intent.action.VIEW', 'geo'],
  ['android.intent.action.VIEW', 'https'],
];

module.exports = function withAndroidQueries(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (!Array.isArray(manifest.queries) || manifest.queries.length === 0) manifest.queries = [{}];
    const queries = manifest.queries[0];
    if (!Array.isArray(queries.intent)) queries.intent = [];
    for (const [action, scheme] of INTENTS) {
      const exists = queries.intent.some(
        (i) => i.action?.[0]?.$?.['android:name'] === action && i.data?.[0]?.$?.['android:scheme'] === scheme,
      );
      if (!exists) {
        queries.intent.push({ action: [{ $: { 'android:name': action } }], data: [{ $: { 'android:scheme': scheme } }] });
      }
    }
    return cfg;
  });
};
