/**
 * Diálogos multiplataforma.
 * En web, `Alert.alert` de React Native no hace nada: aquí usamos
 * window.confirm / window.alert para que ningún botón quede "muerto".
 */
import { Alert, Platform } from 'react-native';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

export function confirmAsync(opts: ConfirmOptions): Promise<boolean> {
  const { title, message, confirmText = 'Aceptar', cancelText = 'Cancelar', destructive = false } = opts;
  if (Platform.OS === 'web') {
    const text = message ? `${title}\n\n${message}` : title;
    const w = globalThis as { confirm?: (msg: string) => boolean };
    return Promise.resolve(typeof w.confirm === 'function' ? w.confirm(text) : false);
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: cancelText, style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function showAlert(title: string, message?: string, buttonText = 'Entendido'): Promise<void> {
  if (Platform.OS === 'web') {
    const w = globalThis as { alert?: (msg: string) => void };
    if (typeof w.alert === 'function') w.alert(message ? `${title}\n\n${message}` : title);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [{ text: buttonText, onPress: () => resolve() }], {
      cancelable: true,
      onDismiss: () => resolve(),
    });
  });
}
