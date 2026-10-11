/**
 * Perfil → Cuenta: «Tu código MediClaro» (Premium con teléfono confirmado, propietarios incluidos).
 * Con el código se entra en otro móvil desde «Ya soy Premium», sin SMS. Por seguridad, el código solo se ve al
 * crearlo; si se pierde, se crea uno nuevo (el anterior deja de valer).
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';
import { AppText, Icon, InfoBanner, PrimaryButton, SecondaryButton, SectionHeader } from '../../components';
import { useAppTheme } from '../../hooks';
import { AccessCodeService } from '../../services';
import { confirmAsync } from '../../utils/dialogs';
import { formatDateLong } from '../../utils/format';
import { errorMessage } from '../premium/parts';

export function AccessCodeCard() {
  const theme = useAppTheme();
  const c = theme.colors;
  const [status, setStatus] = useState<{ hasCode: boolean; createdAt: string | null } | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    AccessCodeService.status().then(setStatus).catch(() => setStatus(null));
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    if (busy) return;
    if (status?.hasCode) {
      const ok = await confirmAsync({
        title: '¿Crear un código nuevo?',
        message: 'El código que tenías dejará de valer. Tendrás que usar el nuevo para entrar en otros móviles.',
        confirmText: 'Crear código nuevo',
      });
      if (!ok) return;
    }
    setBusy(true);
    setError('');
    try {
      setCode(await AccessCodeService.issue());
      load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    if (!code) return;
    try {
      await Share.share({ message: `Mi código MediClaro (para entrar con «Ya soy Premium»): ${code}` });
    } catch {
      // Cancelado o no disponible: el código sigue en pantalla para apuntarlo.
    }
  };

  return (
    <View style={{ marginTop: theme.spacing.lg }} testID="access-code-card">
      <SectionHeader title="Tu código MediClaro" />
      <View style={[styles.card, { borderColor: c.border, borderRadius: theme.radius.lg, backgroundColor: c.surface, padding: theme.spacing.md, gap: theme.spacing.sm }, theme.shadow.card]}>
        <View style={styles.row}>
          <View style={[styles.icon, { backgroundColor: c.primaryTint }]}>
            <Icon name="key" size={22} color="primary" />
          </View>
          <AppText variant="body" color="text" style={styles.flex}>
            Con tu código entras en otro móvil desde «Ya soy Premium», sin teléfono ni SMS.
          </AppText>
        </View>

        {code ? (
          <View style={{ gap: theme.spacing.sm }}>
            <View style={[styles.codeBox, { borderColor: c.primary, borderRadius: theme.radius.md, backgroundColor: c.primaryTint }]}>
              <AppText variant="title" color="heading" align="center" selectable style={styles.code} accessibilityLabel={`Tu código: ${code.split('').join(' ')}`} testID="access-code-value">
                {code}
              </AppText>
            </View>
            <InfoBanner tone="warning" message="Apúntalo en un papel y guárdalo en un sitio seguro. Por seguridad, solo se muestra ahora. No se lo des a nadie." />
            <SecondaryButton label="Guardar o enviármelo" icon="share-outline" variant="outline" onPress={() => void share()} />
          </View>
        ) : (
          <AppText variant="small" color="textSecondary">
            {status?.hasCode
              ? `Ya tienes un código${status.createdAt ? `, creado el ${formatDateLong(status.createdAt)}` : ''}. Si lo has perdido, crea uno nuevo.`
              : 'Todavía no tienes código. Créalo y apúntalo.'}
          </AppText>
        )}

        {error ? <InfoBanner tone="danger" message={error} /> : null}
        {!code ? (
          <PrimaryButton
            label={status?.hasCode ? 'Crear un código nuevo' : 'Crear mi código'}
            icon="key-outline"
            onPress={() => void create()}
            loading={busy}
            disabled={busy}
            testID="access-code-create"
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  codeBox: { borderWidth: 2, borderStyle: 'dashed', paddingVertical: 14, paddingHorizontal: 8 },
  code: { letterSpacing: 2, fontVariant: ['tabular-nums'], fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: undefined }) },
});
