/**
 * Acciones del dispositivo: llamar, abrir enlaces, mapas, ajustes, correo.
 * Devuelven `false` en lugar de lanzar, para que la UI pueda ofrecer alternativa.
 */
import { Linking, Platform, Share } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { toDialable } from './format';
import { showAlert } from './dialogs';
import { isDemoClientActive } from '../lib/supabase';
import { APP_NAME, APP_SHARE_URL, APP_STORE_ID, APP_STORE_URL, GOOGLE_PLAY_PACKAGE, GOOGLE_PLAY_URL } from '../config/app';

/** Números públicos que SIEMPRE se marcan de verdad (también en modo demostración). */
const PUBLIC_NUMBERS = new Set(['112', '061', '091', '092', '062', '080', '085', '024', '915620420']);

/** Abre el marcador del teléfono. El usuario confirma la llamada (iOS/Android lo exigen). */
export async function callPhone(phone: string): Promise<boolean> {
  const number = toDialable(phone);
  if (!number) return false;
  // En modo demostración los teléfonos de contactos son de ejemplo: no se marcan.
  if (isDemoClientActive() && !PUBLIC_NUMBERS.has(number.replace(/^\+34/, ''))) {
    await showAlert('Modo demostración', 'Este teléfono es un dato de ejemplo, así que no se realiza la llamada.');
    return true;
  }
  const url = `tel:${number}`;
  // Sin comprobación previa con canOpenURL: en Android 11+ puede responder false
  // aunque exista marcador. openURL falla de verdad si no se puede llamar.
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Abre una web dentro de la app (navegador seguro del sistema). */
export async function openExternalUrl(url: string): Promise<boolean> {
  if (!url) return false;
  try {
    if (Platform.OS === 'web') {
      const w = globalThis as { open?: (u: string, target?: string) => unknown };
      w.open?.(url, '_blank');
      return true;
    }
    await WebBrowser.openBrowserAsync(url, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: '#2563EB',
    });
    return true;
  } catch {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      return false;
    }
  }
}

/** Abre la ubicación en la app de mapas del sistema. */
export async function openMaps(lat: number, lng: number, label = 'Mi ubicación'): Promise<boolean> {
  const q = encodeURIComponent(label);
  const url = Platform.select({
    ios: `maps:0,0?q=${q}@${lat},${lng}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${q})`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  });
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  }
}

/** Abre una dirección postal en mapas. */
export async function openAddressInMaps(address: string): Promise<boolean> {
  const q = encodeURIComponent(address);
  const url = Platform.select({
    ios: `maps:0,0?q=${q}`,
    android: `geo:0,0?q=${q}`,
    default: `https://www.google.com/maps/search/?api=1&query=${q}`,
  });
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${q}`);
  }
}

/** Abre los ajustes del sistema para esta app (permisos). */
export async function openAppSettings(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    await Linking.openSettings();
    return true;
  } catch {
    return false;
  }
}

/** Abre el correo con destinatario y asunto. */
export async function composeEmail(to: string, subject: string, body = ''): Promise<boolean> {
  if (!to) return false;
  const url = `mailto:${to}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}


/** Abre la hoja nativa para compartir MediClaro con familiares o personas de confianza. */
export async function shareMediClaro(): Promise<boolean> {
  const storeLines = [
    APP_STORE_URL ? `iPhone/iPad: ${APP_STORE_URL}` : '',
    GOOGLE_PLAY_URL ? `Android: ${GOOGLE_PLAY_URL}` : '',
  ].filter(Boolean);
  const destination = APP_SHARE_URL || storeLines.join('\n');
  if (!destination) return false;
  try {
    const result = await Share.share({
      title: APP_NAME,
      message: `Te comparto MediClaro, una app para entender mejor la información de tus medicamentos.\n\n${destination}`,
    });
    return result.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}

/** Lleva a la ficha oficial de la tienda para que el usuario pueda valorar MediClaro. */
export async function rateMediClaro(): Promise<boolean> {
  const candidates = Platform.OS === 'ios'
    ? APP_STORE_ID
      ? [`itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`, APP_STORE_URL]
      : []
    : Platform.OS === 'android'
      ? [`market://details?id=${GOOGLE_PLAY_PACKAGE}`, GOOGLE_PLAY_URL]
      : [APP_SHARE_URL || APP_STORE_URL || GOOGLE_PLAY_URL].filter(Boolean);
  for (const url of candidates) {
    try {
      await Linking.openURL(url);
      return true;
    } catch {
      // Se prueba la siguiente alternativa (esquema nativo -> URL HTTPS).
    }
  }
  return false;
}

/**
 * Comparte o descarga un texto (p. ej. la exportación de datos en JSON).
 * Nativo: hoja de compartir del sistema. Web: descarga de archivo.
 */
export async function shareOrDownloadText(filename: string, content: string, mime = 'application/json'): Promise<boolean> {
  if (Platform.OS === 'web') {
    try {
      const g = globalThis as unknown as {
        document?: { createElement: (t: string) => { href: string; download: string; click: () => void } };
        URL?: { createObjectURL: (b: unknown) => string; revokeObjectURL: (u: string) => void };
        Blob?: new (parts: string[], opts: { type: string }) => unknown;
      };
      if (!g.document || !g.URL || !g.Blob) return false;
      const blob = new g.Blob([content], { type: mime });
      const href = g.URL.createObjectURL(blob);
      const a = g.document.createElement('a');
      a.href = href;
      a.download = filename;
      a.click();
      g.URL.revokeObjectURL(href);
      return true;
    } catch {
      return false;
    }
  }
  try {
    const result = await Share.share({ title: filename, message: content });
    return result.action !== Share.dismissedAction;
  } catch {
    return false;
  }
}
