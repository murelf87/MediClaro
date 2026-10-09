/**
 * /owner/account — Mi cuenta (pantalla 11 del diseño): «Mi cuenta» con la etiqueta verde «Propietario», foto (o
 * iniciales), nombre y teléfono (oculto en parte); «Premium vitalicio · Todas las funciones incluidas», «Código de
 * administrador · ••••••», «Seguridad · Cambiar código privado» y «Cerrar sesión» en rojo.
 * (Cerrar solo el panel está en Seguridad; además se cierra solo.)
 */
import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { AppText, Avatar, ErrorState, SkeletonList } from '../../components';
import { useAsync, useSession } from '../../hooks';
import { OwnerAdminService } from '../../services/OwnerAdminService';
import { confirmAsync } from '../../utils/dialogs';
import { OC, OIcon, OPill, ORow, OT, OwnerScreen, fmtDate, useOwnerPhoto } from './OwnerKit';

export default function OwnerAccountScreen() {
  const router = useRouter();
  const { signOut } = useSession();
  const photo = useOwnerPhoto();
  const data = useAsync(() => OwnerAdminService.account(), []);
  const a = data.data;
  const busy = useRef(false);

  const leave = async () => {
    if (busy.current) return;
    const ok = await confirmAsync({
      title: 'Cerrar sesión',
      message: 'Saldrás de MediClaro en este teléfono. Para volver, entra con tu teléfono.',
      confirmText: 'Cerrar sesión',
      destructive: true,
    });
    if (!ok) return;
    busy.current = true;
    try {
      await OwnerAdminService.lock();
      await signOut();
      router.replace('/welcome' as Href);
    } finally {
      busy.current = false;
    }
  };

  return (
    <OwnerScreen
      title="Mi cuenta"
      titleRight={<OPill label="Propietario" solid />}
      refreshing={data.refreshing}
      onRefresh={() => void data.refresh()}
      testID="owner-account"
    >
      {data.status === 'loading' ? <SkeletonList rows={3} /> : null}
      {data.error && !a ? <ErrorState kind={data.error.kind} message={data.error.message} onRetry={() => void data.reload()} /> : null}
      {a ? (
        <>
          <View style={styles.head} accessible accessibilityLabel={`${a.name ?? 'Propietario'}. ${a.phone ?? ''}`}>
            <Avatar name={a.name ?? 'Propietario'} uri={photo} size={76} />
            <View style={[styles.flex, { gap: 2 }]}>
              <AppText style={[OT.h2, { fontSize: 20, lineHeight: 26 }]} color="heading">{a.name ?? 'Propietario'}</AppText>
              {a.phone ? <AppText style={OT.subtitle} color="textSecondary">{a.phone}</AppText> : null}
            </View>
          </View>

          <ORow
            left={<OIcon icon="checkmark" size={40} color="#16A34A" round />}
            title="Premium vitalicio"
            titleColor="#16A34A"
            subtitle="Todas las funciones incluidas"
            onPress={() => router.push('/owner/info' as Href)}
            testID="owner-account-premium"
          />
          <ORow
            left={<OIcon icon="key" variant="soft" size={44} />}
            title="Código de administrador"
            subtitle="••••••"
            meta={a.pinUpdatedAt ? `Cambiado el ${fmtDate(a.pinUpdatedAt)}` : null}
            onPress={() => router.push('/owner/security' as Href)}
            accessibilityLabel={`Código de administrador, oculto${a.pinUpdatedAt ? `. Cambiado el ${fmtDate(a.pinUpdatedAt)}` : ''}`}
            testID="owner-account-pin"
          />
          <ORow
            left={<OIcon icon="lock-closed" variant="soft" size={44} />}
            title="Seguridad"
            subtitle="Cambiar código privado"
            onPress={() => router.push('/owner/security' as Href)}
            testID="owner-account-security"
          />
          <ORow
            left={<OIcon icon="log-out-outline" variant="plain" size={36} color={OC.red} />}
            title="Cerrar sesión"
            danger
            chevron={false}
            onPress={() => void leave()}
            testID="owner-account-signout"
          />
        </>
      ) : null}
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 6 },
});
