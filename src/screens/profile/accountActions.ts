/**
 * Acciones de cuenta compartidas por Perfil, Datos de cuenta y Privacidad (equipo D):
 *  - Descargar mis datos (derecho de acceso RGPD) → archivo JSON.
 *  - Eliminar mi cuenta (doble confirmación) → vuelve a la bienvenida.
 *  - Cerrar sesión (con confirmación) → vuelve a la bienvenida.
 * Diálogos siempre con confirmAsync/showAlert (funcionan también en la QA web).
 */
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useEntitlement, useSession } from '../../hooks';
import { ProfileService, PurchaseService } from '../../services';
import { confirmAsync, showAlert } from '../../utils/dialogs';
import { shareOrDownloadText } from '../../utils/device';
import { errorMessage } from '../premium/parts';

export const EXPORT_FILENAME = 'mediclaro-mis-datos.json';

export function useAccountActions() {
  const router = useRouter();
  const { session, signOut } = useSession();
  const entitlement = useEntitlement();

  /** Vuelve a la pantalla de bienvenida (ruta única /welcome). */
  const goToWelcome = useCallback(() => {
    router.replace('/welcome');
  }, [router]);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  // Evita dobles pulsaciones mientras hay un diálogo o una petición en curso.
  const busy = useRef(false);

  const downloadMyData = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setExporting(true);
    try {
      const data = await ProfileService.exportData();
      const ok = await shareOrDownloadText(EXPORT_FILENAME, JSON.stringify(data, null, 2));
      if (ok) {
        await showAlert('Tus datos están listos', `Hemos preparado el archivo «${EXPORT_FILENAME}» con tus datos.`);
      } else {
        await showAlert(
          'No se ha guardado el archivo',
          'No se ha guardado ni compartido el archivo con tus datos. Puedes intentarlo de nuevo cuando quieras.',
        );
      }
    } catch (e) {
      await showAlert('No hemos podido descargar tus datos', errorMessage(e));
    } finally {
      busy.current = false;
      setExporting(false);
    }
  }, []);

  const deleteMyAccount = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      // Una suscripción de Apple o Google Play NO se cancela al borrar la cuenta: la tienda sigue cobrando hasta que la
      // persona la cancela allí. Se avisa antes y se ofrece abrir la gestión de la tienda (norma de Apple).
      const sub = entitlement.subscription;
      const storeName = sub?.provider === 'apple' ? 'Apple' : sub?.provider === 'google' ? 'Google Play' : null;
      const renewingStoreSub = !!sub?.isPremium && !!storeName && !sub.cancelsAtPeriodEnd && sub.status !== 'canceled';
      if (renewingStoreSub && sub) {
        const manage = await confirmAsync({
          title: 'Tu suscripción sigue activa',
          message: `Tu MediClaro Premium se paga con ${storeName} y se seguirá cobrando aunque elimines tu cuenta. Cancélala antes en la gestión de suscripciones de ${storeName}.`,
          confirmText: 'Gestionar suscripción',
          cancelText: 'Seguir sin cancelar',
        });
        if (manage) {
          await PurchaseService.manage(sub).catch(async (e: unknown) => {
            await showAlert('Gestionar suscripción', errorMessage(e));
          });
          return;
        }
      }
      const first = await confirmAsync({
        title: '¿Eliminar tu cuenta?',
        message: storeName && sub?.isPremium
          ? `Se borrarán tus datos. No se puede deshacer. Tu suscripción de ${storeName} no se cancela desde aquí.`
          : sub?.isPremium
            ? 'Se borrarán tus datos y se cancelará tu suscripción. No se puede deshacer.'
            : 'Se borrarán tus datos. No se puede deshacer.',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        destructive: true,
      });
      if (!first) return;
      const second = await confirmAsync({
        title: 'Eliminar definitivamente',
        message: 'Vas a borrar tu cuenta de MediClaro y todos tus datos para siempre.',
        confirmText: 'Eliminar definitivamente',
        cancelText: 'No, volver',
        destructive: true,
      });
      if (!second) return;
      setDeleting(true);
      await ProfileService.deleteAccount();
      // La sesión ya se ha cerrado en el servidor; limpiamos también el estado local.
      await signOut().catch(() => undefined);
      await showAlert('Cuenta eliminada', 'Hemos borrado tu cuenta y tus datos. Gracias por usar MediClaro.');
      goToWelcome();
    } catch (e) {
      await showAlert('No hemos podido eliminar tu cuenta', errorMessage(e));
    } finally {
      busy.current = false;
      setDeleting(false);
    }
  }, [entitlement.subscription, goToWelcome, signOut]);

  const confirmSignOut = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const mode = session?.mode ?? 'verified';
      const ok = await confirmAsync({
        title: '¿Cerrar sesión?',
        message:
          mode === 'demo'
            ? 'Saldrás del modo demostración y volverás a la pantalla de bienvenida.'
            : mode === 'anonymous'
              ? 'Saldrás del acceso de prueba y volverás a la pantalla de bienvenida.'
              : 'Para volver a entrar necesitarás tu teléfono y el código que te enviaremos por SMS.',
        confirmText: 'Cerrar sesión',
        cancelText: 'Cancelar',
        destructive: true,
      });
      if (!ok) return;
      setSigningOut(true);
      await signOut();
      goToWelcome();
    } catch (e) {
      await showAlert('No hemos podido cerrar la sesión', errorMessage(e));
    } finally {
      busy.current = false;
      setSigningOut(false);
    }
  }, [goToWelcome, session?.mode, signOut]);

  return { exporting, deleting, signingOut, downloadMyData, deleteMyAccount, confirmSignOut };
}
