/**
 * /owner/dashboard — Dashboard (pantalla 2 del diseño del propietario).
 * Cabecera con el logo, campana con los avisos del panel y la foto/iniciales (→ Mi cuenta); «Dashboard · Panel de
 * administración»; seis fichas (Usuarios, Bonos Premium, Suscripciones, Configuración, Estadísticas, Registro y
 * auditoría) y la tarjeta «Cuenta de propietario · Premium vitalicio · Todas las funciones desbloqueadas».
 */
import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { AppText, Avatar, ErrorState, Icon, SkeletonList } from '../../components';
import { useAppTheme, useAsync } from '../../hooks';
import { OwnerAdminService } from '../../services/OwnerAdminService';
import { Grid, OC, OCard, ODashTile, OPill, OT, OwnerScreen, useNarrow, useOwnerPhoto } from './OwnerKit';

export default function OwnerHomeScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const narrow = useNarrow();
  const photo = useOwnerPhoto();
  const data = useAsync(() => OwnerAdminService.overview(), []);
  useFocusEffect(
    useCallback(() => {
      if (data.status !== 'loading') void data.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );
  const go = (path: string) => router.push(path as Href);
  const o = data.data;
  const name = o?.owner.name ?? 'Propietario';
  // Campana: pagos pendientes, avisos de ayuda activos y errores de las últimas 24 h.
  const alerts = o ? o.counts.pastDue + o.counts.activeIncidents + (o.counts.errors24h > 0 ? 1 : 0) : 0;

  const headerRight = (
    <View style={styles.headerRight}>
      <Pressable
        onPress={() => go(o && o.counts.pastDue > 0 ? '/owner/subscriptions' : '/owner/system')}
        accessibilityRole="button"
        accessibilityLabel={alerts ? `Avisos del panel: ${alerts}` : 'Avisos del panel: ninguno'}
        hitSlop={8}
        testID="owner-bell"
        style={styles.bell}
      >
        <Icon name="notifications-outline" size={26} color={theme.colors.heading} />
        {alerts ? (
          <View style={styles.bellBadge}>
            <AppText style={styles.bellText} allowFontScaling={false}>{alerts > 9 ? '9+' : String(alerts)}</AppText>
          </View>
        ) : null}
      </Pressable>
      <Pressable onPress={() => go('/owner/account')} accessibilityRole="button" accessibilityLabel="Mi cuenta de propietario" hitSlop={6} testID="owner-account-avatar">
        <Avatar name={name} uri={photo} size={40} />
      </Pressable>
    </View>
  );

  return (
    <OwnerScreen
      title="Dashboard"
      subtitle="Panel de administración"
      back={false}
      headerRight={headerRight}
      refreshing={data.refreshing}
      onRefresh={() => void data.refresh()}
      testID="owner-dashboard"
    >
      {data.status === 'loading' ? <SkeletonList rows={4} /> : null}
      {data.error && !o ? <ErrorState kind={data.error.kind} message={data.error.message} onRetry={() => void data.reload()} /> : null}
      {o ? (
        <>
          <Grid>
            <ODashTile icon="people" title="Usuarios" subtitle="Gestiona cuentas y perfiles" onPress={() => go('/owner/users')} wide={narrow} testID="owner-tile-users" />
            <ODashTile icon="gift" title="Bonos Premium" subtitle="Crea y administra bonos gratuitos" onPress={() => go('/owner/vouchers')} wide={narrow} testID="owner-tile-vouchers" />
            <ODashTile icon="calendar" title="Suscripciones" subtitle="Estados y vigencias" onPress={() => go('/owner/subscriptions')} wide={narrow} testID="owner-tile-subscriptions" />
            <ODashTile icon="settings" title="Configuración" subtitle="Ajustes generales de la plataforma" onPress={() => go('/owner/settings')} wide={narrow} testID="owner-tile-settings" />
            <ODashTile icon="stats-chart" title="Estadísticas" subtitle="Uso y rendimiento" onPress={() => go('/owner/stats')} wide={narrow} testID="owner-tile-stats" />
            <ODashTile icon="cog" title="Registro y auditoría" subtitle="Actividad y eventos" onPress={() => go('/owner/audit')} wide={narrow} testID="owner-tile-audit" />
          </Grid>

          <OCard
            tone="blue"
            onPress={() => go('/owner/info')}
            accessibilityLabel={`Cuenta de propietario de ${name}. Premium vitalicio. Todas las funciones desbloqueadas`}
            testID="owner-hero"
            style={styles.owner}
          >
            <Icon name="shield-checkmark" size={44} color={OC.blue} />
            <View style={[styles.flex, { gap: 4 }]}>
              <View style={styles.ownerTop}>
                <AppText style={OT.cardTitle} color="heading">Cuenta de propietario</AppText>
                <OPill label="Premium vitalicio" solid />
              </View>
              <AppText style={OT.cardText} color="textSecondary">Todas las funciones desbloqueadas</AppText>
            </View>
          </OCard>

          {o.notice ? (
            <OCard onPress={() => go('/owner/notice')} style={styles.noticeRow} accessibilityLabel={`Aviso activo en la app: ${o.notice.message}`}>
              <Icon name="megaphone" size={20} color={OC.blue} />
              <AppText style={[OT.cardText, styles.flex]} color="text" numberOfLines={2}>
                {`Aviso activo en la app: ${o.notice.title ? `${o.notice.title}. ` : ''}${o.notice.message}`}
              </AppText>
            </OCard>
          ) : null}
        </>
      ) : null}
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bell: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  bellBadge: { position: 'absolute', top: 2, right: 2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: OC.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#FFFFFF' },
  bellText: { color: '#FFFFFF', fontSize: 10, lineHeight: 12, fontWeight: '800' },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ownerTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
});
