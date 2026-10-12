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
import { BillingRequestService, ImmediateStartConsentService, ProfileService, PurchaseService } from '../../services';
import { confirmAsync, showAlert } from '../../utils/dialogs';
import { shareOrDownloadText } from '../../utils/device';
import { errorMessage } from '../premium/parts';
import { OwnerPreview } from '../../services/OwnerPreview';

/** Vista previa del propietario: borrar la cuenta o cerrar sesión afectaría a la cuenta REAL del propietario. */
async function blockedByOwnerPreview(): Promise<boolean> {
  if (!OwnerPreview.isActive()) return false;
  await showAlert(
    'Vista previa del propietario',
    'Aquí la persona cerraría su sesión o borraría su cuenta. En la vista previa no se hace: afectaría a tu cuenta real. Sal de la vista previa con «Salir» arriba.',
  );
  return true;
}

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
    if (await blockedByOwnerPreview()) return;
    busy.current = true;
    try {
      const sub = entitlement.subscription;
      const storeName = sub?.provider === 'apple' ? 'Apple' : sub?.provider === 'google' ? 'Google Play' : null;
      const renewingStoreSub = !!sub?.isPremium && !!storeName && !sub.cancelsAtPeriodEnd && sub.status !== 'canceled';

      // 1) Desistimiento: eliminar la cuenta NO quita el derecho a recuperar el dinero dentro de los 14 días.
      //    Si aún está en plazo (pagos que cobra MediClaro a través de Stripe), se ofrece tramitarlo ANTES de borrar.
      if (await ImmediateStartConsentService.withinWithdrawalPeriod(sub)) {
        const wantsRefund = await confirmAsync({
          title: 'Aún puedes recuperar tu dinero',
          message:
            'Pagaste hace menos de 14 días, así que puedes desistir: te devolvemos lo pagado menos los días que ya hayas tenido Premium. Eliminar tu cuenta no te quita ese derecho, pero es mejor pedirlo ahora.',
          confirmText: 'Pedir la devolución',
          cancelText: 'No, gracias',
        });
        if (wantsRefund) {
          const saved = await BillingRequestService.record('withdrawal', { provider: sub?.provider ?? null });
          await showAlert(
            'Hemos anotado tu solicitud',
            saved
              ? 'Queda registrada con la fecha de hoy. Te devolveremos el dinero por el mismo medio con el que pagaste, dentro de los 14 días siguientes.'
              : 'No hemos podido registrarla ahora mismo y lo volveremos a intentar solos. Para asegurarte, escríbenos desde Perfil › Ayuda indicando que quieres desistir.',
          );
        }
      }

      // 2) Una suscripción de Apple o Google Play NO se cancela al borrar la cuenta: la cobra la tienda. Eliminar la
      //    cuenta es un derecho y no se condiciona a cancelarla antes (lo piden tanto la norma 5.1.1(v) de Apple como
      //    el derecho de supresión), pero nunca se borra sin avisar de que ese cobro seguiría: se ofrece ir a
      //    cancelarla y hay que confirmar expresamente haberlo entendido.
      if (renewingStoreSub && sub) {
        const manage = await confirmAsync({
          title: 'Atención: te seguirán cobrando',
          message: `Tu MediClaro Premium lo cobra ${storeName} y seguirá cobrándose aunque elimines tu cuenta. Solo se puede cancelar en la gestión de suscripciones de ${storeName}. Te recomendamos cancelarlo primero.`,
          confirmText: 'Cancelar la suscripción',
          cancelText: 'Eliminar de todas formas',
        });
        if (manage) {
          await PurchaseService.manage(sub).catch(async (e: unknown) => {
            await showAlert('Gestionar suscripción', errorMessage(e));
          });
          return;
        }
        const understood = await confirmAsync({
          title: '¿Seguro que sigues sin cancelar?',
          message: `Si continúas, ${storeName} te seguirá cobrando MediClaro Premium y no podremos evitarlo desde aquí, porque tu cuenta ya no existirá. Tendrás que cancelarlo tú en ${storeName}.`,
          confirmText: 'Lo entiendo, continuar',
          cancelText: 'Volver',
          destructive: true,
        });
        if (!understood) return;
      }

      // 3) Eliminar la cuenta: definitivo, y distinto de cancelar la renovación.
      const first = await confirmAsync({
        title: '¿Eliminar tu cuenta?',
        message: renewingStoreSub
          ? `Se borrarán tu cuenta y tus datos de forma definitiva. Tu suscripción de ${storeName} no se cancela desde aquí.`
          : sub?.isPremium
            ? 'Se borrarán tu cuenta y tus datos de forma definitiva, ahora mismo. Ojo: esto no es lo mismo que cancelar la renovación. Si solo quieres dejar de pagar y seguir usando Premium hasta el final del periodo, usa «Gestionar suscripción» y no elimines la cuenta.'
            : 'Se borrarán tu cuenta y tus datos de forma definitiva. No se puede deshacer.',
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
      // Queda constancia de la solicitud (y de si se avisó de una suscripción de tienda que seguirá cobrándose)
      // ANTES de borrar: después ya no habría cuenta desde la que registrarlo.
      await BillingRequestService.record('account_deletion', {
        provider: sub?.provider ?? null,
        storeSubscriptionActive: renewingStoreSub,
      });
      const outcome = await ProfileService.deleteAccount();
      if (outcome.scheduled) {
        // Premium activo: la cuenta sigue hasta el fin del periodo pagado. Se mantiene la sesión.
        const when = outcome.deleteAt
          ? new Date(outcome.deleteAt).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
          : 'al terminar tu periodo Premium';
        await showAlert('Eliminación programada', `Tu Premium no se renovará. Tu cuenta y tus datos se eliminarán el ${when}. Hasta entonces puedes seguir usando la app.`);
        return;
      }
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
    if (await blockedByOwnerPreview()) return;
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
