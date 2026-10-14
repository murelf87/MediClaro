/**
 * /owner/info — Acceso privado del propietario (pantalla 12 del diseño): cabecera con el logo y «Administrador», el
 * dibujo del candado, «Acceso privado del propietario», qué permite esta sección, tres ✓ verdes y «Volver al
 * dashboard». Sin barra inferior, como en el diseño.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, Icon } from '../../components';
import { OButton, OC, OCard, OCheck, OT, OwnerScreen } from './OwnerKit';

export default function OwnerInfoScreen() {
  const router = useRouter();
  return (
    <OwnerScreen admin tabBar={false} testID="owner-info">
      <View style={styles.art} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <LinearGradient colors={['#DCE9FF', '#F1F6FF']} style={styles.circle}>
          <View style={styles.shield}>
            <Icon name="shield" size={104} color={OC.blue} />
            <View style={styles.shieldLock}>
              <Icon name="lock-closed" size={32} color="#FFFFFF" />
            </View>
          </View>
          <View style={[styles.doc, { left: 22, bottom: 40 }]}>
            <View style={[styles.docLine, { width: '100%' }]} />
            <View style={[styles.docLine, { width: '70%' }]} />
            <View style={[styles.docLine, { width: '85%' }]} />
          </View>
          <View style={[styles.doc, { left: 40, bottom: 22 }]}>
            <View style={[styles.docLine, { width: '100%' }]} />
            <View style={[styles.docLine, { width: '60%' }]} />
            <View style={[styles.docLine, { width: '80%' }]} />
          </View>
        </LinearGradient>
      </View>
      <View style={{ gap: 8 }}>
        <AppText style={[OT.title, { fontSize: 23, lineHeight: 29 }]} color="heading" accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          Acceso privado del propietario
        </AppText>
        <AppText style={[OT.subtitle, { fontSize: 15, lineHeight: 22 }]} color="textSecondary">
          Esta sección permite gestionar la plataforma, crear bonos gratuitos y administrar el acceso Premium de los usuarios.
        </AppText>
      </View>
      <OCard style={{ gap: 2 }} testID="owner-info-checks">
        <OCheck label="Todas las funciones desbloqueadas" />
        <OCheck label="Sin suscripción ni pagos" />
        <OCheck label="Control total de la plataforma" />
      </OCard>
      <OButton label="Volver al dashboard" icon="grid-outline" onPress={() => router.dismissTo('/owner/dashboard' as Href)} testID="owner-info-back" />
    </OwnerScreen>
  );
}

const styles = StyleSheet.create({
  art: { alignItems: 'center', paddingTop: 8, paddingBottom: 4 },
  circle: { width: 184, height: 184, borderRadius: 92, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  shield: { marginLeft: 26, marginBottom: 10, alignItems: 'center', justifyContent: 'center' },
  shieldLock: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 8, alignItems: 'center', justifyContent: 'center' },
  doc: { position: 'absolute', width: 52, height: 38, borderRadius: 7, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: OC.blueLine, padding: 7, gap: 4 },
  docLine: { height: 4, borderRadius: 2, backgroundColor: '#BFD4FE' },
});
